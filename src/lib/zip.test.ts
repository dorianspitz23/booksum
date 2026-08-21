import { describe, it, expect } from 'vitest';
import { crc32, createZip } from './zip';

/**
 * Reads back only the fields the tests assert on, at the offsets the ZIP spec
 * fixes them at. Deliberately not a general reader: the point is to check the
 * writer against the spec's numbers, not against a second implementation that
 * could be wrong in the same direction. `Expand-Archive` and `unzip` are the
 * cross-checks for that.
 */
function readZip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.byteLength - 22;
  const decoder = new TextDecoder();

  const centralCount = view.getUint16(eocd + 10, true);
  const centralOffset = view.getUint32(eocd + 16, true);

  const entries = [];
  let at = centralOffset;
  for (let i = 0; i < centralCount; i += 1) {
    const nameLength = view.getUint16(at + 28, true);
    const localOffset = view.getUint32(at + 42, true);
    const localNameLength = view.getUint16(localOffset + 26, true);
    const dataAt = localOffset + 30 + localNameLength + view.getUint16(localOffset + 28, true);
    const uncompressedSize = view.getUint32(at + 24, true);

    entries.push({
      path: decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength)),
      contents: decoder.decode(bytes.subarray(dataAt, dataAt + uncompressedSize)),
      crc: view.getUint32(at + 16, true),
      compressedSize: view.getUint32(at + 20, true),
      uncompressedSize,
      method: view.getUint16(at + 10, true),
      flag: view.getUint16(at + 8, true),
      dosTime: view.getUint16(at + 12, true),
      dosDate: view.getUint16(at + 14, true),
      localSignature: view.getUint32(localOffset, true),
    });
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }

  return {
    centralCount,
    centralOffset,
    centralSize: view.getUint32(eocd + 12, true),
    eocdSignature: view.getUint32(eocd, true),
    entries,
  };
}

const AT = new Date(2026, 7, 21, 10, 30, 0);

describe('crc32', () => {
  // The standard CRC-32 (IEEE 802.3) check vectors. A zip whose CRCs are wrong
  // extracts on some tools and reports corruption on others, so these are
  // pinned against the published values rather than against our own output.
  it.each([
    ['', 0x00000000],
    ['a', 0xe8b7be43],
    ['abc', 0x352441c2],
    ['123456789', 0xcbf43926],
    ['The quick brown fox jumps over the lazy dog', 0x414fa339],
  ])('matches the published check value for %o', (input, expected) => {
    expect(crc32(new TextEncoder().encode(input))).toBe(expected);
  });

  it('is computed over bytes, not characters', () => {
    // 'é' is two bytes in UTF-8. A character-wise implementation gets a
    // different answer here, and the zip only fails on non-ASCII filenames.
    const bytes = new TextEncoder().encode('é');
    expect(bytes).toHaveLength(2);
    expect(crc32(bytes)).toBe(0x0e048d3e);
  });
});

describe('createZip', () => {
  it('opens with a local file header signature', () => {
    const zip = createZip([{ path: 'a.md', contents: 'hello' }], AT);
    expect(Array.from(zip.subarray(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it('records every entry in the central directory', () => {
    const zip = createZip(
      [
        { path: 'one.md', contents: '1' },
        { path: 'two.md', contents: '2' },
        { path: 'three.md', contents: '3' },
      ],
      AT,
    );
    const read = readZip(zip);

    expect(read.eocdSignature).toBe(0x06054b50);
    expect(read.centralCount).toBe(3);
    expect(read.entries.map((e) => e.path)).toEqual(['one.md', 'two.md', 'three.md']);
  });

  it('round-trips contents unchanged', () => {
    const contents = '# Dune\n\n*by Frank Herbert*\n\nFear is the mind-killer.\n';
    const read = readZip(createZip([{ path: 'dune.md', contents }], AT));

    expect(read.entries[0]?.contents).toBe(contents);
  });

  it('stores rather than compresses, so the two sizes agree', () => {
    const contents = 'x'.repeat(5000);
    const entry = readZip(createZip([{ path: 'big.md', contents }], AT)).entries[0];

    expect(entry?.method).toBe(0);
    expect(entry?.compressedSize).toBe(5000);
    expect(entry?.uncompressedSize).toBe(5000);
  });

  it('writes a CRC matching the stored bytes', () => {
    const contents = 'The quick brown fox jumps over the lazy dog';
    const entry = readZip(createZip([{ path: 'fox.md', contents }], AT)).entries[0];

    expect(entry?.crc).toBe(0x414fa339);
  });

  it('sizes non-ASCII entries in bytes and flags them as UTF-8', () => {
    // 'é' is one character and two bytes. A length taken from the string rather
    // than the encoded bytes truncates the entry and every later offset with it.
    const contents = 'Café Society — naïve';
    const read = readZip(createZip([{ path: 'café.md', contents }], AT));
    const entry = read.entries[0];

    expect(entry?.path).toBe('café.md');
    expect(entry?.contents).toBe(contents);
    expect(entry?.uncompressedSize).toBe(new TextEncoder().encode(contents).byteLength);
    // Bit 11 tells the extractor the name is UTF-8 rather than CP437.
    expect((entry?.flag ?? 0) & 0x0800).toBe(0x0800);
  });

  it('points each central record at its own local header', () => {
    const read = readZip(
      createZip(
        [
          { path: 'first.md', contents: 'aaaa' },
          { path: 'second.md', contents: 'bbbbbbbb' },
        ],
        AT,
      ),
    );

    // Every recorded offset must land on a local header, not mid-file. This is
    // the field an off-by-one in the running offset corrupts, and most tools
    // read the central directory first, so it is what they trust.
    for (const entry of read.entries) {
      expect(entry.localSignature).toBe(0x04034b50);
    }
    expect(read.entries[1]?.contents).toBe('bbbbbbbb');
  });

  it('places the central directory where the trailer says it does', () => {
    const zip = createZip([{ path: 'a.md', contents: 'x' }], AT);
    const read = readZip(zip);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);

    expect(view.getUint32(read.centralOffset, true)).toBe(0x02014b50);
    expect(read.centralOffset + read.centralSize).toBe(zip.byteLength - 22);
  });

  it('encodes the modification time in DOS format', () => {
    // Without a real timestamp every extracted note lands dated 1980, which is
    // what a vault sorted by "recently modified" would show.
    const entry = readZip(createZip([{ path: 'a.md', contents: 'x' }], AT)).entries[0];

    expect(entry?.dosDate).toBe(((2026 - 1980) << 9) | (8 << 5) | 21);
    expect(entry?.dosTime).toBe((10 << 11) | (30 << 5) | 0);
  });

  it('produces a readable trailer for an empty archive', () => {
    const read = readZip(createZip([], AT));

    expect(read.eocdSignature).toBe(0x06054b50);
    expect(read.centralCount).toBe(0);
  });
});
