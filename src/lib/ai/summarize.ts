import { getClient } from './client';
import { AiError, toAiError } from './errors';
import { MODELS } from './models';
import { GENERIC_BOOK_SCHEMA, type RawBookResponse } from './schemas';
import { detailedSummaryPrompt, summarizeBookPrompt, summarizePdfPrompt } from './prompts';
import { fetchCover, placeholderCover } from '../covers';
import type { Book, Summary } from '../../types';

/**
 * The UI has always advertised a 10MB limit and nothing anywhere enforced it. A
 * larger upload was base64-encoded on the main thread, sent inline, rejected
 * with a 400, and then reported to the user as a rejected API key.
 */
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

export interface GeneratedBook {
  book: Omit<Book, 'id' | 'profileId' | 'addedAt' | 'summaryId'>;
  summary: Omit<Summary, 'id' | 'bookId'>;
}

const clamp = (value: number | undefined, min: number, max: number, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
};

/**
 * The response body is the only proof the call produced anything. Defaulting an
 * empty one to '{}' turned a blocked or truncated completion into a book made
 * entirely of fallbacks — "No summary available." — which was then persisted and
 * looked, in every list view, exactly like a real one.
 */
function parseBookResponse(text: string | undefined): RawBookResponse {
  if (!text?.trim()) {
    throw new AiError(
      'malformed',
      'Gemini returned an empty response. It may have been blocked or cut short — try again.',
    );
  }
  return JSON.parse(text) as RawBookResponse;
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
      title: data.title?.trim() || fallbackTitle,
      author: data.author?.trim() || fallbackAuthor,
      category: data.category?.trim() || 'Other',
      status,
      rating: clamp(data.rating, 0, 5, 0),
      readingTimeMinutes: clamp(data.readingTimeMinutes, 1, 120, 5),
      coverImageUrl,
      hasPdf,
      finishedAt: status === 'Finished' ? new Date().toISOString() : undefined,
    },
    summary: {
      oneSentenceTakeaway: data.oneSentenceTakeaway?.trim() || 'No takeaway available.',
      summary: data.summary?.trim() || 'No summary available.',
      keyInsights: (data.keyInsights ?? []).filter((i) => typeof i === 'string' && i.trim()),
      actionableSteps: (data.actionableSteps ?? []).filter(
        (s) => typeof s === 'string' && s.trim(),
      ),
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

    const data = parseBookResponse(response.text);
    const cover = await fetchCover(data.title || title, data.author || author || '');
    return toGenerated(data, title, author || 'Unknown', cover, 'Want to Read', false);
  } catch (error) {
    throw toAiError(error);
  }
}

export async function summarizePdf(base64Data: string): Promise<GeneratedBook> {
  // base64 inflates by roughly 4/3, so this is the size of the original bytes.
  if (base64Data.length * 0.75 > MAX_PDF_BYTES) {
    throw new AiError(
      'bad-request',
      'That PDF is larger than 10MB, which is more than Gemini accepts in one request.',
    );
  }

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

    const data = parseBookResponse(response.text);
    const title = data.title?.trim() || 'Uploaded Document';
    return toGenerated(data, title, 'Unknown Author', placeholderCover(title), 'Finished', true);
  } catch (error) {
    throw toAiError(error);
  }
}

/**
 * Streams the long-form markdown summary, calling onChunk with the text so far.
 *
 * Throws rather than returning a sentinel: this used to return the literal
 * string 'Failed to generate detailed summary.' on an empty stream, typed as a
 * successful `string`, which callers then persisted as the book's deep dive and
 * rendered in the e-reader as if it were the content.
 */
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

    if (!text.trim()) {
      throw new AiError(
        'malformed',
        'Gemini returned nothing for the full summary. It may have been blocked — try again.',
      );
    }

    return text;
  } catch (error) {
    throw toAiError(error);
  }
}
