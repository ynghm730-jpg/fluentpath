import type { PhraseItem, StudyRecord, ConversationSession, ReviewCard } from '../types';
import { db } from './db';
import { REVIEW_INTERVAL_DAYS } from './review';

const BACKUP_FORMAT_VERSION = 1;
const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
const isObject = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string';
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isString);

export interface BackupPayload {
  app: 'FluentPath';
  version: 1;
  exportedAt: string;
  data: {
    phrases: PhraseItem[];
    records: StudyRecord[];
    conversations: ConversationSession[];
    reviews: ReviewCard[];
  };
}

// Secrets intentionally excluded: IndexedDB settings and browser local/sessionStorage.
export async function createBackup(): Promise<BackupPayload> {
  const [phrases, records, conversations, reviews] = await Promise.all([
    db.phrases.toArray(), db.records.toArray(), db.conversations.toArray(), db.reviews.toArray(),
  ]);
  return {
    app: 'FluentPath', version: BACKUP_FORMAT_VERSION, exportedAt: new Date().toISOString(),
    data: { phrases, records, conversations, reviews },
  };
}

export function downloadBackup(payload: BackupPayload): void {
  const json = JSON.stringify(payload, null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `FluentPath_Backup_${new Date().toLocaleDateString('sv-SE')}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function validPhrase(v: unknown): v is PhraseItem {
  return isObject(v) && isString(v.id) && isString(v.english) && isString(v.japanese)
    && isStringArray(v.tags) && typeof v.isBookmarked === 'boolean'
    && isNumber(v.reviewCount) && isString(v.createdAt);
}
function validRecord(v: unknown): v is StudyRecord {
  return isObject(v) && ['quick', 'repeat', 'phrase'].includes(String(v.type))
    && isString(v.promptId) && isString(v.promptText) && isString(v.userResponse)
    && isString(v.modelAnswer) && ['perfect', 'good', 'hard'].includes(String(v.selfRating))
    && isNumber(v.responseTimeMs) && isString(v.timestamp) && isString(v.date);
}
function validConversation(v: unknown): v is ConversationSession {
  return isObject(v) && isString(v.id) && isString(v.date) && isString(v.startedAt)
    && ['ai', 'script'].includes(String(v.mode)) && ['B1', 'B2'].includes(String(v.level))
    && ['cafe', 'airport', 'hotel', 'meeting', 'intro', 'travel'].includes(String(v.topic))
    && Array.isArray(v.turns) && v.turns.every(t => isObject(t) && ['assistant', 'user'].includes(String(t.role)) && isString(t.text));
}
function validReview(v: unknown): v is ReviewCard {
  return isObject(v) && isString(v.id) && (v.type === 'quick' || v.type === 'repeat')
    && isString(v.promptId) && isString(v.promptText) && isString(v.modelAnswer)
    && isString(v.lastResponse) && isNumber(v.stage) && v.stage >= 0 && v.stage < REVIEW_INTERVAL_DAYS.length
    && Number.isInteger(v.stage) && isNumber(v.reviewCount)
    && isString(v.dueDate) && /^\d{4}-\d{2}-\d{2}$/.test(v.dueDate)
    && isString(v.createdAt) && isString(v.updatedAt);
}

export function parseBackup(text: string): BackupPayload {
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch { throw new Error('JSONファイルを読み取れませんでした。'); }
  if (!isObject(parsed) || parsed.app !== 'FluentPath' || parsed.version !== BACKUP_FORMAT_VERSION
      || !isObject(parsed.data) || !isString(parsed.exportedAt)) {
    throw new Error('FluentPath Phase 4のバックアップJSONではありません。');
  }
  const d = parsed.data;
  if (!Array.isArray(d.phrases) || !Array.isArray(d.records) || !Array.isArray(d.conversations) || !Array.isArray(d.reviews)
      || !d.phrases.every(validPhrase) || !d.records.every(validRecord)
      || !d.conversations.every(validConversation) || !d.reviews.every(validReview)) {
    throw new Error('バックアップの項目が欠けているか、形式が正しくありません。');
  }
  return parsed as unknown as BackupPayload;
}

export async function readBackupFile(file: File): Promise<BackupPayload> {
  if (file.size > MAX_BACKUP_BYTES) throw new Error('20MBを超えるファイルは読み込めません。');
  return parseBackup(await file.text());
}

export interface RestoreCounts { phrases: number; records: number; conversations: number; reviews: number; }

// Merge-only restore; never clears tables. Current device wins on the same IDs.
// Study logs have auto-incremented IDs, so dedupe by content instead of ID.
export async function mergeBackup(payload: BackupPayload): Promise<RestoreCounts> {
  return db.transaction('rw', db.phrases, db.records, db.conversations, db.reviews, async () => {
    const [existingPhrases, existingRecords, existingConversations, existingReviews] = await Promise.all([
      db.phrases.toArray(), db.records.toArray(), db.conversations.toArray(), db.reviews.toArray(),
    ]);
    const knownPhrases = new Set(existingPhrases.map(p => p.id));
    const knownConversations = new Set(existingConversations.map(c => c.id));
    const knownReviews = new Set(existingReviews.map(r => r.id));
    const recordKey = (r: StudyRecord) => JSON.stringify([r.type, r.promptId, r.timestamp, r.userResponse, r.selfRating]);
    const knownRecords = new Set(existingRecords.map(recordKey));

    const phrases = payload.data.phrases.filter(p => !knownPhrases.has(p.id));
    const conversations = payload.data.conversations.filter(c => !knownConversations.has(c.id));
    const reviews = payload.data.reviews.filter(r => !knownReviews.has(r.id));
    const records: StudyRecord[] = [];
    for (const rec of payload.data.records) {
      const key = recordKey(rec);
      if (knownRecords.has(key)) continue;
      knownRecords.add(key);
      const withoutId: StudyRecord = { ...rec };
      delete withoutId.id;
      records.push(withoutId);
    }
    if (phrases.length) await db.phrases.bulkAdd(phrases);
    if (records.length) await db.records.bulkAdd(records);
    if (conversations.length) await db.conversations.bulkAdd(conversations);
    if (reviews.length) await db.reviews.bulkAdd(reviews);
    return { phrases: phrases.length, records: records.length, conversations: conversations.length, reviews: reviews.length };
  });
}
