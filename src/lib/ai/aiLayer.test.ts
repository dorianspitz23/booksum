/**
 * @vitest-environment node
 *
 * Integration tests for the AI layer as a seam.
 *
 * These eight modules carry more findings than anything else in the codebase and
 * had no tests at all — every one of them turns opaque model output into records
 * that get persisted forever, and every failure mode was verified by reading
 * rather than by running.
 *
 * The Gemini client is faked at `getClient`, the single choke point all of them
 * go through. That means real prompt construction, real schema wiring, real
 * response parsing and real error mapping run — only the network is replaced.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as AiClientModule from './client';
import type { Book, Summary } from '../../types';

const gemini = vi.hoisted(() => ({
  generateContent: vi.fn(),
  generateContentStream: vi.fn(),
  createChat: vi.fn(),
  getClient: vi.fn(),
}));

vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal<typeof AiClientModule>();
  return {
    ...actual,
    getClient: gemini.getClient,
  };
});

// Covers are a separate network boundary with their own tests; stubbed here so
// these assertions are about the AI layer rather than about Google Books.
vi.mock('../covers', () => ({
  fetchCover: vi.fn(() => Promise.resolve('https://example.test/cover.jpg')),
  placeholderCover: vi.fn(() => 'data:image/svg+xml,placeholder'),
}));

const { summarizeBook, generateDetailedSummary, MAX_PDF_BYTES, summarizePdf } =
  await import('./summarize');
const { generateBookQuiz } = await import('./quiz');
const { getAIRecommendations } = await import('./recommend');
const { generateAudioSummary } = await import('./tts');
const { createBookChatSession } = await import('./chat');

const book: Book = {
  id: 'book-1',
  profileId: 'profile-1',
  title: 'Atomic Habits',
  author: 'James Clear',
  category: 'Productivity',
  status: 'Finished',
  rating: 5,
  coverImageUrl: '',
  addedAt: '2026-01-01T00:00:00.000Z',
  readingTimeMinutes: 12,
  hasPdf: false,
};

const summary: Summary = {
  id: 'summary-1',
  bookId: 'book-1',
  oneSentenceTakeaway: 'Small changes compound.',
  summary: 'A book about habits.',
  keyInsights: ['Start small.'],
  actionableSteps: ['Do one thing.'],
  generatedAt: '2026-01-01T00:00:00.000Z',
  model: 'test',
};

/** An error shaped the way the Gemini SDK shapes them. */
function apiError(status: number, message = 'boom') {
  return Object.assign(new Error(message), { status });
}

beforeEach(() => {
  gemini.getClient.mockReturnValue({
    models: {
      generateContent: gemini.generateContent,
      generateContentStream: gemini.generateContentStream,
    },
    chats: { create: gemini.createChat },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('summarizeBook', () => {
  it('turns a model response into a Book and a Summary', async () => {
    gemini.generateContent.mockResolvedValue({
      text: JSON.stringify({
        title: 'Atomic Habits',
        author: 'James Clear',
        category: 'Productivity',
        oneSentenceTakeaway: 'Small changes compound.',
        summary: 'A book about habits.',
        keyInsights: ['Start small.'],
        actionableSteps: ['Do one thing.'],
        readingTimeMinutes: 12,
      }),
    });

    const result = await summarizeBook('Atomic Habits', 'James Clear');

    expect(result.book.title).toBe('Atomic Habits');
    expect(result.book.coverImageUrl).toBe('https://example.test/cover.jpg');
    expect(result.summary.keyInsights).toEqual(['Start small.']);
    expect(result.summary.model).toContain('gemini');
  });

  it('sends the response schema, so the model cannot answer with prose', async () => {
    gemini.generateContent.mockResolvedValue({ text: '{"title":"X","author":"Y"}' });

    await summarizeBook('X');

    const call = gemini.generateContent.mock.calls[0]?.[0] as {
      config?: { responseMimeType?: string; responseSchema?: unknown };
    };
    expect(call.config?.responseMimeType).toBe('application/json');
    expect(call.config?.responseSchema).toBeDefined();
  });

  it('drops non-string entries the model puts in the insight arrays', async () => {
    gemini.generateContent.mockResolvedValue({
      text: JSON.stringify({
        title: 'X',
        author: 'Y',
        keyInsights: ['real', 42, null, '  ', 'also real'],
        actionableSteps: [{ nested: true }, 'a step'],
      }),
    });

    const result = await summarizeBook('X');

    // These are rendered straight into a list; a number or an object here reaches
    // React as a child it cannot render.
    expect(result.summary.keyInsights).toEqual(['real', 'also real']);
    expect(result.summary.actionableSteps).toEqual(['a step']);
  });

  it('maps a rejected key to invalid-key rather than a generic failure', async () => {
    gemini.generateContent.mockRejectedValue(apiError(403, 'referrer blocked'));

    await expect(summarizeBook('X')).rejects.toMatchObject({ kind: 'invalid-key' });
  });

  it('maps a rate limit to rate-limited, not to exhausted quota', async () => {
    // Gemini's 429 body reads "You exceeded your current quota", so a substring
    // check sent people to AI Studio over a limit that clears in a minute.
    gemini.generateContent.mockRejectedValue(apiError(429, 'You exceeded your current quota'));

    await expect(summarizeBook('X')).rejects.toMatchObject({ kind: 'rate-limited' });
  });

  it('maps a retired model to model-unavailable', async () => {
    gemini.generateContent.mockRejectedValue(apiError(404, 'model not found'));

    await expect(summarizeBook('X')).rejects.toMatchObject({ kind: 'model-unavailable' });
  });

  it('rejects rather than fabricating a book from an empty completion', async () => {
    // `response.text || '{}'` used to erase a blocked or truncated completion and
    // return a complete-looking book made of placeholder strings, which was then
    // persisted and shown as if the model had written it.
    gemini.generateContent.mockResolvedValue({ text: '' });

    await expect(summarizeBook('X')).rejects.toBeInstanceOf(Error);
  });

  it('reports unparseable JSON as malformed', async () => {
    gemini.generateContent.mockResolvedValue({ text: 'Sure! Here is your book: {oops' });

    await expect(summarizeBook('X')).rejects.toMatchObject({ kind: 'malformed' });
  });
});

describe('summarizePdf', () => {
  it('refuses an oversized file without spending a request', async () => {
    // base64 inflates by ~4/3, so this is just over the real byte limit.
    const tooBig = 'A'.repeat(Math.ceil((MAX_PDF_BYTES / 0.75) * 1.01));

    await expect(summarizePdf(tooBig)).rejects.toMatchObject({ kind: 'bad-request' });
    expect(gemini.generateContent).not.toHaveBeenCalled();
  });

  it('sends a file part for a PDF within the limit', async () => {
    gemini.generateContent.mockResolvedValue({ text: '{"title":"X","author":"Y"}' });

    await summarizePdf('QUJD');

    expect(gemini.generateContent).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(gemini.generateContent.mock.calls[0]?.[0])).toContain('QUJD');
  });
});

describe('generateDetailedSummary', () => {
  it('streams chunks to the caller and returns the whole text', async () => {
    // A sync generator is a valid async iterable via for-await, and it avoids an
    // async generator whose body has nothing to await.
    gemini.generateContentStream.mockResolvedValue(
      (function* () {
        yield { text: 'First. ' };
        yield { text: 'Second.' };
      })(),
    );

    const chunks: string[] = [];
    const result = await generateDetailedSummary(book, summary, (soFar) => chunks.push(soFar));

    expect(result).toBe('First. Second.');
    // Cumulative, not incremental: the reader renders what it is handed.
    expect(chunks.at(-1)).toBe('First. Second.');
  });

  it('throws on an empty stream rather than returning a failure sentinel', async () => {
    // This used to return the literal string 'Failed to generate detailed
    // summary.' typed as a successful result, which callers persisted as the
    // book's deep dive and the reader rendered as content.
    gemini.generateContentStream.mockResolvedValue(
      (function* () {
        // Yields nothing: the model answered, with no content.
      })(),
    );

    await expect(generateDetailedSummary(book, summary, () => {})).rejects.toBeInstanceOf(Error);
  });
});

describe('generateBookQuiz', () => {
  it('returns validated questions', async () => {
    gemini.generateContent.mockResolvedValue({
      text: JSON.stringify({
        questions: [
          {
            question: 'What compounds?',
            options: ['Habits', 'Debt', 'Interest', 'All of them'],
            correctAnswerIndex: 0,
            explanation: 'Because.',
          },
        ],
      }),
    });

    const questions = await generateBookQuiz(book, summary);

    expect(questions).toHaveLength(1);
    expect(questions[0]?.correctAnswerIndex).toBe(0);
  });

  it('drops a question whose correct answer is out of range', async () => {
    // Persisted as a review card, this scores every answer wrong forever.
    gemini.generateContent.mockResolvedValue({
      text: JSON.stringify({
        questions: [
          { question: 'A', options: ['a', 'b'], correctAnswerIndex: 9, explanation: '' },
          { question: 'B', options: ['a', 'b'], correctAnswerIndex: 1, explanation: 'ok' },
        ],
      }),
    });

    const questions = await generateBookQuiz(book, summary);

    expect(questions).toHaveLength(1);
    expect(questions[0]?.question).toBe('B');
  });

  it('drops a question with no options, which deadlocks the review queue', async () => {
    gemini.generateContent.mockResolvedValue({
      text: JSON.stringify({
        questions: [{ question: 'A', options: [], correctAnswerIndex: 0, explanation: '' }],
      }),
    });

    await expect(generateBookQuiz(book, summary)).rejects.toBeInstanceOf(Error);
  });
});

describe('getAIRecommendations', () => {
  it('returns nothing for an empty library without calling the model', async () => {
    await expect(getAIRecommendations([])).resolves.toEqual([]);
    expect(gemini.generateContent).not.toHaveBeenCalled();
  });

  it('keeps the rest when one recommendation is missing a title', async () => {
    gemini.generateContent.mockResolvedValue({
      text: JSON.stringify({
        recommendations: [
          { title: 'Deep Work', author: 'Cal Newport', description: 'Focus.' },
          { author: 'Nobody', description: 'No title at all.' },
          { title: 'Range', author: 'David Epstein', description: 'Breadth.' },
        ],
      }),
    });

    const results = await getAIRecommendations([book]);

    // An untitled entry used to throw inside the cover lookup and discard all
    // six results from a call that had already been paid for.
    expect(results.map((r) => r.title)).toEqual(['Deep Work', 'Range']);
  });

  it('returns an empty list rather than throwing on an empty completion', async () => {
    gemini.generateContent.mockResolvedValue({ text: '' });

    await expect(getAIRecommendations([book])).resolves.toEqual([]);
  });
});

describe('generateAudioSummary', () => {
  it('uses the voice it is given rather than a hardcoded one', async () => {
    gemini.generateContent.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [{ inlineData: { data: btoa('fake pcm'), mimeType: 'audio/L16;rate=24000' } }],
          },
        },
      ],
    });

    await generateAudioSummary(book, summary, 'short', 'Puck');

    // favoriteVoice was a settable profile field that this function ignored,
    // narrating everything as 'Kore' whatever the user chose.
    expect(JSON.stringify(gemini.generateContent.mock.calls[0]?.[0])).toContain('Puck');
  });

  it('rejects when the model returns no audio part', async () => {
    gemini.generateContent.mockResolvedValue({ candidates: [{ content: { parts: [] } }] });

    await expect(generateAudioSummary(book, summary, 'short', 'Kore')).rejects.toBeInstanceOf(
      Error,
    );
  });
});

describe('createBookChatSession', () => {
  it('opens a session primed with the book, and asks for no key until used', () => {
    gemini.createChat.mockReturnValue({ sendMessageStream: vi.fn() });

    createBookChatSession(book, summary);

    const config = JSON.stringify(gemini.createChat.mock.calls[0]?.[0]);
    expect(config).toContain('Atomic Habits');
    expect(config).toContain('gemini');
  });
});
