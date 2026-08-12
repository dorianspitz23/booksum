import { Link, useRouteError } from 'react-router';
import { AlertCircle } from 'lucide-react';

export function ErrorBoundary() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : 'An unexpected error occurred.';

  return (
    <div className="min-h-screen bg-parchment flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
        <AlertCircle size={32} className="text-red-500" />
      </div>
      <h1 className="text-2xl font-serif font-bold text-gray-900 mb-2">Something went wrong</h1>
      <p className="text-gray-500 max-w-md mb-8">{message}</p>
      <div className="flex gap-3">
        <Link
          to="/"
          className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold shadow-lg transition-all"
        >
          Back to library
        </Link>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl font-bold transition-all"
        >
          Reload
        </button>
      </div>
    </div>
  );
}
