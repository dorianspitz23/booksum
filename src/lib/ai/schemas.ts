import { Type } from '@google/genai';
import type { Schema } from '@google/genai';

/**
 * Every bound here used to live only in a `description` string — "Array of 4
 * possible answers", "Index (0-3)", "a rating from 1 to 5" — which the model was
 * free to ignore while still returning a schema-valid response. Those were the
 * root cause of a whole cluster of downstream defects: an unbounded `options`
 * array could arrive empty and permanently deadlock the review queue, and an
 * unbounded `correctAnswerIndex` scored correct answers as wrong.
 *
 * A schema is a request rather than a guarantee, so `validate.ts` still checks
 * the response before anything is persisted. But stating the constraint where it
 * belongs makes a malformed response far less likely in the first place.
 *
 * `minItems` / `maxItems` are strings: the API carries them as proto int64.
 */
export const GENERIC_BOOK_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    author: { type: Type.STRING },
    category: {
      type: Type.STRING,
      enum: [
        'Psychology',
        'Productivity',
        'Business',
        'Technology',
        'Philosophy',
        'Health',
        'Biography',
        'Other',
      ],
      description: 'One of the listed categories.',
    },
    oneSentenceTakeaway: { type: Type.STRING },
    summary: { type: Type.STRING },
    keyInsights: { type: Type.ARRAY, items: { type: Type.STRING }, minItems: '3', maxItems: '12' },
    actionableSteps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      minItems: '3',
      maxItems: '8',
    },
    readingTimeMinutes: {
      type: Type.INTEGER,
      minimum: 1,
      maximum: 120,
      description:
        'Estimated time in minutes to read the generated summary, insights, and steps (NOT the original book). Assume 250 words per minute.',
    },
    rating: {
      type: Type.INTEGER,
      minimum: 1,
      maximum: 5,
      description: "A rating from 1 to 5 based on the book's critical acclaim and value.",
    },
  },
  required: [
    'title',
    'author',
    'category',
    'oneSentenceTakeaway',
    'summary',
    'keyInsights',
    'actionableSteps',
    'readingTimeMinutes',
    'rating',
  ],
};

export const RECOMMENDATION_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    recommendations: {
      type: Type.ARRAY,
      minItems: '6',
      maxItems: '6',
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          author: { type: Type.STRING },
          description: { type: Type.STRING },
        },
        required: ['title', 'author', 'description'],
      },
    },
  },
  required: ['recommendations'],
};

export const QUIZ_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      minItems: '3',
      maxItems: '5',
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            minItems: '4',
            maxItems: '4',
            description: 'Exactly four possible answers.',
          },
          correctAnswerIndex: {
            type: Type.INTEGER,
            minimum: 0,
            maximum: 3,
            description: 'Zero-based index of the correct answer within options.',
          },
          explanation: {
            type: Type.STRING,
            description: 'Short explanation of why the correct answer is right.',
          },
        },
        required: ['question', 'options', 'correctAnswerIndex', 'explanation'],
      },
    },
  },
  required: ['questions'],
};

/**
 * Every field is optional even though the schema marks all of them required.
 * That is deliberate and is the honest half of the contract: `required` raises
 * compliance, it does not enforce it, and a model can always omit a field or
 * return a truncated object. `summarize.ts` supplies a default for each one, so
 * this type describes what actually arrives rather than what was asked for.
 */
export interface RawBookResponse {
  title?: string;
  author?: string;
  category?: string;
  oneSentenceTakeaway?: string;
  summary?: string;
  keyInsights?: string[];
  actionableSteps?: string[];
  readingTimeMinutes?: number;
  rating?: number;
}
