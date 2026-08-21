interface DownloadTextOptions {
  filename: string;
  contents: string;
  mimeType?: string;
}

interface DownloadBytesOptions {
  filename: string;
  /**
   * Pinned to `ArrayBuffer` rather than the default `ArrayBufferLike`: a
   * `SharedArrayBuffer` view is not a valid `BlobPart`, and the bare
   * `Uint8Array` alias admits one.
   */
  bytes: Uint8Array<ArrayBuffer>;
  mimeType?: string;
}

/** The anchor dance, shared by both entry points so only one of them can drift. */
function saveBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Deferred by a tick. Revoking in the same task as click() races the browser's
  // read of the URL, and a cancelled download looks to the user like a button
  // that simply did nothing. The blob is still freed either way.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Triggers a browser download of in-memory text.
 *
 * Named arguments, because the positional form was `(filename, contents,
 * mimeType)` — three adjacent strings where swapping the first two compiles
 * perfectly and produces a file named after its own contents, containing the
 * filename. Nothing about the types could catch it and nothing at runtime
 * would either.
 */
export function downloadText({
  filename,
  contents,
  mimeType = 'text/markdown',
}: DownloadTextOptions) {
  saveBlob(filename, new Blob([contents], { type: `${mimeType};charset=utf-8` }));
}

/**
 * The same, for binary payloads.
 *
 * Separate from `downloadText` rather than a widened parameter, because the two
 * differ in more than their body type: text carries `;charset=utf-8` and binary
 * must not. A zip labelled with a charset invites a tool to treat it as text
 * and re-encode it, which corrupts it silently.
 */
export function downloadBytes({
  filename,
  bytes,
  mimeType = 'application/zip',
}: DownloadBytesOptions) {
  saveBlob(filename, new Blob([bytes], { type: mimeType }));
}

/** Filesystem-safe slug for export filenames. */
export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'untitled'
  );
}
