import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';

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
