import { getClient } from './client';
import { toAiError } from './errors';
import { MODELS } from './models';
import { QUIZ_SCHEMA } from './schemas';
import { quizPrompt } from './prompts';
import type { Book, QuizQuestion, Summary } from '../../types';

export async function generateBookQuiz(book: Book, summary: Summary): Promise<QuizQuestion[]> {
  try {
    const response = await getClient().models.generateContent({
      model: MODELS.quiz,
      contents: quizPrompt(book, summary),
      config: { responseMimeType: 'application/json', responseSchema: QUIZ_SCHEMA },
    });

    const data = JSON.parse(response.text || '{}') as { questions?: QuizQuestion[] };
    return data.questions ?? [];
  } catch (error) {
    throw toAiError(error);
  }
}
