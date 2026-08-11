import type { Chat } from '@google/genai';
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
