import { describe, expect, it } from 'vitest';
import { slugify } from './download';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Atomic Habits')).toBe('atomic-habits');
  });

  it('strips punctuation and collapses separators', () => {
    expect(slugify('Sapiens: A Brief History!!')).toBe('sapiens-a-brief-history');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  --Deep Work--  ')).toBe('deep-work');
  });

  it('falls back for an empty result', () => {
    expect(slugify('!!!')).toBe('untitled');
  });

  it('caps the length', () => {
    expect(slugify('a'.repeat(200)).length).toBeLessThanOrEqual(60);
  });
});
