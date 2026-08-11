import { GoogleGenAI } from '@google/genai';
import { getApiKey } from './apiKey';
import { MissingKeyError } from './errors';

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
