// Temporary. Deleted in Task 5 once the UI reads Book/Summary from the repo.
import type { BookStatus, Priority, VoiceName } from './types';

export type { BookStatus, Priority };

export interface User {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
}

export interface UserProfile {
  name: string;
  monthlyGoal: number;
  joinedAt: string;
  bio: string;
  favoriteVoice: VoiceName;
}

export interface BookInsight {
  id: string;
  title: string;
  author: string;
  category: string;
  oneSentenceTakeaway: string;
  summary: string;
  keyInsights: string[];
  actionableSteps: string[];
  detailedSummary?: string;
  personalNotes?: string;
  coverImageUrl: string;
  rating: number;
  priority?: Priority;
  readingTimeMinutes: number;
  addedAt: string;
  status: BookStatus;
  audioData?: string;
  pdfData?: string;
}

export type ViewState =
  | 'library'
  | 'book-detail'
  | 'adding-book'
  | 'e-reader'
  | 'stats'
  | 'profile';
