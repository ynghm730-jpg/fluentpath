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


// AI英会話：回答を含む会話履歴は端末にのみ保存
export type ConversationMode = 'ai' | 'script' | 'meeting_script' | 'meeting_ai';
export type ConversationLevel = 'B1' | 'B2';
export type ConversationTopic = 'cafe' | 'airport' | 'hotel' | 'meeting' | 'intro' | 'travel';
export interface ConversationTurn { role: 'assistant' | 'user'; text: string; }
// Old saved reviews may lack turnNumber / goodPoint. New reviews include both.
export interface ConversationCorrection {
  original: string;
  revised: string;
  japanese: string;
  explanation: string;
  turnNumber?: number;
  goodPoint?: string;
}
export interface ConversationFeedback {
  positive: string[];
  corrections: ConversationCorrection[];
  summary: string;
  nextStep: string;
}
export type MeetingScenarioId = 'progress' | 'technical' | 'schedule' | 'support' | 'opinions' | 'questions';
export interface ConversationSession {
  id: string;
  date: string;
  startedAt: string;
  mode: ConversationMode;
  level: ConversationLevel;
  topic: ConversationTopic;
  turns: ConversationTurn[];
  // Phase 6B-1: 既存の会話履歴と同じIndexedDBで保存。
  meetingScenarioId?: MeetingScenarioId;
  meetingSelfRating?: SelfRating;
  feedback?: ConversationFeedback;
}

// Phase 4: Spaced repetition is stored locally, separately from raw practice history.
export interface ReviewCard {
  id: string; // `${type}:${promptId}`
  type: 'quick' | 'repeat';
  promptId: string;
  promptText: string;
  modelAnswer: string;
  lastResponse: string;
  stage: number;
  reviewCount: number;
  dueDate: string; // YYYY-MM-DD, local date
  createdAt: string;
  updatedAt: string;
  lastReviewedAt?: string;
}


// Phase 6A: Geminiを使わないクイックレスポンスの回答記録。
// startLatencyMs は「問題表示→最初の文字入力/音声認識結果」までの参考値。
// Web Speech APIの都合上、実際の発話開始時刻と一致するとは限りません。
export interface QuickResponseAttempt {
  id: string;
  sessionId: string;
  questionId: string;
  category: 'business' | 'daily';
  question: string;
  answer: string;
  inputMode: 'voice' | 'text' | 'none';
  limitSeconds: 3 | 5 | 10;
  startLatencyMs: number | null;
  responseTimeMs: number;
  withinLimit: boolean;
  selfRating: SelfRating;
  date: string;
  timestamp: string;
}
