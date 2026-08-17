/**
 * Backed by an explicit ArrayBuffer rather than `new Uint8Array(length)`, whose
 * inferred `ArrayBufferLike` buffer is not assignable to `BlobPart`.
 *
 * @throws when the input is not valid base64. The signature says `(string) =>
 * Uint8Array`, which reads as total and is not: `atob` throws on any character
 * outside the alphabet. Its inputs come from legacy localStorage written by a
 * different version of the app, so "not valid base64" is a real state, not a
 * hypothetical. Prefer `tryBase64ToBytes` unless you know the input is clean.
 */
export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * The total version: null instead of a throw.
 *
 * Every caller was already wrapping `base64ToBytes` in its own try/catch, which
 * is the shape of a function whose type is lying about what it can do. This puts
 * the honest signature in one place rather than in each caller's memory.
 */
export function tryBase64ToBytes(base64: string | undefined): Uint8Array<ArrayBuffer> | null {
  if (!base64) return null;
  try {
    return base64ToBytes(base64);
  } catch {
    return null;
  }
}

/**
 * Chunked rather than byte-by-byte. The one-character-at-a-time concatenation
 * this replaces ran the whole length of a PDF on the main thread, appending to
 * a string that the engine has to keep flattening — a 10 MB upload froze the
 * tab for the duration. Converting 8 KB at a time hands the same work to the
 * engine in blocks it can do natively.
 *
 * 8192 is well inside the argument-count limit for a spread call on every
 * engine this runs in; larger chunks risk a "too many arguments" RangeError.
 */
const CHUNK = 8192;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
