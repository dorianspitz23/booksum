/**
 * @vitest-environment node
 *
 * No DOM here, so this suite skips the jsdom window the default environment
 * builds. See src/test/setup.ts.
 */
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
    [400, 'bad-request'],
    [401, 'invalid-key'],
    [403, 'invalid-key'],
    [429, 'rate-limited'],
    [500, 'server'],
    [503, 'server'],
  ])('maps HTTP %i to %s', (status, kind) => {
    expect(toAiError(apiError(status)).kind).toBe(kind);
  });

  /**
   * These three encode the bugs the previous version of this file had, and that
   * the previous version of this test asserted as correct behaviour.
   */
  it('reports a 429 as rate-limited even though its body says "quota"', () => {
    // Gemini's 429 body reads "You exceeded your current quota". Matching that
    // substring ahead of the status told users their quota was permanently used
    // up and sent them to AI Studio, when the fix was to wait a few seconds.
    expect(toAiError(apiError(429, 'You exceeded your current quota')).kind).toBe('rate-limited');
  });

  it('reports a referrer-restricted 403 as a key problem, not a safety block', () => {
    // A key restricted to another site returns 403 with "blocked" in the body.
    expect(
      toAiError(apiError(403, 'Requests from referer https://other.test are blocked.')).kind,
    ).toBe('invalid-key');
  });

  it('reports a 400 as a bad request rather than a rejected key', () => {
    // An oversized PDF 400s. Telling the user their key was rejected sent them
    // off to regenerate a key that was working perfectly.
    expect(toAiError(apiError(400, 'Request payload size exceeds the limit')).kind).toBe(
      'bad-request',
    );
  });

  it('still recognises a genuine safety block on a 400', () => {
    expect(toAiError(apiError(400, 'Response blocked due to SAFETY')).kind).toBe('safety');
  });

  it('recognises a blockReason payload', () => {
    expect(toAiError(new Error('candidate suppressed, blockReason: OTHER')).kind).toBe('safety');
  });

  it('maps a quota message with no HTTP status', () => {
    expect(toAiError(new Error('Daily quota exhausted')).kind).toBe('quota');
  });

  it('maps a fetch failure to a network error', () => {
    expect(toAiError(new TypeError('Failed to fetch')).kind).toBe('network');
  });

  it('maps a JSON parse failure', () => {
    expect(toAiError(new SyntaxError('Unexpected token < in JSON')).kind).toBe('malformed');
  });

  it.each([[null], [undefined], ['a bare string'], [42]])(
    'survives being handed %s instead of an Error',
    (value) => {
      // statusOf used to dereference its argument, so the normaliser threw a
      // TypeError of its own on exactly the inputs it exists to tame.
      expect(() => toAiError(value)).not.toThrow();
      expect(toAiError(value)).toBeInstanceOf(AiError);
    },
  );

  it('always produces a user-facing message', () => {
    for (const status of [400, 401, 429, 500]) {
      const error = toAiError(apiError(status));
      expect(error).toBeInstanceOf(AiError);
      expect(error.message.length).toBeGreaterThan(10);
    }
  });

  it('never tells the user to visit a screen that does not exist', () => {
    // 'invalid-key' used to say "Check it in Settings" when nothing of the kind
    // existed. There is a key card on the profile page now, but these errors all
    // open the key dialog directly, so sending the user hunting is still wrong.
    for (const status of [400, 401, 403, 429, 500]) {
      expect(toAiError(apiError(status)).message).not.toMatch(/in settings/i);
    }
  });

  it('reports a retired model as a retired model', () => {
    // Every model this app uses is a -preview build, and Google withdraws those
    // on its own schedule. A clone that sat for months answers 404 on every AI
    // action; that used to fall through to the generic message, which named
    // nothing the user or a contributor could act on.
    const error = toAiError(apiError(404));

    expect(error.kind).toBe('model-unavailable');
    expect(error.message).toMatch(/models\.ts/);
  });

  it('does not mistake a retired model for a bad key or an oversized file', () => {
    const message = toAiError(apiError(404)).message;

    expect(message).not.toMatch(/key/i);
    expect(message).not.toMatch(/pdf/i);
  });
});
