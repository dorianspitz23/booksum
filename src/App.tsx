import { Loader2 } from 'lucide-react';
import { AppRoutes } from './app/routes';
import { useProfile } from './features/profile/ProfileContext';
import { ProfilePicker } from './features/profile/ProfilePicker';
import { LibraryProvider } from './features/library/useLibrary';
import { ConfirmProvider } from './components/ui/ConfirmDialog';
import { ToastHost } from './components/ui/Toast';

export default function App() {
  const { profile, isLoading } = useProfile();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-parchment">
        <Loader2 className="animate-spin text-orange-700" size={40} />
      </div>
    );
  }

  // The picker deliberately renders outside the router: with no profile there is
  // no library to route around.
  if (!profile) {
    return (
      <>
        <ProfilePicker />
        <ToastHost />
      </>
    );
  }

  return (
    <LibraryProvider>
      <ConfirmProvider>
        <AppRoutes />
      </ConfirmProvider>
    </LibraryProvider>
  );
}
