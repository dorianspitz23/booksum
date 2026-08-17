interface DownloadTextOptions {
  filename: string;
  contents: string;
  mimeType?: string;
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
  const blob = new Blob([contents], { type: `${mimeType};charset=utf-8` });
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
