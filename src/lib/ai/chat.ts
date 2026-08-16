import type { Chat } from '@google/genai';

/** Re-exported so UI code never imports the SDK directly. */
export type { Chat };
import { getClient } from './client';
import { AiError, toAiError } from './errors';
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

    // A completion the model declines to produce streams zero chunks and
    // resolves normally, so this used to return '' and leave an empty assistant
    // bubble sitting there for good — indistinguishable from a reply still on
    // its way. Raised as a typed failure so it reaches the same error path as
    // everything else and the user learns that something actually happened.
    if (!text.trim()) {
      throw new AiError('safety', 'The model returned nothing. Try rephrasing your question.');
    }
    return text;
  } catch (error) {
    throw toAiError(error);
  }
}
