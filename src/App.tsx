import { Loader2 } from 'lucide-react';
import { AppRoutes } from './app/routes';
import { useProfile } from './features/profile/ProfileContext';
import { ProfilePicker } from './features/profile/ProfilePicker';
import { LibraryProvider } from './features/library/useLibrary';
import { ReviewQueueProvider } from './features/review/useReviewQueue';
import { ConfirmProvider } from './components/ui/ConfirmDialog';
import { ToastHost } from './components/ui/Toast';

export default function App() {
  const { profile, isLoading } = useProfile();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-parchment dark:bg-night">
        <Loader2 className="animate-spin text-orange-700 dark:text-orange-400" size={40} />
      </div>
    );
  }

  // ConfirmProvider wraps both branches. It used to sit inside the profile branch
  // only, which is why deleting a profile -- the single most destructive action in
  // the app, since it cascades to every book, summary, blob and review card --
  // could not ask for confirmation: useConfirm would have thrown on that screen.
  return (
    <ConfirmProvider>
      {profile ? (
        <LibraryProvider>
          <ReviewQueueProvider>
            <AppRoutes />
          </ReviewQueueProvider>
        </LibraryProvider>
      ) : (
        // The picker deliberately renders outside the router: with no profile
        // there is no library to route around.
        <>
          <ProfilePicker />
          <ToastHost />
        </>
      )}
    </ConfirmProvider>
  );
}
