import { getClient } from './client';
import { toAiError } from './errors';
import { MODELS } from './models';
import { RECOMMENDATION_SCHEMA } from './schemas';
import { recommendationsPrompt } from './prompts';
import { fetchCover, placeholderCover } from '../covers';
import type { Book } from '../../types';

export interface Recommendation {
  title: string;
  author: string;
  description: string;
  coverUrl: string;
}

export async function getAIRecommendations(userBooks: Book[]): Promise<Recommendation[]> {
  if (userBooks.length === 0) return [];

  try {
    const booksList = userBooks
      .map((b) => `"${b.title}" by ${b.author} (${b.category})`)
      .join(', ');

    const response = await getClient().models.generateContent({
      model: MODELS.recommendations,
      contents: recommendationsPrompt(booksList),
      config: { responseMimeType: 'application/json', responseSchema: RECOMMENDATION_SCHEMA },
    });

    if (!response.text?.trim()) return [];

    const data = JSON.parse(response.text) as {
      recommendations?: Partial<Omit<Recommendation, 'coverUrl'>>[];
    };

    const usable = (data.recommendations ?? []).filter(
      (rec): rec is Omit<Recommendation, 'coverUrl'> =>
        typeof rec?.title === 'string' &&
        rec.title.trim().length > 0 &&
        typeof rec.author === 'string',
    );

    // allSettled, not all: one cover lookup throwing used to reject the whole
    // batch and discard all six recommendations from a call that had already
    // been paid for. A recommendation with no cover is still a recommendation.
    const settled = await Promise.allSettled(
      usable.map(async (rec) => ({ ...rec, coverUrl: await fetchCover(rec.title, rec.author) })),
    );

    return settled.map((result, index) => {
      const rec = usable[index];
      return result.status === 'fulfilled'
        ? result.value
        : { ...rec, description: rec.description ?? '', coverUrl: placeholderCover(rec.title) };
    });
  } catch (error) {
    throw toAiError(error);
  }
}
