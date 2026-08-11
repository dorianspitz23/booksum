import { getClient } from './client';
import { toAiError } from './errors';
import { MODELS } from './models';
import { RECOMMENDATION_SCHEMA } from './schemas';
import { recommendationsPrompt } from './prompts';
import { fetchCover } from '../covers';
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

    const data = JSON.parse(response.text || '{}') as {
      recommendations?: Omit<Recommendation, 'coverUrl'>[];
    };

    return Promise.all(
      (data.recommendations ?? []).map(async (rec) => ({
        ...rec,
        coverUrl: await fetchCover(rec.title, rec.author),
      })),
    );
  } catch (error) {
    throw toAiError(error);
  }
}
