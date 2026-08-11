import { describe, expect, it } from 'vitest';
import { AiError, MissingKeyError, toAiError } from './errors';

function apiError(status: number, message = 'boom') {
  return Object.assign(new Error(message), { name: 'ApiError', status });
}

describe('toAiError', () => {
  it('passes an AiError through untouched', () => {
    const original = new MissingKeyError();
    expect(toAiError(original)).toBe(original);
  });

  it.each([
    [400, 'invalid-key'],
    [401, 'invalid-key'],
    [403, 'invalid-key'],
    [429, 'rate-limited'],
    [500, 'unknown'],
    [503, 'unknown'],
  ])('maps HTTP %i to %s', (status, kind) => {
    expect(toAiError(apiError(status)).kind).toBe(kind);
  });

  it('detects a quota message ahead of the raw status', () => {
    expect(toAiError(apiError(429, 'Quota exceeded for this project')).kind).toBe('quota');
  });

  it('maps a safety block', () => {
    expect(toAiError(apiError(400, 'Response blocked due to SAFETY')).kind).toBe('safety');
  });

  it('maps a fetch failure to a network error', () => {
    expect(toAiError(new TypeError('Failed to fetch')).kind).toBe('network');
  });

  it('maps a JSON parse failure', () => {
    expect(toAiError(new SyntaxError('Unexpected token < in JSON')).kind).toBe('malformed');
  });

  it('always produces a user-facing message', () => {
    for (const status of [400, 401, 429, 500]) {
      const error = toAiError(apiError(status));
      expect(error).toBeInstanceOf(AiError);
      expect(error.message.length).toBeGreaterThan(10);
    }
  });
});
