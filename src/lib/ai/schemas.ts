import { Type } from '@google/genai';
import type { Schema } from '@google/genai';
import { CATEGORIES } from '../../types';

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

/**
 * Shape constants shared by the schemas below and the prose in `prompts.ts`.
 *
 * These were stated twice and disagreed: the quiz prompt asked for exactly
 * three questions while the schema accepted three to five, so a five-question
 * quiz was simultaneously wrong (per the prompt) and valid (per the schema),
 * and nothing could tell you which. Now the prompt is built from the same
 * numbers the schema enforces, and changing one changes both.
 */
export const QUIZ_QUESTION_COUNT = 3;
export const QUIZ_OPTIONS_PER_QUESTION = 4;
export const RECOMMENDATION_COUNT = 6;

export const GENERIC_BOOK_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    author: { type: Type.STRING },
    category: {
      type: Type.STRING,
      // From types.ts, where the list lives. It used to be written out here,
      // again in prompts.ts, and a third time as a dead `enum Category`.
      enum: [...CATEGORIES],
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
      minItems: String(RECOMMENDATION_COUNT),
      maxItems: String(RECOMMENDATION_COUNT),
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
      minItems: String(QUIZ_QUESTION_COUNT),
      maxItems: String(QUIZ_QUESTION_COUNT),
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            minItems: String(QUIZ_OPTIONS_PER_QUESTION),
            maxItems: String(QUIZ_OPTIONS_PER_QUESTION),
            description: `Exactly ${QUIZ_OPTIONS_PER_QUESTION} possible answers.`,
          },
          correctAnswerIndex: {
            type: Type.INTEGER,
            minimum: 0,
            maximum: QUIZ_OPTIONS_PER_QUESTION - 1,
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
