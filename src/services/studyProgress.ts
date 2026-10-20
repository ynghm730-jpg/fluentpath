/** Phase 7B-0: persistent, safely shareable position in finite question sets.
 * No API token or AI response is stored in this table.
 */
import { db } from './db';
import { queueAutoSync } from './autoSync';

export type StudyMode = 'composition' | 'repeat' | 'response';
export type QuestionCategory = 'all' | 'business' | 'daily';
export interface StudyCursor {
  key: string;
  questionId: string;
  updatedAt: string;
}
const PREFIX = 'study_cursor:';
const categoryKey = (mode: StudyMode) => `fluentpath_last_category_${mode}`;
const makeKey = (mode: StudyMode, category: QuestionCategory) => `${mode}:${category}`;
const isCategory = (v: string | null): v is QuestionCategory => v === 'all' || v === 'business' || v === 'daily';

export function readStudyCategory(mode: StudyMode): QuestionCategory {
  try { const saved = localStorage.getItem(categoryKey(mode)); return isCategory(saved) ? saved : 'all'; }
  catch { return 'all'; }
}
export function writeStudyCategory(mode: StudyMode, category: QuestionCategory): void {
  try { localStorage.setItem(categoryKey(mode), category); } catch { /* private mode: use default */ }
}
export function validStudyCursor(value: unknown): value is StudyCursor {
  if (!value || typeof value !== 'object') return false;
  const c = value as Partial<StudyCursor>;
  return typeof c.key === 'string' && /^(composition|repeat|response):(all|business|daily)$/.test(c.key)
    && typeof c.questionId === 'string' && c.questionId.length > 0 && c.questionId.length <= 120
    && typeof c.updatedAt === 'string' && !Number.isNaN(Date.parse(c.updatedAt));
}
export async function listStudyCursors(): Promise<StudyCursor[]> {
  const rows = await db.settings.where('key').startsWith(PREFIX).toArray();
  return rows.flatMap(row => {
    try { const cursor: unknown = JSON.parse(row.value); return validStudyCursor(cursor) && row.key === PREFIX + cursor.key ? [cursor] : []; }
    catch { return []; }
  });
}
export async function mergeStudyCursors(items: StudyCursor[]): Promise<void> {
  const rows = items.filter(validStudyCursor);
  await db.transaction('rw', db.settings, async () => {
    for (const cursor of rows) {
      const key = PREFIX + cursor.key;
      const previous = await db.settings.get(key);
      let stored: StudyCursor | null = null;
      if (previous) { try { const v: unknown = JSON.parse(previous.value); if (validStudyCursor(v)) stored = v; } catch { /* malformed legacy value */ } }
      // Clock timestamps are used only for the training cursor, never for review schedules/deletions.
      if (!stored || Date.parse(cursor.updatedAt) > Date.parse(stored.updatedAt)) {
        await db.settings.put({ key, value: JSON.stringify(cursor) });
      }
    }
  });
}
export async function rememberStudyQuestion(mode: StudyMode, category: QuestionCategory, questionId: string): Promise<void> {
  const cursor: StudyCursor = { key: makeKey(mode, category), questionId, updatedAt: new Date().toISOString() };
  await db.settings.put({ key: PREFIX + cursor.key, value: JSON.stringify(cursor) });
  queueAutoSync();
}
/** Migrate from pre-Phase7B history only when no cursor has ever been saved.
 * A deliberate restart records the first question and takes precedence over history.
 */
export async function loadStudyIndex(mode: StudyMode, category: QuestionCategory, questions: { id: string }[]): Promise<number> {
  if (!questions.length) return 0;
  const item = await db.settings.get(PREFIX + makeKey(mode, category));
  if (item) {
    try {
      const cursor: unknown = JSON.parse(item.value);
      if (validStudyCursor(cursor)) {
        const found = questions.findIndex(q => q.id === cursor.questionId);
        if (found >= 0) return found;
      }
    } catch { /* fall back to original order */ }
    return 0;
  }
  // Existing completed answers are already synced between devices.
  if (mode === 'response') {
    const log = await db.quickResponses.orderBy('timestamp').reverse().toArray();
    const last = log.find(row => questions.some(q => q.id === row.questionId));
    if (last) return (questions.findIndex(q => q.id === last.questionId) + 1) % questions.length;
  } else {
    const records = await db.records.orderBy('timestamp').reverse().toArray();
    const last = records.find(row => row.type === (mode === 'composition' ? 'quick' : 'repeat') && questions.some(q => q.id === row.promptId));
    if (last) return (questions.findIndex(q => q.id === last.promptId) + 1) % questions.length;
  }
  return 0;
}
