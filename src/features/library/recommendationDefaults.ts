import type { Recommendation } from '../../lib/ai/recommend';

export const RECS_CACHE_KEY = 'booksum.recs';
export const RECS_TTL_MS = 24 * 60 * 60 * 1000;

/** Shown before the user has generated their own. ISBN-based cover URLs are stable. */
export const RECOMMENDED_BOOKS: Recommendation[] = [
  {
    title: 'The Psychology of Money',
    author: 'Morgan Housel',
    description: "Timeless lessons on wealth, greed, and happiness. It's about how you behave.",
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780857197689-L.jpg',
  },
  {
    title: 'Deep Work',
    author: 'Cal Newport',
    description: 'Rules for focused success in a distracted world.',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9781455586691-L.jpg',
  },
  {
    title: 'Sapiens',
    author: 'Yuval Noah Harari',
    description: 'A brief history of humankind from the Stone Age to the Silicon Age.',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780062316097-L.jpg',
  },
  {
    title: 'Essentialism',
    author: 'Greg McKeown',
    description: 'The disciplined pursuit of less. Getting the right things done.',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780804137386-L.jpg',
  },
  {
    title: 'Thinking, Fast and Slow',
    author: 'Daniel Kahneman',
    description:
      'The two systems that drive the way we think. System 1 is fast, intuitive, and emotional.',
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780374275631-L.jpg',
  },
  {
    title: "Man's Search for Meaning",
    author: 'Viktor E. Frankl',
    description: "Psychiatrist Viktor Frankl's memoir has riveted generations of readers.",
    coverUrl: 'https://covers.openlibrary.org/b/isbn/9780807014271-L.jpg',
  },
];
