import { Link } from 'react-router';
import { Compass } from 'lucide-react';

/**
 * Rendered inside the shell, so the nav stays available — an unknown address is
 * a wrong turn, not a dead end, and the user should not have to use the back
 * button to get out of it.
 */
export function NotFoundPage() {
  return (
    <div className="max-w-lg mx-auto py-24 text-center">
      <div className="w-16 h-16 mx-auto bg-orange-50 dark:bg-orange-950 rounded-full flex items-center justify-center mb-6">
        <Compass size={32} className="text-orange-700 dark:text-orange-400" />
      </div>
      <h1 className="text-2xl font-serif font-bold text-gray-900 dark:text-gray-100 mb-2">
        No such page
      </h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8">
        That address does not match anything in BookSum. If you followed a link to a book, it may
        have been deleted since.
      </p>
      <Link
        to="/"
        className="inline-block px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold shadow-lg transition-all"
      >
        Back to your library
      </Link>
    </div>
  );
}
