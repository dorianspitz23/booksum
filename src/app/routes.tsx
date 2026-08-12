import { useMemo } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppShell } from './AppShell';
import { ErrorBoundary } from './ErrorBoundary';
import { LibraryPage } from '../features/library/LibraryPage';
import { BookDetailPage } from '../features/book/BookDetailPage';
import { ReaderPage } from '../features/book/ReaderPage';
import { StatsPage } from '../features/stats/StatsPage';
import { ProfilePage } from '../features/profile/ProfilePage';

export const routeTable = [
  {
    path: '/',
    element: <AppShell />,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, element: <LibraryPage /> },
      { path: 'book/:id', element: <BookDetailPage /> },
      { path: 'book/:id/read', element: <ReaderPage /> },
      { path: 'stats', element: <StatsPage /> },
      { path: 'profile', element: <ProfilePage /> },
    ],
  },
];

export function AppRoutes() {
  // Built per mount rather than at module scope: a module-level router keeps its
  // own history, so it ignores the current URL on a remount.
  const router = useMemo(() => createBrowserRouter(routeTable), []);
  return <RouterProvider router={router} />;
}
