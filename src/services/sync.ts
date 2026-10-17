/** Phase 7A: opt-in manual cloud snapshot exchange. No automatic upload. */
import { createBackup, parseBackup, type BackupPayload } from './backup';
import { getAiToken, getWorkerUrl } from './ai';

const DEVICE_ID_KEY = 'fluentpath_sync_device_id';
const DEVICE_NAME_KEY = 'fluentpath_sync_device_name';
const MAX_SYNC_BYTES = 1_000_000;

export interface CloudSnapshot {
  deviceId: string;
  deviceName: string;
  updatedAt: string;
  snapshot: BackupPayload;
}

export function localSyncDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(DEVICE_ID_KEY, id); }
  return id;
}
export function getSyncDeviceName(): string {
  const defaultName = /Android|iPhone|Mobile/i.test(navigator.userAgent) ? 'Pixel / スマホ' : 'MacBook / PC';
  return localStorage.getItem(DEVICE_NAME_KEY) || defaultName;
}
export function setSyncDeviceName(name: string): void {
  localStorage.setItem(DEVICE_NAME_KEY, name.trim().slice(0, 40));
}
async function requestSync(path: string, init: RequestInit = {}): Promise<unknown> {
  const token = getAiToken();
  if (!token) throw new Error('AUTH_TOKENが未設定です。AI添削で「次回以降も保存」を選んでください。');
  let response: Response;
  try {
    response = await fetch(`${getWorkerUrl()}${path}`, {
      ...init,
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    });
  } catch { throw new Error('Cloudflare Workerに接続できませんでした。'); }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const value = payload as { error?: { message?: string } } | null;
    throw new Error(value?.error?.message || `同期に失敗しました（HTTP ${response.status}）。`);
  }
  return payload;
}
export async function uploadLocalSnapshot(): Promise<string> {
  const snapshot = await createBackup();
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot)).byteLength;
  if (bytes > MAX_SYNC_BYTES) throw new Error('学習データが1MBを超えています。現在の手動同期の上限です。JSONバックアップをご利用ください。');
  const deviceId = localSyncDeviceId();
  const deviceName = getSyncDeviceName();
  const result = await requestSync('/api/sync/snapshot', {
    method: 'POST',
    body: JSON.stringify({ deviceId, deviceName, snapshot }),
  }) as { updatedAt: string };
  return result.updatedAt;
}
export async function fetchCloudSnapshots(): Promise<CloudSnapshot[]> {
  const result = await requestSync('/api/sync/snapshots') as { snapshots?: unknown };
  if (!Array.isArray(result.snapshots)) throw new Error('クラウド上のデータ形式が不正です。');
  return result.snapshots.map(item => {
    if (!item || typeof item !== 'object') throw new Error('クラウド上の端末情報が不正です。');
    const row = item as Record<string, unknown>;
    if (typeof row.deviceId !== 'string' || typeof row.deviceName !== 'string' || typeof row.updatedAt !== 'string')
      throw new Error('クラウド上の端末情報が不正です。');
    const snapshot = parseBackup(JSON.stringify(row.snapshot));
    return { deviceId: row.deviceId, deviceName: row.deviceName, updatedAt: row.updatedAt, snapshot };
  });
}
