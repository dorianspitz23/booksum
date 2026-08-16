import { useEffect, useState } from 'react';
import { placeholderCover } from '../lib/covers';

interface BookCoverProps {
  /** Used for the generated placeholder's initials, and as the alt text. */
  title: string;
  url: string;
  className?: string;
  /** Called once the real image loads, for parents that fade it in. */
  onLoad?: () => void;
}

/**
 * A cover that always renders something.
 *
 * `BookCard` had this logic and `BookDetail` did not, so a dead URL degraded to
 * a locally-generated placeholder in the grid and to a browser broken-image icon
 * on the book's own page, at full size. Dead URLs are the normal case rather
 * than the exception here: Goodreads imports build cover URLs from an ISBN
 * without checking that OpenLibrary has an image for it.
 *
 * The literal string 'null' is checked because the original app persisted that
 * as a cover URL, and those records survive migration.
 */
export function BookCover({ title, url, className, onLoad }: BookCoverProps) {
  const isUsable = Boolean(url) && url !== 'null';
  const [src, setSrc] = useState(() => (isUsable ? url : placeholderCover(title)));

  useEffect(() => {
    setSrc(Boolean(url) && url !== 'null' ? url : placeholderCover(title));
  }, [url, title]);

  return (
    <img
      src={src}
      alt={title}
      className={className}
      onLoad={onLoad}
      onError={() => setSrc(placeholderCover(title))}
    />
  );
}
