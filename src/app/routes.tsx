import { useMemo } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppShell } from './AppShell';
import { ErrorBoundary } from './ErrorBoundary';
import { NotFoundPage } from './NotFoundPage';
import { LibraryPage } from '../features/library/LibraryPage';
import { BookDetailPage } from '../features/book/BookDetailPage';
import { ReaderPage } from '../features/book/ReaderPage';
import { StatsPage } from '../features/stats/StatsPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { ReviewPage } from '../features/review/ReviewPage';

export const routeTable = [
  {
    path: '/',
    element: <AppShell />,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, element: <LibraryPage /> },
      { path: 'book/:id', element: <BookDetailPage /> },
      { path: 'book/:id/read', element: <ReaderPage /> },
      { path: 'review', element: <ReviewPage /> },
      { path: 'stats', element: <StatsPage /> },
      { path: 'profile', element: <ProfilePage /> },
      // Without this, any address that is not one of the above fell through to
      // the error boundary and told the user the app had broken. It had not —
      // they had mistyped a URL, or followed a bookmark to a deleted book.
      { path: '*', element: <NotFoundPage /> },
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
