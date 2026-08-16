import { Link, isRouteErrorResponse, useRouteError } from 'react-router';
import { AlertCircle } from 'lucide-react';

export function ErrorBoundary() {
  const error = useRouteError();

  /**
   * The raw message used to go straight onto the screen. That is either
   * meaningless to the reader ("Cannot read properties of undefined") or too
   * meaningful — SDK errors carry request URLs, and this renders whatever a
   * crash happens to bring with it.
   *
   * A wrong URL is the common case and deserves its own words: with the
   * catch-all route added alongside this, mistyping an address now says so
   * instead of claiming the app broke.
   */
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const title = notFound ? 'No such page' : 'Something went wrong';
  const message = notFound
    ? 'That address does not match anything in BookSum. It may be a link to a book you have since deleted.'
    : 'This page failed to load. Your library is safe — nothing has been deleted.';

  // Kept for whoever is debugging, out of the reader's way.
  if (error) console.error('[booksum] route error', error);

  return (
    <div className="min-h-screen bg-parchment dark:bg-night flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-red-50 dark:bg-red-950 rounded-full flex items-center justify-center mb-6">
        <AlertCircle size={32} className="text-red-500" />
      </div>
      <h1 className="text-2xl font-serif font-bold text-gray-900 dark:text-gray-100 mb-2">
        {title}
      </h1>
      <p className="text-gray-500 dark:text-gray-400 max-w-md mb-8">{message}</p>
      <div className="flex gap-3">
        <Link
          to="/"
          className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold shadow-lg transition-all"
        >
          Back to library
        </Link>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl font-bold transition-all"
        >
          Reload
        </button>
      </div>
    </div>
  );
}
