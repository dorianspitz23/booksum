/**
 * The URL a recorded `fetch` call was made to.
 *
 * `String(input)` looked equivalent and was not: `fetch` accepts a string, a
 * `URL`, or a `Request`, and `String(someRequest)` is the literal text
 * "[object Object]". Any assertion built on it — "no call went to the Gemini
 * host", "only these two hosts were contacted" — would have passed for a
 * request to anywhere at all, as long as it was made with a Request object.
 */
export function requestUrl(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (input instanceof Request) return input.url;
  return '';
}
