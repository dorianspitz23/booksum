/**
 * @vitest-environment node
 *
 * No DOM here, so this suite skips the jsdom window the default environment
 * builds. See src/test/setup.ts.
 */
import { describe, expect, it } from 'vitest';
import { contrastRatio, relativeLuminance } from './contrast';

const PARCHMENT = '#fcfcf9';
const ORANGE_600 = '#ea580c';
const ORANGE_700 = '#c2410c';
const WHITE = '#ffffff';

describe('contrastRatio', () => {
  it('rates black on white at 21:1', () => {
    expect(Math.round(contrastRatio('#000000', WHITE))).toBe(21);
  });

  it('rates a colour against itself at 1:1', () => {
    expect(contrastRatio(WHITE, WHITE)).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio(ORANGE_700, PARCHMENT)).toBeCloseTo(
      contrastRatio(PARCHMENT, ORANGE_700),
      10,
    );
  });
});

describe('brand text colours meet WCAG AA', () => {
  it('confirms orange-600 body text did not pass, which is why it was replaced', () => {
    expect(contrastRatio(ORANGE_600, PARCHMENT)).toBeLessThan(4.5);
  });

  it('passes AA for normal text with orange-700 on the parchment background', () => {
    expect(contrastRatio(ORANGE_700, PARCHMENT)).toBeGreaterThanOrEqual(4.5);
  });

  it('passes AA for white on the orange-600 button fill', () => {
    // Buttons use large bold text, so the 3:1 large-text threshold applies.
    expect(contrastRatio(WHITE, ORANGE_600)).toBeGreaterThanOrEqual(3);
  });
});

describe('dark theme meets WCAG AA', () => {
  const NIGHT = '#14110f';

  it('passes for body text on the night background', () => {
    expect(contrastRatio('#f3f4f6', NIGHT)).toBeGreaterThanOrEqual(4.5);
  });

  it('passes for the dark-mode accent on the night background', () => {
    expect(contrastRatio('#fb923c', NIGHT)).toBeGreaterThanOrEqual(4.5);
  });

  it('confirms the light-mode accent would have failed in dark', () => {
    expect(contrastRatio('#c2410c', NIGHT)).toBeLessThan(4.5);
  });
});

describe('rejecting input it cannot read', () => {
  // This module is the project's own accessibility guardrail, so a wrong answer
  // here is worse than no answer: it gets trusted. Both failure shapes below
  // used to produce a number and "pass".
  it.each([
    ['a named colour', 'rebeccapurple'],
    ['an rgb() string', 'rgb(255, 0, 0)'],
    ['a truncated hex', 'ff'],
    ['a five-digit hex', '#12345'],
    ['nonsense', 'not a colour'],
    ['empty', ''],
  ])('throws on %s', (_label, value) => {
    expect(() => relativeLuminance(value)).toThrow(/not a hex colour/i);
  });

  it('still accepts the forms that are real', () => {
    expect(relativeLuminance('#fff')).toBeCloseTo(1, 5);
    expect(relativeLuminance('000000')).toBeCloseTo(0, 5);
    expect(relativeLuminance('  #FFFFFF  ')).toBeCloseTo(1, 5);
  });
});
