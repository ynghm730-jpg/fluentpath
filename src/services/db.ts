import Dexie, { type Table } from 'dexie';
import type { PhraseItem, StudyRecord, ConversationSession, ReviewCard } from '../types';

export interface AppSetting {
  key: string;
  value: string;
}

export class FluentPathDB extends Dexie {
  phrases!: Table<PhraseItem, string>;
  records!: Table<StudyRecord, number>;
  settings!: Table<AppSetting, string>;
  conversations!: Table<ConversationSession, string>;
  reviews!: Table<ReviewCard, string>;

  constructor() {
    super('FluentPathDatabase');

    this.version(1).stores({
      phrases: 'id, english, *tags, isBookmarked, createdAt, lastReviewedAt',
      records: '++id, type, promptId, selfRating, date, timestamp',
      settings: 'key',
    });
    // Existing version-1 data remains intact.
    this.version(2).stores({
      phrases: 'id, english, *tags, isBookmarked, createdAt, lastReviewedAt',
      records: '++id, type, promptId, selfRating, date, timestamp',
      settings: 'key',
      conversations: 'id, date, startedAt, mode, topic',
    });
    // New store only: do not clear or rewrite existing phrases, history, or conversations.
    this.version(3).stores({
      phrases: 'id, english, *tags, isBookmarked, createdAt, lastReviewedAt',
      records: '++id, type, promptId, selfRating, date, timestamp',
      settings: 'key',
      conversations: 'id, date, startedAt, mode, topic',
      reviews: 'id, dueDate, type, updatedAt',
    }).upgrade(async (tx) => {
      const previous = await tx.table('records').toArray() as StudyRecord[];
      const latest = new Map<string, StudyRecord>();
      // Auto-import only the most recent result for each original prompt.
      previous.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || '') || (a.id || 0) - (b.id || 0));
      for (const item of previous) {
        if ((item.type === 'quick' || item.type === 'repeat') && item.promptId && item.modelAnswer) {
          latest.set(`${item.type}:${item.promptId}`, item);
        }
      }
      const now = new Date().toISOString();
      const cards: ReviewCard[] = [...latest.values()]
        .filter(r => r.selfRating === 'hard' || r.selfRating === 'good')
        .map(r => {
          const baseDate = new Date(r.timestamp);
          const date = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
          const tomorrow = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
          const dueDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
          return {
            id: `${r.type}:${r.promptId}`, type: r.type as 'quick' | 'repeat',
            promptId: r.promptId, promptText: r.promptText,
            modelAnswer: r.modelAnswer, lastResponse: r.userResponse,
            stage: 0, reviewCount: 0, dueDate, createdAt: r.timestamp || now, updatedAt: now,
          };
        });
      if (cards.length) await tx.table('reviews').bulkPut(cards);
    });
  }
}

export const db = new FluentPathDB();

// 今日の学習記録を取得するヘルパー
export async function getTodayRecords(): Promise<StudyRecord[]> {
  try {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return await db.records.where('date').equals(today).toArray();
  } catch (err) {
    console.error('Failed to load today records from IndexedDB:', err);
    return [];
  }
}

// 苦手問題（直近で 'hard' または 'good' の自己評価）を取得
export async function getWeakRecords(): Promise<StudyRecord[]> {
  try {
    return await db.records
      .where('selfRating')
      .equals('hard')
      .reverse()
      .limit(20)
      .toArray();
  } catch (err) {
    console.error('Failed to load weak records from IndexedDB:', err);
    return [];
  }
}

// 設定の読み書きヘルパー
export async function getSetting(key: string, defaultValue = ''): Promise<string> {
  try {
    const item = await db.settings.get(key);
    return item ? item.value : defaultValue;
  } catch {
    return defaultValue;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  try {
    await db.settings.put({ key, value });
  } catch (err) {
    console.error('Failed to save setting:', err);
  }
}
