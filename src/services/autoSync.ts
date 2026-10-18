/** Phase 7A-3: opt-in, foreground-only auto sync.
 * No background service worker and no AI API calls; uses Cloudflare D1 sync endpoints.
 */
import { runSafeSyncCycle } from './sync';
import { getAiToken } from './ai';

const ENABLED_KEY = 'fluentpath_auto_sync_enabled';
const STATUS_EVENT = 'fluentpath-auto-sync-status';
const DATA_EVENT = 'fluentpath-sync-data-changed';
const POLL_MS = 5 * 60_000;
const AFTER_EDIT_MS = 20_000;
const STARTUP_MS = 8_000;
export type AutoSyncPhase = 'off' | 'waiting' | 'syncing' | 'synced' | 'offline' | 'error' | 'attention';
export interface AutoSyncStatus { phase: AutoSyncPhase; message: string; lastSuccess?: string; }
let status: AutoSyncStatus = { phase: 'off', message: '自動同期はOFFです。' };
let running = false;
let attentionRequired = false;
let failCount = 0;
let nextRetry = 0;
let scheduled: ReturnType<typeof setTimeout> | undefined;
let subscribers = 0;
let manualOperations = 0;

function publish(next: AutoSyncStatus) {
  status = next;
  window.dispatchEvent(new CustomEvent(STATUS_EVENT));
}
export function getAutoSyncStatus(): AutoSyncStatus { return status; }
export function getAutoSyncEnabled(): boolean {
  try { return localStorage.getItem(ENABLED_KEY) === 'on'; } catch { return false; }
}
export function setAutoSyncEnabled(enabled: boolean) {
  localStorage.setItem(ENABLED_KEY, enabled ? 'on' : 'off');
  attentionRequired = false;
  failCount = 0;
  nextRetry = 0;
  if (!enabled && scheduled) { clearTimeout(scheduled); scheduled = undefined; }
  publish({ ...status, phase: enabled ? 'waiting' : 'off', message: enabled ? '次の同期を待っています。' : '自動同期はOFFです。' });
  if (enabled) queueAutoSync(1_000);
}
export function subscribeAutoSyncStatus(listener: () => void): () => void {
  window.addEventListener(STATUS_EVENT, listener);
  return () => window.removeEventListener(STATUS_EVENT, listener);
}

async function exclusiveCycle(): Promise<void> {
  const perform = async () => {
    publish({ ...status, phase: 'syncing', message: '安全な同期を確認しています…' });
    const result = await runSafeSyncCycle();
    if (result.changes || result.conflicts) window.dispatchEvent(new Event(DATA_EVENT));
    if (result.conflicts) {
      attentionRequired = true;
      publish({ ...status, phase: 'attention', message: `同期競合が${result.conflicts}件あります。設定画面で内容を選んでください。自動保存は停止しています。` });
      return;
    }
    failCount = 0;
    nextRetry = 0;
    publish({ phase: 'synced', lastSuccess: new Date().toISOString(), message: result.uploaded ? '自動同期が完了しました。' : '変更はありません。最新の状態です。' });
  };
  // Modern Chromium browsers support Web Locks; prevent simultaneous sync cycles
  // by other tabs on the same origin. Without Web Locks, server CAS still
  // prevents stale cloud writes.
  if ('locks' in navigator && navigator.locks) {
    const acquired = await navigator.locks.request('fluentpath-sync-cycle', { ifAvailable: true }, async lock => {
      if (!lock) return false;
      await perform();
      return true;
    });
    if (!acquired) publish({ ...status, phase: 'waiting', message: '別タブが同期しています。次の機会に再試行します。' });
  } else await perform();
}

export async function runAutoSyncNow(force = false): Promise<void> {
  if (!getAutoSyncEnabled() || running || manualOperations > 0) return;
  if (attentionRequired && !force) return;
  if (Date.now() < nextRetry && !force) return;
  if (document.visibilityState === 'hidden') return;
  if (!navigator.onLine) {
    publish({ ...status, phase: 'offline', message: 'オフラインです。端末内には保存され、接続復帰後に再試行します。' });
    return;
  }
  if (!getAiToken()) {
    publish({ ...status, phase: 'error', message: 'AUTH_TOKENを設定すると自動同期できます。' });
    return;
  }
  running = true;
  try {
    if (force) attentionRequired = false;
    await exclusiveCycle();
  } catch (error) {
    window.dispatchEvent(new Event(DATA_EVENT)); // A remote merge may already have succeeded.
    const message = error instanceof Error ? error.message : '不明なエラー';
    const conflict = /競合|更新されました|409|SYNC_VERSION_CONFLICT/.test(message);
    if (conflict) attentionRequired = true;
    failCount++;
    nextRetry = Date.now() + Math.min(30 * 60_000, Math.max(60_000, 60_000 * 2 ** Math.min(failCount, 5)));
    publish({ ...status, phase: conflict ? 'attention' : 'error', message: conflict
      ? `クラウド側が変更されています。設定画面から再確認してください：${message}`
      : `自動同期を再試行待ちにしました：${message}` });
  } finally { running = false; }
}
export function queueAutoSync(delay = AFTER_EDIT_MS) {
  if (!getAutoSyncEnabled()) return;
  if (scheduled) clearTimeout(scheduled);
  scheduled = setTimeout(() => { scheduled = undefined; void runAutoSyncNow(); }, delay);
}
export function subscribeSyncDataChanges(listener: () => void): () => void {
  window.addEventListener(DATA_EVENT, listener);
  return () => window.removeEventListener(DATA_EVENT, listener);
}
/** Mounted by App. Auto sync is OFF by default, per browser. */
export function startAutoSync(): () => void {
  subscribers++;
  if (getAutoSyncEnabled()) {
    publish({ ...status, phase: 'waiting', message: '自動同期がONです。' });
    queueAutoSync(STARTUP_MS);
  }
  const onResume = () => queueAutoSync(2_000);
  const onVisibility = () => { if (document.visibilityState === 'visible') onResume(); };
  window.addEventListener('online', onResume);
  window.addEventListener('focus', onResume);
  document.addEventListener('visibilitychange', onVisibility);
  const interval = window.setInterval(() => queueAutoSync(0), POLL_MS);
  return () => {
    subscribers--;
    window.clearInterval(interval);
    window.removeEventListener('online', onResume);
    window.removeEventListener('focus', onResume);
    document.removeEventListener('visibilitychange', onVisibility);
    if (subscribers === 0 && scheduled) { clearTimeout(scheduled); scheduled = undefined; }
  };
}

/** Pauses this tab's automatic cycle while an explicit manual operation is open. */
export function beginManualSync(): () => void {
  manualOperations++;
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    manualOperations--;
    if (manualOperations === 0) queueAutoSync(30_000);
  };
}
