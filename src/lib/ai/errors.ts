export type AiErrorKind =
  | 'missing-key'
  | 'invalid-key'
  | 'rate-limited'
  | 'quota'
  | 'safety'
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
  'invalid-key': 'That API key was rejected. Check it in Settings and try again.',
  'rate-limited': 'Google is rate-limiting your key. Wait a moment and try again.',
  quota: 'Your Gemini quota is used up. Check your usage in Google AI Studio.',
  safety: 'Gemini blocked this request under its safety filters. Try a different book or wording.',
  network: 'Could not reach Google. Check your connection and try again.',
  malformed: 'Gemini returned a response BookSum could not read. Try again.',
  unknown: 'Something went wrong talking to Gemini. Try again.',
};

function statusOf(error: unknown): number | undefined {
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

/** Normalises anything thrown by the Gemini SDK or fetch into an AiError. */
export function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;

  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  let kind: AiErrorKind = 'unknown';

  if (lower.includes('quota')) kind = 'quota';
  else if (lower.includes('safety') || lower.includes('blocked')) kind = 'safety';
  else if (error instanceof SyntaxError) kind = 'malformed';
  else if (error instanceof TypeError && lower.includes('fetch')) kind = 'network';
  else {
    const status = statusOf(error);
    if (status === 400 || status === 401 || status === 403) kind = 'invalid-key';
    else if (status === 429) kind = 'rate-limited';
  }

  return new AiError(kind, MESSAGES[kind], error);
}
