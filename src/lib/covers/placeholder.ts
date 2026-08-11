/** A deterministic, dependency-free cover. Replaces the ui-avatars.com calls. */
export function placeholderCover(title: string): string {
  const initials =
    title
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase() || '?';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><rect width="300" height="400" fill="#f97316"/><text x="150" y="200" font-family="Georgia,serif" font-size="120" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${initials}</text></svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
