/**
 * The only place model IDs appear. A Google rename is a one-line change here.
 *
 * These are preview builds, which Google retires on its own schedule — and this
 * is a repo people will clone months from now. A withdrawn model answers 404,
 * which the SDK surfaces as a client error; without the hint in `errors.ts` that
 * reads as a problem with the user's key or their file, sending them to fix
 * something that was never wrong.
 *
 * If AI features stop working after a long gap, check
 * https://ai.google.dev/gemini-api/docs/models for current IDs and update here.
 */
export const MODELS = {
  summary: 'gemini-3-flash-preview',
  detailedSummary: 'gemini-3-pro-preview',
  quiz: 'gemini-3-flash-preview',
  chat: 'gemini-3-flash-preview',
  recommendations: 'gemini-3-flash-preview',
  tts: 'gemini-2.5-flash-preview-tts',
} as const;
