/**
 * @vitest-environment node
 *
 * No DOM here, so this suite skips the jsdom window the default environment
 * builds. See src/test/setup.ts.
 */
import { describe, expect, it } from 'vitest';
import { toQuizQuestions } from './validate';

const good = {
  question: 'What is a habit stack?',
  options: ['A', 'B', 'C', 'D'],
  correctAnswerIndex: 2,
  explanation: 'Because.',
};

/**
 * Everything here is a shape the model can legally return under QUIZ_SCHEMA and
 * that the app used to persist verbatim into IndexedDB as a ReviewCard. Two of
 * them are the direct cause of live defects: an empty options array deadlocked
 * the review queue permanently, and an out-of-range index scored a correct
 * answer as wrong with no indication anything was amiss.
 */
describe('toQuizQuestions', () => {
  it('keeps a well-formed question', () => {
    expect(toQuizQuestions({ questions: [good] })).toEqual([good]);
  });

  it('drops a question with no options, which used to deadlock the review queue', () => {
    expect(toQuizQuestions({ questions: [{ ...good, options: [] }] })).toEqual([]);
  });

  it('drops a question with only one option', () => {
    expect(toQuizQuestions({ questions: [{ ...good, options: ['A'] }] })).toEqual([]);
  });

  it('drops an index past the end of options', () => {
    expect(toQuizQuestions({ questions: [{ ...good, correctAnswerIndex: 4 }] })).toEqual([]);
  });

  it('drops a negative index', () => {
    expect(toQuizQuestions({ questions: [{ ...good, correctAnswerIndex: -1 }] })).toEqual([]);
  });

  it('drops a fractional index, which indexes to undefined', () => {
    expect(toQuizQuestions({ questions: [{ ...good, correctAnswerIndex: 2.5 }] })).toEqual([]);
  });

  it('drops a question whose options are not all strings', () => {
    expect(toQuizQuestions({ questions: [{ ...good, options: ['A', 2, 'C', 'D'] }] })).toEqual([]);
  });

  it('drops a blank question', () => {
    expect(toQuizQuestions({ questions: [{ ...good, question: '   ' }] })).toEqual([]);
  });

  it('keeps the good questions and drops only the bad ones', () => {
    const result = toQuizQuestions({
      questions: [good, { ...good, options: [] }, { ...good, question: 'Second?' }],
    });
    expect(result).toHaveLength(2);
    expect(result.map((q) => q.question)).toEqual(['What is a habit stack?', 'Second?']);
  });

  it('supplies an explanation when the model omits one', () => {
    const [q] = toQuizQuestions({ questions: [{ ...good, explanation: undefined }] });
    expect(q?.explanation).toBe('No explanation was provided.');
  });

  it('returns nothing for a response that is not an object', () => {
    expect(toQuizQuestions(null)).toEqual([]);
    expect(toQuizQuestions('nope')).toEqual([]);
    expect(toQuizQuestions({})).toEqual([]);
    expect(toQuizQuestions({ questions: 'not an array' })).toEqual([]);
  });

  it('deduplicates identical questions, which collide as React keys', () => {
    expect(toQuizQuestions({ questions: [good, good] })).toHaveLength(1);
  });
});
