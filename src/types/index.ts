export type PracticeType = 'quick' | 'repeat' | 'phrase';

export type SelfRating = 'perfect' | 'good' | 'hard';

export interface QuickPrompt {
  id: string;
  japanese: string;
  english: string;
  acceptableAnswers?: string[];
  notes?: string;
  keyPoints?: string;
  category: 'business' | 'daily';
  tags: string[];
  difficulty: 'B1';
}

export interface RepeatSentence {
  id: string;
  english: string;
  japanese: string;
  wordCount: number;
  category: 'business' | 'daily';
  tags: string[];
  audioTip?: string;
}

export interface PhraseItem {
  id: string;
  english: string;
  japanese: string;
  notes?: string;
  tags: string[];
  isBookmarked: boolean;
  reviewCount: number;
  lastReviewedAt?: string;
  createdAt: string;
}

export interface StudyRecord {
  id?: number; // IndexedDB auto-increment
  type: PracticeType;
  promptId: string;
  promptText: string;
  userResponse: string;
  modelAnswer: string;
  selfRating: SelfRating;
  responseTimeMs: number;
  similarityScore?: number; // 0-100%
  timestamp: string; // ISO string
  date: string; // YYYY-MM-DD
}

export interface DailyGoalProgress {
  date: string;
  quickCount: number;
  repeatCount: number;
  phraseCount: number;
  totalTimeSeconds: number;
}

export interface AiReviewResult {
  original: string;
  revised: string;
  revisedJapanese: string;
  grammarExplanation: string;
  naturalPhrasing: string;
  positiveFeedback: string;
}

export interface AiReviewRequest {
  userEnglish: string;
  japanesePrompt?: string;
  modelAnswer?: string;
  model?: string;
}
