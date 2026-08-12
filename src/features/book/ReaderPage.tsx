import { useNavigate } from 'react-router';
import { Loader2 } from 'lucide-react';
import { EReader } from '../../components/EReader';
import { useBookRoute } from './useBookRoute';
import { useProfile } from '../profile/ProfileContext';
import { useShell } from '../../app/ShellContext';

export function ReaderPage() {
  const { book, summary, isLoading } = useBookRoute();
  const { profile } = useProfile();
  const { playAudio, hasAudioPlayer } = useShell();
  const navigate = useNavigate();

  if (isLoading || !book || !profile) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-orange-700 dark:text-orange-400" size={32} />
      </div>
    );
  }

  return (
    <EReader
      book={book}
      summary={summary}
      voice={profile.favoriteVoice}
      onClose={() => void navigate(`/book/${book.id}`)}
      onPlayAudio={playAudio}
      hasAudioPlayer={hasAudioPlayer}
    />
  );
}
