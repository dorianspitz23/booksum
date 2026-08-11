import { Type } from '@google/genai';

export const GENERIC_BOOK_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    author: { type: Type.STRING },
    category: { type: Type.STRING },
    oneSentenceTakeaway: { type: Type.STRING },
    summary: { type: Type.STRING },
    keyInsights: { type: Type.ARRAY, items: { type: Type.STRING } },
    actionableSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
    readingTimeMinutes: {
      type: Type.NUMBER,
      description:
        'Estimated time in minutes to read the generated summary, insights, and steps (NOT the original book). Assume 250 words per minute.',
    },
    rating: {
      type: Type.NUMBER,
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

export const RECOMMENDATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    recommendations: {
      type: Type.ARRAY,
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

export const QUIZ_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Array of 4 possible answers.',
          },
          correctAnswerIndex: {
            type: Type.NUMBER,
            description: 'Index (0-3) of the correct answer in the options array.',
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

/** Raw shape Gemini returns against GENERIC_BOOK_SCHEMA. Every field is optional
 *  because a model can always omit one, schema or not. */
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
