import Dexie, { type Table } from 'dexie';
import type { PhraseItem, StudyRecord, ConversationSession } from '../types';

export interface AppSetting {
  key: string;
  value: string;
}

export class FluentPathDB extends Dexie {
  phrases!: Table<PhraseItem, string>;
  records!: Table<StudyRecord, number>;
  settings!: Table<AppSetting, string>;
  conversations!: Table<ConversationSession, string>;

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
  }
}

export const db = new FluentPathDB();

// 今日の学習記録を取得するヘルパー
export async function getTodayRecords(): Promise<StudyRecord[]> {
  try {
    const today = new Date().toISOString().split('T')[0];
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
