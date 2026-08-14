import { GoogleGenAI } from '@google/genai';
import { getApiKey } from './apiKey';
import { MissingKeyError, toAiError } from './errors';
import { MODELS } from './models';

/**
 * Every Gemini call used to await the SDK with no deadline at all, so a hung
 * request left the UI spinning forever with no way back out — no timeout, no
 * cancel, no error. Ninety seconds is generous enough for a long-form summary or
 * a full narration and short enough that a stalled connection eventually says so.
 */
const REQUEST_TIMEOUT_MS = 90_000;

let cached: { key: string; client: GoogleGenAI } | null = null;

function build(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey, httpOptions: { timeout: REQUEST_TIMEOUT_MS } });
}

/** @throws MissingKeyError when the user has not supplied a key. */
export function getClient(): GoogleGenAI {
  const key = getApiKey();
  if (!key) throw new MissingKeyError();
  if (cached?.key !== key) cached = { key, client: build(key) };
  return cached.client;
}

export function resetClientCache(): void {
  cached = null;
}

/**
 * Validates a candidate key. Uses `models.list` rather than a real generation:
 * testing a key used to cost a full inference on the summary model every time
 * anyone saved one.
 */
export async function testApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed) throw new MissingKeyError();

  try {
    const probe = new GoogleGenAI({
      apiKey: trimmed,
      httpOptions: { timeout: 20_000 },
    });

    // Listing is the cheapest authenticated call available. Pulling one page is
    // enough to prove the credential works.
    const pager = await probe.models.list({ config: { pageSize: 1 } });
    void pager.page;
  } catch (error) {
    throw toAiError(error);
  }
}

export { MODELS };
