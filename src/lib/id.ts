/**
 * `crypto.randomUUID` is gated on a secure context, so it is simply absent when
 * the app is served over plain http — a LAN address, an intranet host, or a
 * `python -m http.server` smoke test. Calling it there threw on the first write
 * of the session (creating a profile), which read as the app being broken.
 *
 * `crypto.getRandomValues` carries no such gate, so the fallback is still
 * cryptographically random; only the convenience wrapper is missing.
 */
function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
    return bytes;
  }

  // No Web Crypto at all. Non-cryptographic, but ids here are collision-avoidance
  // handles for local records, never secrets or capability tokens.
  for (let i = 0; i < length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

/** A RFC 4122 version 4 UUID, in every context the app can be served from. */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = randomBytes(16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant 10xx

  const hex = Array.from(bytes, (byte) => HEX[byte]!);
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}
