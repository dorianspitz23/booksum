import { getClient } from './client';
import { toAiError } from './errors';
import { MODELS } from './models';
import { GENERIC_BOOK_SCHEMA, type RawBookResponse } from './schemas';
import { detailedSummaryPrompt, summarizeBookPrompt, summarizePdfPrompt } from './prompts';
import { fetchCover, placeholderCover } from '../covers';
import type { Book, Summary } from '../../types';

export interface GeneratedBook {
  book: Omit<Book, 'id' | 'profileId' | 'addedAt' | 'summaryId'>;
  summary: Omit<Summary, 'id' | 'bookId'>;
}

function toGenerated(
  data: RawBookResponse,
  fallbackTitle: string,
  fallbackAuthor: string,
  coverImageUrl: string,
  status: Book['status'],
  hasPdf: boolean,
): GeneratedBook {
  return {
    book: {
      title: data.title || fallbackTitle,
      author: data.author || fallbackAuthor,
      category: data.category || 'Other',
      status,
      rating: data.rating ?? 0,
      readingTimeMinutes: data.readingTimeMinutes ?? 5,
      coverImageUrl,
      hasPdf,
    },
    summary: {
      oneSentenceTakeaway: data.oneSentenceTakeaway || 'No takeaway available.',
      summary: data.summary || 'No summary available.',
      keyInsights: data.keyInsights ?? [],
      actionableSteps: data.actionableSteps ?? [],
      generatedAt: new Date().toISOString(),
      model: MODELS.summary,
    },
  };
}

export async function summarizeBook(title: string, author?: string): Promise<GeneratedBook> {
  try {
    const response = await getClient().models.generateContent({
      model: MODELS.summary,
      contents: summarizeBookPrompt(title, author),
      config: { responseMimeType: 'application/json', responseSchema: GENERIC_BOOK_SCHEMA },
    });

    const data = JSON.parse(response.text || '{}') as RawBookResponse;
    const cover = await fetchCover(data.title || title, data.author || author || '');
    return toGenerated(data, title, author || 'Unknown', cover, 'Want to Read', false);
  } catch (error) {
    throw toAiError(error);
  }
}

export async function summarizePdf(base64Data: string): Promise<GeneratedBook> {
  try {
    const response = await getClient().models.generateContent({
      model: MODELS.summary,
      contents: {
        parts: [
          { inlineData: { mimeType: 'application/pdf', data: base64Data } },
          { text: summarizePdfPrompt() },
        ],
      },
      config: { responseMimeType: 'application/json', responseSchema: GENERIC_BOOK_SCHEMA },
    });

    const data = JSON.parse(response.text || '{}') as RawBookResponse;
    const title = data.title || 'Uploaded Document';
    return toGenerated(data, title, 'Unknown Author', placeholderCover(title), 'Finished', true);
  } catch (error) {
    throw toAiError(error);
  }
}

/** Streams the long-form markdown summary, calling onChunk with the text so far. */
export async function generateDetailedSummary(
  book: Book,
  summary: Summary,
  onChunk?: (textSoFar: string) => void,
): Promise<string> {
  try {
    const stream = await getClient().models.generateContentStream({
      model: MODELS.detailedSummary,
      contents: detailedSummaryPrompt(book, summary),
    });

    let text = '';
    for await (const chunk of stream) {
      text += chunk.text ?? '';
      onChunk?.(text);
    }

    return text || 'Failed to generate detailed summary.';
  } catch (error) {
    throw toAiError(error);
  }
}
