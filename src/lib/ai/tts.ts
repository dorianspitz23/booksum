import { Modality } from '@google/genai';
import { getClient } from './client';
import { toAiError } from './errors';
import { MODELS } from './models';
import { audioScript } from './prompts';
import { pcmToWavBlob } from '../audio/wav';
import { base64ToBytes } from '../base64';
import type { Book, Summary, VoiceName } from '../../types';

/** Returns a playable WAV blob. Honours the profile's chosen voice. */
export async function generateAudioSummary(
  book: Book,
  summary: Summary,
  type: 'short' | 'long',
  voice: VoiceName,
): Promise<Blob> {
  try {
    const response = await getClient().models.generateContent({
      model: MODELS.tts,
      contents: [{ parts: [{ text: audioScript(book, summary, type) }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error('No audio generated');

    return pcmToWavBlob(base64ToBytes(base64Audio));
  } catch (error) {
    throw toAiError(error);
  }
}
