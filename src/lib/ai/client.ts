import { GoogleGenAI } from '@google/genai';
import { getApiKey } from './apiKey';
import { MissingKeyError, toAiError } from './errors';
import { MODELS } from './models';

let cached: { key: string; client: GoogleGenAI } | null = null;

/** @throws MissingKeyError when the user has not supplied a key. */
export function getClient(): GoogleGenAI {
  const key = getApiKey();
  if (!key) throw new MissingKeyError();
  if (cached?.key !== key) cached = { key, client: new GoogleGenAI({ apiKey: key }) };
  return cached.client;
}

export function resetClientCache(): void {
  cached = null;
}

/** Validates a candidate key with one trivial call. Throws a typed AiError. */
export async function testApiKey(key: string): Promise<void> {
  try {
    const probe = new GoogleGenAI({ apiKey: key.trim() });
    await probe.models.generateContent({ model: MODELS.summary, contents: 'ping' });
  } catch (error) {
    throw toAiError(error);
  }
}
