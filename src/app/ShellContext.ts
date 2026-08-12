import { createContext, useContext } from 'react';
import type { AudioTrack } from '../components/AudioPlayer';

export interface ShellApi {
  playAudio: (track: AudioTrack) => void;
  hasAudioPlayer: boolean;
  openAddBook: () => void;
  /** Routes a missing or rejected key to the key dialog; returns a message either way. */
  handleAiError: (error: unknown) => string;
}

export const ShellContext = createContext<ShellApi | undefined>(undefined);

export function useShell(): ShellApi {
  const context = useContext(ShellContext);
  if (!context) throw new Error('useShell must be used within the AppShell');
  return context;
}
