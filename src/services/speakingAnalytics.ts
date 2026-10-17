import type { ConversationSession, QuickResponseAttempt, ReviewCard, SelfRating } from '../types';
import { localDateKey } from './review';
import { MEETING_SCENARIOS, MEETING_SCENARIO_IDS } from '../data/meetingScenarios';

export type SpeakingPeriod = 7 | 30 | 90;

export interface QuickStats {
  attempts: number;
  measured: number;
  onTime: number;
  noInput: number;
  averageMs: number | null;
  perfect: number;
  good: number;
  hard: number;
  voice: number;
  text: number;
}

export interface QuickTrendBucket extends QuickStats {
  key: string;
  label: string;
}

export interface LimitStats {
  limit: 3 | 5 | 10;
  attempts: number;
  onTime: number;
}

export interface MeetingScenarioStats {
  id: string;
  label: string;
  sessions: number;
  rated: number;
  perfect: number;
  good: number;
  hard: number;
  replies: number;
}

export interface SpeakingAnalytics {
  period: SpeakingPeriod;
  current: QuickStats;
  previous: QuickStats;
  quickTrend: QuickTrendBucket[];
  limits: LimitStats[];
  meetings: {
    total: number;
    ai: number;
    script: number;
    userReplies: number;
    rated: number;
    perfect: number;
    good: number;
    hard: number;
    scenarios: MeetingScenarioStats[];
  };
  aiReview: {
    total: number;
    newCards: number;
    practiced: number;
    due: number;
    intermediate: number;
    advanced: number;
  };
}

function isValidDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const x = new Date(y, m - 1, d);
  return x.getFullYear() === y && x.getMonth() + 1 === m && x.getDate() === d;
}

function addDays(value: Date, delta: number): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + delta);
}

function emptyQuick(): QuickStats {
  return { attempts: 0, measured: 0, onTime: 0, noInput: 0, averageMs: null,
    perfect: 0, good: 0, hard: 0, voice: 0, text: 0 };
}

/** A null latency is excluded from the mean, but is a failed time-limit attempt. */
function summarizeQuick(attempts: QuickResponseAttempt[]): QuickStats {
  const result = emptyQuick();
  let sumMs = 0;
  for (const item of attempts) {
    result.attempts++;
    if (item.selfRating === 'perfect') result.perfect++;
    else if (item.selfRating === 'good') result.good++;
    else if (item.selfRating === 'hard') result.hard++;
    if (item.inputMode === 'voice') result.voice++;
    else if (item.inputMode === 'text') result.text++;
    const measured = item.startLatencyMs !== null && Number.isFinite(item.startLatencyMs) && item.startLatencyMs >= 0;
    if (measured) {
      const ms = item.startLatencyMs!;
      sumMs += ms;
      result.measured++;
      // Use the recorded per-question limit; if data is corrupt, it is not a success.
      if ([3, 5, 10].includes(item.limitSeconds) && ms <= item.limitSeconds * 1000) result.onTime++;
    } else {
      result.noInput++;
    }
  }
  result.averageMs = result.measured > 0 ? sumMs / result.measured : null;
  return result;
}

export function calculateSpeakingAnalytics(
  quickResponses: QuickResponseAttempt[],
  conversations: ConversationSession[],
  reviewCards: ReviewCard[],
  period: SpeakingPeriod,
  now: Date = new Date(),
): SpeakingAnalytics {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = localDateKey(today);
  const start = localDateKey(addDays(today, 1 - period));
  const previousStart = localDateKey(addDays(today, 1 - period * 2));
  const previousEnd = localDateKey(addDays(today, -period));
  const validQuick = quickResponses.filter(a => isValidDateKey(a.date) && a.date <= todayKey);
  const currentAttempts = validQuick.filter(a => a.date >= start);
  const previousAttempts = validQuick.filter(a => a.date >= previousStart && a.date <= previousEnd);

  // Same-size, contiguous buckets. Each period covers exactly 7/30/90 calendar days.
  const bucketDays = period === 7 ? 1 : period === 30 ? 5 : 10;
  const bucketCount = period / bucketDays;
  const quickTrend: QuickTrendBucket[] = [];
  for (let index = 0; index < bucketCount; index++) {
    const beginning = addDays(today, 1 - period + bucketDays * index);
    const ending = addDays(beginning, bucketDays - 1);
    const beginKey = localDateKey(beginning);
    const endKey = localDateKey(ending);
    const selected = currentAttempts.filter(a => a.date >= beginKey && a.date <= endKey);
    const label = bucketDays === 1
      ? `${beginning.getMonth() + 1}/${beginning.getDate()}`
      : `${beginning.getMonth() + 1}/${beginning.getDate()}〜${ending.getMonth() + 1}/${ending.getDate()}`;
    quickTrend.push({ key: beginKey, label, ...summarizeQuick(selected) });
  }

  const limits: LimitStats[] = ([3, 5, 10] as const).map(limit => {
    const entries = currentAttempts.filter(a => a.limitSeconds === limit);
    return { limit, attempts: entries.length,
      onTime: entries.filter(a => a.startLatencyMs !== null && Number.isFinite(a.startLatencyMs)
        && a.startLatencyMs >= 0 && a.startLatencyMs <= limit * 1000).length };
  });

  const savedMeetings = conversations.filter(c =>
    (c.mode === 'meeting_ai' || c.mode === 'meeting_script')
    && isValidDateKey(c.date) && c.date >= start && c.date <= todayKey
    && c.turns.some(t => t.role === 'user'),
  );
  const ratedMeetings = savedMeetings.filter(c => c.meetingSelfRating === 'perfect' || c.meetingSelfRating === 'good' || c.meetingSelfRating === 'hard');
  const ratedCount = (rating: SelfRating) => ratedMeetings.filter(c => c.meetingSelfRating === rating).length;
  const scenarios: MeetingScenarioStats[] = MEETING_SCENARIO_IDS.map(id => {
    const sessions = savedMeetings.filter(c => c.meetingScenarioId === id);
    return {
      id, label: MEETING_SCENARIOS[id].label,
      sessions: sessions.length,
      rated: sessions.filter(c => c.meetingSelfRating).length,
      perfect: sessions.filter(c => c.meetingSelfRating === 'perfect').length,
      good: sessions.filter(c => c.meetingSelfRating === 'good').length,
      hard: sessions.filter(c => c.meetingSelfRating === 'hard').length,
      replies: sessions.reduce((sum, c) => sum + c.turns.filter(t => t.role === 'user').length, 0),
    };
  });
  const aiCards = reviewCards.filter(r => r.type === 'ai');
  return {
    period,
    current: summarizeQuick(currentAttempts),
    previous: summarizeQuick(previousAttempts),
    quickTrend,
    limits,
    meetings: {
      total: savedMeetings.length,
      ai: savedMeetings.filter(c => c.mode === 'meeting_ai').length,
      script: savedMeetings.filter(c => c.mode === 'meeting_script').length,
      userReplies: savedMeetings.reduce((sum, c) => sum + c.turns.filter(t => t.role === 'user').length, 0),
      rated: ratedMeetings.length, perfect: ratedCount('perfect'), good: ratedCount('good'), hard: ratedCount('hard'),
      scenarios,
    },
    // Current inventory only. Review events are not stored as a dated progression history.
    aiReview: {
      total: aiCards.length,
      newCards: aiCards.filter(r => r.reviewCount === 0).length,
      practiced: aiCards.filter(r => r.reviewCount > 0).length,
      due: aiCards.filter(r => isValidDateKey(r.dueDate) && r.dueDate <= todayKey).length,
      intermediate: aiCards.filter(r => r.stage >= 1 && r.stage <= 5).length,
      advanced: aiCards.filter(r => r.stage >= 6).length,
    },
  };
}
