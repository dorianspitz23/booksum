/** WCAG 2.1 relative luminance and contrast ratio, for verifying brand colours. */

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Throws on anything that is not a hex colour, rather than returning a number.
 *
 * This is the project's own WCAG guardrail — the thing that decides whether a
 * colour pair is readable. It accepted any string at all: 'rebeccapurple' gave
 * NaN, so every comparison against a threshold came out false and the pair
 * "passed"; 'ff' gave a real, plausible, wrong number and passed on merit. A
 * checker that answers confidently for input it cannot read is worse than none,
 * because its answer is trusted.
 */
export function relativeLuminance(hex: string): number {
  const clean = hex.trim().replace(/^#/, '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Not a hex colour: ${JSON.stringify(hex)}`);
  }

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}
