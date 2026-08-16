import { Modality } from '@google/genai';
import { getClient } from './client';
import { toAiError } from './errors';
import { MODELS } from './models';
import { audioScript } from './prompts';
import { pcmRateFromMimeType, pcmToWavBlob } from '../audio/wav';
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

    const inline = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    const base64Audio = inline?.data;
    if (!base64Audio) throw new Error('No audio generated');

    // The reported format used to be thrown away and 24kHz PCM assumed. If
    // Google ever returns another rate, that assumption writes a header that
    // disagrees with the samples and the narration plays at the wrong speed
    // with nothing reporting a fault; if it returns another codec entirely,
    // wrapping it in a RIFF header produces confident noise. Refusing is the
    // only honest response to a format this encoder cannot write.
    const sampleRate = pcmRateFromMimeType(inline.mimeType);
    if (sampleRate === null) {
      throw new Error(`Unsupported audio format from the model: ${inline.mimeType ?? 'unknown'}`);
    }

    return pcmToWavBlob(base64ToBytes(base64Audio), sampleRate);
  } catch (error) {
    throw toAiError(error);
  }
}
