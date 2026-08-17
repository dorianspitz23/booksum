import { useMemo } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import type { RouteObject } from 'react-router';
import { AppShell } from './AppShell';
import { ErrorBoundary } from './ErrorBoundary';
import { NotFoundPage } from './NotFoundPage';
import { LibraryPage } from '../features/library/LibraryPage';
import { BookDetailPage } from '../features/book/BookDetailPage';
import { ReaderPage } from '../features/book/ReaderPage';
import { StatsPage } from '../features/stats/StatsPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { ReviewPage } from '../features/review/ReviewPage';
import { routePatterns } from './paths';

/**
 * Annotated rather than inferred. Without `RouteObject[]` TypeScript widens this
 * to its own literal shape, which turns off excess-property checking across the
 * whole tree: a misspelt `errorElment`, or a `loader` on a route that has none,
 * compiled cleanly and was silently ignored at runtime.
 */
export const routeTable: RouteObject[] = [
  {
    path: routePatterns.library,
    element: <AppShell />,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, element: <LibraryPage /> },
      { path: routePatterns.book, element: <BookDetailPage /> },
      { path: routePatterns.reader, element: <ReaderPage /> },
      { path: routePatterns.review, element: <ReviewPage /> },
      { path: routePatterns.stats, element: <StatsPage /> },
      { path: routePatterns.profile, element: <ProfilePage /> },
      // Without this, any address that is not one of the above fell through to
      // the error boundary and told the user the app had broken. It had not —
      // they had mistyped a URL, or followed a bookmark to a deleted book.
      { path: routePatterns.notFound, element: <NotFoundPage /> },
    ],
  },
];

/**
 * Vite's BASE_URL, minus its trailing slash, is exactly what react-router wants
 * as a basename. Without it a project-page deploy (served from /<repo>/) resolves
 * every route against the domain root instead, so the app builds and deploys and
 * then 404s on load. Defaults to '' at the domain root, which is a no-op.
 */
export const basename = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');

export function AppRoutes() {
  // Built per mount rather than at module scope: a module-level router keeps its
  // own history, so it ignores the current URL on a remount.
  const router = useMemo(() => createBrowserRouter(routeTable, { basename }), []);
  return <RouterProvider router={router} />;
}
