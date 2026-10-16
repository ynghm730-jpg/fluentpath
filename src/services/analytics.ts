import type { ConversationSession, ReviewCard, StudyRecord } from '../types';
import { localDateKey } from './review';

export type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly';

export interface TrendBucket {
  key: string;
  label: string;
  count: number;
  perfect: number;
  good: number;
  hard: number;
}

export interface WeakPromptStat {
  key: string;
  type: 'quick' | 'repeat';
  promptText: string;
  hardCount: number;
  attempts: number;
  latestRating: StudyRecord['selfRating'];
}

export interface AnalyticsSummary {
  totalAnswers: number;
  weekAnswers: number;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
  reviewTotal: number;
  dueReviews: number;
  scheduledReviews: number;
  conversationSessions: number;
  quickAverageSeconds: number | null;
  perfect: number;
  good: number;
  hard: number;
  weakPrompts: WeakPromptStat[];
}

function keyDay(date: Date): string {
  return localDateKey(date);
}

function shiftDay(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function midnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function validDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [year, month, day] = key.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

function dayOrdinal(key: string): number {
  const [year, month, day] = key.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function ratingCounts(records: StudyRecord[]): Pick<TrendBucket, 'perfect' | 'good' | 'hard'> {
  return records.reduce((counts, r) => {
    if (r.selfRating === 'perfect') counts.perfect++;
    if (r.selfRating === 'good') counts.good++;
    if (r.selfRating === 'hard') counts.hard++;
    return counts;
  }, { perfect: 0, good: 0, hard: 0 });
}

export function calculateAnalytics(
  records: StudyRecord[],
  reviews: ReviewCard[],
  conversations: ConversationSession[],
  now: Date = new Date(),
): AnalyticsSummary {
  const today = keyDay(now);
  const sevenDaysAgo = keyDay(shiftDay(now, -6));
  // Only valid recorded calendar days count; imported data can include malformed dates.
  const validRecords = records.filter(r => validDateKey(r.date) && r.date <= today);
  const dates = [...new Set(validRecords.map(r => r.date))].sort();
  const ordinals = dates.map(dayOrdinal);
  const todayOrdinal = dayOrdinal(today);
  const lastDay = ordinals[ordinals.length - 1];
  let currentStreak = 0;
  if (lastDay !== undefined && (lastDay === todayOrdinal || lastDay === todayOrdinal - 1)) {
    let expected = lastDay;
    for (let i = ordinals.length - 1; i >= 0 && ordinals[i] === expected; i--, expected--) currentStreak++;
  }
  let longestStreak = 0;
  let run = 0;
  let previous: number | undefined;
  for (const day of ordinals) {
    run = previous !== undefined && day === previous + 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    previous = day;
  }

  const promptStats = new Map<string, WeakPromptStat & { latestTimestamp: string }>();
  for (const r of validRecords) {
    if ((r.type !== 'quick' && r.type !== 'repeat') || !r.promptText) continue;
    const key = `${r.type}:${r.promptId || r.promptText}`;
    const existing = promptStats.get(key);
    const timestamp = r.timestamp || r.date;
    if (!existing) {
      promptStats.set(key, {
        key, type: r.type, promptText: r.promptText,
        hardCount: r.selfRating === 'hard' ? 1 : 0,
        attempts: 1, latestRating: r.selfRating, latestTimestamp: timestamp,
      });
    } else {
      existing.attempts++;
      if (r.selfRating === 'hard') existing.hardCount++;
      if (timestamp >= existing.latestTimestamp) {
        existing.latestTimestamp = timestamp;
        existing.latestRating = r.selfRating;
        existing.promptText = r.promptText;
      }
    }
  }
  const weakPrompts: WeakPromptStat[] = [...promptStats.values()]
    .filter(p => p.hardCount > 0)
    .sort((a, b) => b.hardCount - a.hardCount || b.attempts - a.attempts || a.key.localeCompare(b.key))
    .slice(0, 5)
    .map(({ key, type, promptText, hardCount, attempts, latestRating }) => ({
      key, type, promptText, hardCount, attempts, latestRating,
    }));

  const quickTimings = validRecords
    .filter(r => r.type === 'quick' && Number.isFinite(r.responseTimeMs) && r.responseTimeMs > 0)
    .map(r => r.responseTimeMs);
  const allRatings = ratingCounts(validRecords);
  return {
    totalAnswers: validRecords.length,
    weekAnswers: validRecords.filter(r => r.date >= sevenDaysAgo).length,
    activeDays: dates.length,
    currentStreak, longestStreak,
    reviewTotal: reviews.reduce((count, r) => count + (Number.isFinite(r.reviewCount) ? Math.max(0, r.reviewCount) : 0), 0),
    dueReviews: reviews.filter(r => validDateKey(r.dueDate) && r.dueDate <= today).length,
    scheduledReviews: reviews.length,
    conversationSessions: conversations.length,
    quickAverageSeconds: quickTimings.length
      ? Math.round(quickTimings.reduce((a, b) => a + b, 0) / quickTimings.length / 100) / 10
      : null,
    ...allRatings,
    weakPrompts,
  };
}

export function buildTrend(records: StudyRecord[], period: AnalyticsPeriod, now: Date = new Date()): TrendBucket[] {
  const current = midnight(now);
  const createBucket = (start: Date, label: string): TrendBucket => ({
    key: keyDay(start), label, count: 0, perfect: 0, good: 0, hard: 0,
  });
  const buckets: TrendBucket[] = [];
  let findBucket: (date: Date) => string;
  if (period === 'daily') {
    for (let i = 6; i >= 0; i--) {
      const day = shiftDay(current, -i);
      buckets.push(createBucket(day, `${day.getMonth() + 1}/${day.getDate()}`));
    }
    findBucket = date => keyDay(date);
  } else if (period === 'weekly') {
    const monday = shiftDay(current, -(current.getDay() + 6) % 7);
    for (let i = 7; i >= 0; i--) {
      const start = shiftDay(monday, -i * 7);
      buckets.push(createBucket(start, `${start.getMonth() + 1}/${start.getDate()}`));
    }
    findBucket = date => keyDay(shiftDay(date, -(date.getDay() + 6) % 7));
  } else {
    for (let i = 5; i >= 0; i--) {
      const start = new Date(current.getFullYear(), current.getMonth() - i, 1);
      buckets.push(createBucket(start, `${start.getMonth() + 1}月`));
    }
    findBucket = date => keyDay(new Date(date.getFullYear(), date.getMonth(), 1));
  }

  const byKey = new Map(buckets.map(bucket => [bucket.key, bucket]));
  for (const r of records) {
    if (!validDateKey(r.date) || r.date > keyDay(current)) continue;
    const [year, month, day] = r.date.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const bucket = byKey.get(findBucket(date));
    if (!bucket) continue;
    bucket.count++;
    if (r.selfRating === 'perfect') bucket.perfect++;
    if (r.selfRating === 'good') bucket.good++;
    if (r.selfRating === 'hard') bucket.hard++;
  }
  return buckets;
}
