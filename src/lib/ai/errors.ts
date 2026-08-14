export type AiErrorKind =
  | 'missing-key'
  | 'invalid-key'
  | 'rate-limited'
  | 'quota'
  | 'safety'
  | 'bad-request'
  | 'server'
  | 'network'
  | 'malformed'
  | 'unknown';

export class AiError extends Error {
  constructor(
    readonly kind: AiErrorKind,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

export class MissingKeyError extends AiError {
  constructor() {
    super('missing-key', 'Add your Gemini API key to use AI features.');
  }
}

const MESSAGES: Record<AiErrorKind, string> = {
  'missing-key': 'Add your Gemini API key to use AI features.',
  'invalid-key':
    'That API key was rejected. It may be wrong, revoked, or restricted to a different site.',
  'rate-limited': 'Gemini is rate-limiting your key. Wait a moment and try again.',
  quota: 'Your Gemini quota is used up. Check your usage in Google AI Studio.',
  safety: 'Gemini blocked this request under its safety filters. Try a different book or wording.',
  'bad-request': 'Gemini rejected the request. If you uploaded a PDF, it may be too large.',
  server: 'Google is having trouble right now. Try again in a moment.',
  network: 'Could not reach Google. Check your connection and try again.',
  malformed: 'Gemini returned a response BookSum could not read. Try again.',
  unknown: 'Something went wrong talking to Gemini. Try again.',
};

function statusOf(error: unknown): number | undefined {
  // Guarded: this used to dereference `error` directly, so toAiError(null) threw
  // a TypeError from inside the function whose whole job is to tame throws.
  if (typeof error !== 'object' || error === null) return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

/**
 * Normalises anything thrown by the Gemini SDK or fetch into an AiError.
 *
 * Status is consulted before the message, which matters more than it sounds:
 * Gemini's 429 body reads "You exceeded your current quota", so a substring
 * check for "quota" ahead of the status classified every transient rate limit as
 * a permanently exhausted quota and sent the user off to AI Studio. For the same
 * reason a key restricted to a different referrer — a 403 whose body says
 * "blocked" — was reported as a content-safety block.
 */
export function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;

  const message = error instanceof Error ? error.message : String(error ?? '');
  const lower = message.toLowerCase();
  const status = statusOf(error);

  // An explicit safety marker is meaningful wherever it appears, so it is tested
  // before the generic 400 mapping but after the two statuses whose bodies use
  // the same vocabulary for something else entirely.
  const looksLikeSafety = lower.includes('safety') || lower.includes('blockreason');

  let kind: AiErrorKind = 'unknown';

  if (status === 429) kind = 'rate-limited';
  else if (status === 401 || status === 403) kind = 'invalid-key';
  else if (looksLikeSafety) kind = 'safety';
  // 400 is a malformed or oversized request, not a bad key. Reporting it as one
  // sent people off to regenerate a key that was working fine.
  else if (status === 400) kind = 'bad-request';
  else if (status !== undefined && status >= 500) kind = 'server';
  else if (error instanceof SyntaxError) kind = 'malformed';
  else if (error instanceof TypeError && lower.includes('fetch')) kind = 'network';
  else if (lower.includes('quota')) kind = 'quota';
  else if (lower.includes('blocked')) kind = 'safety';

  return new AiError(kind, MESSAGES[kind], error);
}
