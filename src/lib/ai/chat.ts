import type { Chat } from '@google/genai';

/** Re-exported so UI code never imports the SDK directly. */
export type { Chat };
import { getClient } from './client';
import { toAiError } from './errors';
import { MODELS } from './models';
import { chatSystemInstruction } from './prompts';
import type { Book, Summary } from '../../types';

export function createBookChatSession(book: Book, summary: Summary): Chat {
  try {
    return getClient().chats.create({
      model: MODELS.chat,
      config: { systemInstruction: chatSystemInstruction(book, summary) },
    });
  } catch (error) {
    throw toAiError(error);
  }
}

/** Streams a reply, calling onChunk with the text so far. Returns the full text. */
export async function sendMessageStream(
  chat: Chat,
  message: string,
  onChunk: (textSoFar: string) => void,
): Promise<string> {
  try {
    const stream = await chat.sendMessageStream({ message });
    let text = '';
    for await (const chunk of stream) {
      text += chunk.text ?? '';
      onChunk(text);
    }
    return text;
  } catch (error) {
    throw toAiError(error);
  }
}
