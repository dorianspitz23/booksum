
export type BookStatus = 'Finished' | 'Want to Read';
export type Priority = 'Low' | 'Medium' | 'High';

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
  favoriteVoice: 'Kore' | 'Puck' | 'Zephyr' | 'Charon' | 'Fenrir';
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
  rating: number; // User rating 1-5
  priority?: Priority; // Priority for 'Want to Read'
  readingTimeMinutes: number;
  addedAt: string;
  status: BookStatus;
  audioData?: string;
  pdfData?: string; // Base64 encoded PDF data
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number; // 0-3
  explanation: string;
}

export type ViewState = 'library' | 'book-detail' | 'adding-book' | 'e-reader' | 'stats' | 'profile';

export enum Category {
  PSYCHOLOGY = 'Psychology',
  PRODUCTIVITY = 'Productivity',
  BUSINESS = 'Business',
  TECHNOLOGY = 'Technology',
  PHILOSOPHY = 'Philosophy',
  HEALTH = 'Health',
  BIOGRAPHY = 'Biography',
  OTHER = 'Other'
}