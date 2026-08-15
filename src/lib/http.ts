/**
 * `fetch` has no default timeout. A third party that accepts the connection and
 * then never answers leaves the promise pending forever, and the caller with it:
 * the cover lookups ran on the add-book path, so a hung provider left the user
 * watching a spinner with no way to tell it had already failed.
 */
export const DEFAULT_TIMEOUT_MS = 8_000;

/**
 * Fetches JSON with a hard timeout. Returns null rather than throwing on any
 * failure -- timeout, network error, non-2xx, or a body that is not JSON -- since
 * every caller so far treats "no data" and "could not reach it" the same way and
 * has its own fallback.
 */
export async function fetchJsonOrNull<T>(
  url: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
