import { getClient } from './client';
import { AiError, toAiError } from './errors';
import { MODELS } from './models';
import { QUIZ_SCHEMA } from './schemas';
import { quizPrompt } from './prompts';
import { toQuizQuestions } from './validate';
import type { Book, QuizQuestion, Summary } from '../../types';

export async function generateBookQuiz(book: Book, summary: Summary): Promise<QuizQuestion[]> {
  try {
    const response = await getClient().models.generateContent({
      model: MODELS.quiz,
      contents: quizPrompt(book, summary),
      config: { responseMimeType: 'application/json', responseSchema: QUIZ_SCHEMA },
    });

    // An empty body means the completion was blocked or truncated. Defaulting it
    // to '{}' turned that into a silent empty quiz that looked like a successful
    // call, so the user got an empty modal and no explanation.
    if (!response.text?.trim()) {
      throw new AiError('malformed', 'Gemini returned an empty response. Try again.');
    }

    const questions = toQuizQuestions(JSON.parse(response.text));

    // Every question failing validation is not the same as the model declining to
    // answer, but it is equally unusable, and saying so beats an empty modal.
    if (questions.length === 0) {
      throw new AiError('malformed', 'Gemini returned a quiz BookSum could not read. Try again.');
    }

    return questions;
  } catch (error) {
    throw toAiError(error);
  }
}
