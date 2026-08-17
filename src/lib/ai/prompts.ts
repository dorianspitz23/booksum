import { CATEGORIES } from '../../types';
import type { Book, Summary } from '../../types';
// The counts live with the schema that enforces them. Stated in prose here as
// well, they drifted: this file asked for exactly three questions while the
// schema accepted three to five.
import { QUIZ_QUESTION_COUNT, QUIZ_OPTIONS_PER_QUESTION, RECOMMENDATION_COUNT } from './schemas';

export const summarizeBookPrompt = (title: string, author?: string) => `
    Analyze the non-fiction book "${title}" ${author ? `by ${author}` : ''}.

    1. **Summary**: Write a robust, multi-paragraph summary (approx. 350-500 words) covering the core thesis, major arguments, and the author's conclusion.
    2. **Key Insights**: Provide 8-12 key insights. Each insight should be a **concise paragraph** (approx. 2-3 sentences) capturing the core concept clearly without being overly wordy.
    3. **Actionable Steps**: Provide 6-8 practical steps. Each step MUST be strictly limited to a maximum of 2 sentences.
    4. **One Sentence Takeaway**: A single, punchy, memorable sentence capturing the essence of the book.

    Ensure the output matches the JSON schema provided.
    The 'category' should be one of: ${CATEGORIES.join(', ')}.
  `;

export const summarizePdfPrompt = () => `Analyze this document as a non-fiction book.

        1. **Summary**: Write a detailed summary (350+ words).
        2. **Key Insights**: Provide 8-12 insights. Each insight should be a concise paragraph (2-3 sentences).
        3. **Actionable Steps**: Provide 6-8 specific instructions. Each step MUST be strictly limited to a maximum of 2 sentences.

        Follow the JSON schema.`;

export const detailedSummaryPrompt = (book: Book, summary: Summary) => `
    Create a deep-dive "Masterclass" summary for the book "${book.title}" by ${book.author}.

    Structure the output in Markdown format with:
    1. Introduction
    2. detailed chapters/sections (use ## for headers)
    3. deep analysis of core concepts
    4. conclusion.

    Use bolding (**text**) for emphasis.
    The content should be extensive enough for a 15-minute read.
    Base it on the following brief context but expand using your general knowledge of the book:
    ${summary.summary}
    ${summary.keyInsights.join('\n')}
  `;

export const recommendationsPrompt = (booksList: string) => `
    Based on the user's library: ${booksList}, recommend ${RECOMMENDATION_COUNT} similar non-fiction books they haven't read.
    Return strictly JSON with an array of objects containing title, author, and a 1-sentence description.
  `;

export const quizPrompt = (book: Book, summary: Summary) => `
    Create a short multiple-choice quiz (${QUIZ_QUESTION_COUNT} questions, ${QUIZ_OPTIONS_PER_QUESTION} options each) to test the user's understanding of the book "${book.title}".

    Use the following context to generate the questions:
    Summary: ${summary.summary}
    Insights: ${summary.keyInsights.join('\n')}

    The questions should be conceptual and test comprehension, not just trivia.
    Return the result as a JSON object containing an array of questions.
  `;

export const chatSystemInstruction = (book: Book, summary: Summary) =>
  `You are an intelligent, friendly AI assistant designed to help the user understand the book "${book.title}" by ${book.author}.

      Here is the specific context and summary of the book:

      ONE SENTENCE TAKEAWAY:
      ${summary.oneSentenceTakeaway}

      SUMMARY:
      ${summary.summary}

      KEY INSIGHTS:
      ${summary.keyInsights.join('\n- ')}

      ACTIONABLE STEPS:
      ${summary.actionableSteps.join('\n- ')}

      Your Goal:
      - Answer questions based on the book's content provided above.
      - Help the user apply the concepts to their life.
      - If the user asks something outside the scope of this summary but relevant to the book (based on your general training), you may answer but mention that it is based on general knowledge, not the specific summary.
      - Be concise, encouraging, and clear.
      `;

/**
 * Text-to-speech bills by the character, so the length of these scripts is a
 * direct cost every time one is generated.
 *
 * "Quick Listen" used to narrate the takeaway *and the whole 350-500 word
 * summary body* — longer than the deep dive sitting beside it, and not remotely
 * quick. It is now the takeaway plus the key insights: the shape of the book in
 * about a minute, which is what the button offers. The deep dive keeps the full
 * body and the actionable steps, so the two are genuinely different lengths and
 * each label describes what you actually get.
 */
export const audioScript = (book: Book, summary: Summary, type: 'short' | 'long') =>
  type === 'short'
    ? `Here is the short version of ${book.title}. ${summary.oneSentenceTakeaway}. Here are the key insights. ${summary.keyInsights.join('. ')}`
    : `Welcome to the deep dive of ${book.title} by ${book.author}. ${summary.summary} Let's explore the key insights. ${summary.keyInsights.join('. ')}. Now, here is how you can apply this. ${summary.actionableSteps.join('. ')}`;
