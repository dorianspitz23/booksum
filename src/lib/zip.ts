/**
 * A minimal ZIP writer, stored entries only.
 *
 * The library export is a folder of markdown notes, and a folder has to reach
 * the user as one file. A dependency would bring a DEFLATE implementation we
 * have no use for — markdown is small, and the whole point of "stored" entries
 * is that the bytes go in unchanged, which is what makes this auditable at a
 * glance.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let bit = 0; bit < 8; bit += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

/** CRC-32 (IEEE 802.3) over raw bytes, as the ZIP local and central headers want it. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = (CRC_TABLE[(crc ^ (bytes[i] ?? 0)) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  /** Path inside the archive. Forward slashes, even on Windows — the spec says so. */
  path: string;
  contents: string;
}

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL = 0x06054b50;
const LOCAL_HEADER_BYTES = 30;
const CENTRAL_HEADER_BYTES = 46;
const END_OF_CENTRAL_BYTES = 22;
const STORED = 0;
const VERSION = 20;
/** Bit 11: the name is UTF-8, not CP437. Without it 'café.md' extracts mojibake. */
const UTF8_FLAG = 0x0800;

/** MS-DOS packed date and time — the only timestamp format a base ZIP header carries. */
function dosDateTime(at: Date) {
  return {
    time: (at.getHours() << 11) | (at.getMinutes() << 5) | (at.getSeconds() >> 1),
    date: ((at.getFullYear() - 1980) << 9) | ((at.getMonth() + 1) << 5) | at.getDate(),
  };
}

export function createZip(
  entries: ZipEntry[],
  modifiedAt: Date = new Date(),
): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime(modifiedAt);

  /**
   * Names and contents are encoded once, up front. Every length in a ZIP header
   * counts bytes, and reaching for `.length` on the string instead would write a
   * short size for any non-ASCII entry — which corrupts not just that entry but
   * every offset recorded after it.
   */
  const prepared = entries.map(({ path, contents }) => {
    const data = encoder.encode(contents);
    return { name: encoder.encode(path), data, crc: crc32(data) };
  });

  const localBytes = prepared.reduce(
    (total, e) => total + LOCAL_HEADER_BYTES + e.name.byteLength + e.data.byteLength,
    0,
  );
  const centralBytes = prepared.reduce(
    (total, e) => total + CENTRAL_HEADER_BYTES + e.name.byteLength,
    0,
  );

  const out = new Uint8Array(localBytes + centralBytes + END_OF_CENTRAL_BYTES);
  const view = new DataView(out.buffer);
  const localOffsets: number[] = [];
  let at = 0;

  for (const entry of prepared) {
    localOffsets.push(at);
    view.setUint32(at, LOCAL_HEADER, true);
    view.setUint16(at + 4, VERSION, true);
    view.setUint16(at + 6, UTF8_FLAG, true);
    view.setUint16(at + 8, STORED, true);
    view.setUint16(at + 10, time, true);
    view.setUint16(at + 12, date, true);
    view.setUint32(at + 14, entry.crc, true);
    view.setUint32(at + 18, entry.data.byteLength, true);
    view.setUint32(at + 22, entry.data.byteLength, true);
    view.setUint16(at + 26, entry.name.byteLength, true);
    view.setUint16(at + 28, 0, true);
    out.set(entry.name, at + LOCAL_HEADER_BYTES);
    out.set(entry.data, at + LOCAL_HEADER_BYTES + entry.name.byteLength);
    at += LOCAL_HEADER_BYTES + entry.name.byteLength + entry.data.byteLength;
  }

  const centralOffset = at;

  for (let i = 0; i < prepared.length; i += 1) {
    const entry = prepared[i];
    if (!entry) continue;

    view.setUint32(at, CENTRAL_HEADER, true);
    view.setUint16(at + 4, VERSION, true);
    view.setUint16(at + 6, VERSION, true);
    view.setUint16(at + 8, UTF8_FLAG, true);
    view.setUint16(at + 10, STORED, true);
    view.setUint16(at + 12, time, true);
    view.setUint16(at + 14, date, true);
    view.setUint32(at + 16, entry.crc, true);
    view.setUint32(at + 20, entry.data.byteLength, true);
    view.setUint32(at + 24, entry.data.byteLength, true);
    view.setUint16(at + 28, entry.name.byteLength, true);
    // Extra field, comment, disk number and both attribute words stay zero.
    view.setUint32(at + 42, localOffsets[i] ?? 0, true);
    out.set(entry.name, at + CENTRAL_HEADER_BYTES);
    at += CENTRAL_HEADER_BYTES + entry.name.byteLength;
  }

  view.setUint32(at, END_OF_CENTRAL, true);
  view.setUint16(at + 8, prepared.length, true);
  view.setUint16(at + 10, prepared.length, true);
  view.setUint32(at + 12, centralBytes, true);
  view.setUint32(at + 16, centralOffset, true);

  return out;
}
