import type { StudyRecord, SelfRating, ReviewCard } from '../types';
import { db } from './db';

// At the final stage, successful reviews recur every 365 days (maximum interval).
export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30, 60, 90, 180, 270, 365] as const;

// Date-only keys use the device's calendar (not UTC) so midnight in Japan is correct.
export function localDateKey(value: Date = new Date()): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function daysLater(base: Date, days: number): string {
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
  return localDateKey(next);
}

export function reviewId(record: Pick<StudyRecord, 'type' | 'promptId'>): string {
  return `${record.type}:${record.promptId}`;
}

export function initialReviewCard(record: StudyRecord): ReviewCard {
  const last = new Date(record.timestamp);
  const base = Number.isNaN(last.getTime()) ? new Date() : last;
  const now = new Date().toISOString();
  return {
    id: reviewId(record),
    type: record.type as 'quick' | 'repeat',
    promptId: record.promptId,
    promptText: record.promptText,
    modelAnswer: record.modelAnswer,
    lastResponse: record.userResponse,
    stage: 0,
    reviewCount: 0,
    dueDate: daysLater(base, 1),
    createdAt: record.timestamp || now,
    updatedAt: now,
  };
}

// Must be called inside a transaction that includes the records and reviews tables.
export async function updateReviewFromPractice(record: StudyRecord): Promise<void> {
  if (record.type !== 'quick' && record.type !== 'repeat') return;
  if (!record.promptId || !record.modelAnswer) return;
  const id = reviewId(record);
  const existing = await db.reviews.get(id);
  if (record.selfRating === 'perfect') {
    // Do not make every correct prompt into a review card. A previously weak
    // prompt graduates forward when answered correctly in normal practice.
    if (existing) {
      const stage = Math.min(existing.stage + 1, REVIEW_INTERVAL_DAYS.length - 1);
      await db.reviews.put({ ...existing, stage, dueDate: daysLater(new Date(), REVIEW_INTERVAL_DAYS[stage]),
        promptText: record.promptText, modelAnswer: record.modelAnswer,
        lastResponse: record.userResponse, updatedAt: new Date().toISOString() });
    }
    return;
  }
  const fresh = initialReviewCard(record);
  await db.reviews.put(existing
    ? { ...existing, promptText: record.promptText, modelAnswer: record.modelAnswer,
        lastResponse: record.userResponse, stage: record.selfRating === 'hard' ? 0 : existing.stage,
        dueDate: daysLater(new Date(), 1), updatedAt: fresh.updatedAt }
    : fresh);
}

export async function saveStudyRecord(record: StudyRecord): Promise<void> {
  await db.transaction('rw', db.records, db.reviews, async () => {
    await db.records.add(record);
    await updateReviewFromPractice(record);
  });
}

export async function getDueReviews(): Promise<ReviewCard[]> {
  return db.reviews.where('dueDate').belowOrEqual(localDateKey()).sortBy('dueDate');
}

export async function completeReview(card: ReviewCard, response: string, rating: SelfRating, responseTimeMs: number): Promise<void> {
  const stage = rating === 'hard' ? 0 : Math.min(card.stage + (rating === 'perfect' ? 2 : 1), REVIEW_INTERVAL_DAYS.length - 1);
  const timestamp = new Date().toISOString();
  const updated: ReviewCard = {
    ...card, stage, dueDate: daysLater(new Date(), REVIEW_INTERVAL_DAYS[stage]),
    lastResponse: response, reviewCount: card.reviewCount + 1,
    lastReviewedAt: timestamp, updatedAt: timestamp,
  };
  const record: StudyRecord = {
    type: card.type, promptId: card.promptId, promptText: card.promptText,
    userResponse: response, modelAnswer: card.modelAnswer, selfRating: rating,
    responseTimeMs: Math.max(1000, responseTimeMs), timestamp, date: localDateKey(),
  };
  // The review's scheduling and its new history entry either both save or both fail.
  await db.transaction('rw', db.reviews, db.records, async () => {
    await db.reviews.put(updated);
    await db.records.add(record);
  });
}

/** Save only mistakes expressly identified by Gemini, using the existing 1–365 day review cycle.
 * A stylistic alternative must not automatically become a review card.
 * IDs are deterministic: revisiting a past conversation cannot reset progress.
 */
export async function addAiCorrectionToReviews(input: {
  sourceId: string;
  prompt: string;
  original: string;
  corrected: string;
  needsReview?: boolean;
}): Promise<boolean> {
  if (input.needsReview !== true) return false;
  const prompt = input.prompt.trim().slice(0, 450);
  const corrected = input.corrected.trim().slice(0, 450);
  const original = input.original.trim().slice(0, 450);
  if (!prompt || !corrected || !original || !input.sourceId || original === corrected) return false;
  const id = `ai:${input.sourceId}`;
  return db.transaction('rw', db.reviews, async () => {
    if (await db.reviews.get(id)) return false;
    const now = new Date();
    const stamp = now.toISOString();
    const card: ReviewCard = {
      id, type: 'ai', promptId: input.sourceId,
      promptText: prompt, modelAnswer: corrected, lastResponse: original,
      stage: 0, reviewCount: 0, dueDate: daysLater(now, 1),
      createdAt: stamp, updatedAt: stamp,
    };
    await db.reviews.add(card);
    return true;
  });
}
