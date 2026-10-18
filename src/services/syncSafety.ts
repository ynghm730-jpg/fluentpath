/** Phase 7A-2: causal revisions and deletion tombstones for manual cloud sync.
 * Non-destructive by default: concurrent edits are held locally as conflicts.
 */
import { db } from './db';
import type { PhraseItem, ReviewCard } from '../types';

export type SyncEntity = 'phrase' | 'review';
export type SyncOperation = 'upsert' | 'delete';
export interface SyncRevision {
  key: string;
  entity: SyncEntity;
  itemId: string;
  operation: SyncOperation;
  revision: string;
  ancestors: string[];
  fingerprint: string;
  changedAt: string;
}
export interface SyncConflict {
  key: string;
  entity: SyncEntity;
  itemId: string;
  remoteDeviceId: string;
  remoteDeviceName: string;
  localRevision: string;
  remote: SyncRevision;
  remoteValue: PhraseItem | ReviewCard | null;
  localValue: PhraseItem | ReviewCard | null;
  detectedAt: string;
}
const keyFor = (kind: SyncEntity, id: string) => `${kind}:${id}`;
const now = () => new Date().toISOString();
const newRevision = () => crypto.randomUUID();
const MAX_ANCESTORS = 120;

// Deterministic JSON fingerprint: sort object keys to ensure equivalent records match.
// This is only a change detector, not a security hash or a trust mechanism.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).filter(k => object[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canonical(object[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
export function fingerprint(value: unknown): string {
  const string = canonical(value);
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < string.length; i++) {
    hash ^= BigInt(string.charCodeAt(i));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}
const mergeAncestors = (...sequences: string[][]): string[] => {
  const unique = [...new Set(sequences.flat().filter(Boolean))];
  return unique.slice(-MAX_ANCESTORS);
};
function nextRevision(old: SyncRevision | undefined, kind: SyncEntity, id: string, operation: SyncOperation, item?: PhraseItem | ReviewCard): SyncRevision {
  return {
    key: keyFor(kind, id), entity: kind, itemId: id,
    operation, revision: newRevision(),
    ancestors: mergeAncestors(old?.ancestors ?? [], old ? [old.revision] : []),
    fingerprint: item ? fingerprint(item) : '', changedAt: now(),
  };
}

/** Capture edits and deletions even when an older screen directly calls db.table.put/delete.
 * This must run BEFORE importing a remote snapshot, to distinguish local deletion from remote data.
 */
export async function captureLocalChanges(): Promise<void> {
  await db.transaction('rw', db.phrases, db.reviews, db.syncRevisions, async () => {
    for (const [kind, items] of [
      ['phrase', await db.phrases.toArray()],
      ['review', await db.reviews.toArray()],
    ] as const) {
      const existing = await db.syncRevisions.where('entity').equals(kind).toArray();
      const known = new Map(existing.map(s => [s.itemId, s]));
      const visible = new Set<string>();
      for (const item of items) {
        visible.add(item.id);
        const previous = known.get(item.id);
        const digest = fingerprint(item);
        if (!previous || previous.operation === 'delete' || previous.fingerprint !== digest) {
          await db.syncRevisions.put(nextRevision(previous, kind, item.id, 'upsert', item));
        }
      }
      for (const [id, previous] of known) {
        if (!visible.has(id) && previous.operation !== 'delete') {
          await db.syncRevisions.put(nextRevision(previous, kind, id, 'delete'));
        }
      }
    }
  });
}

/** Existing Phase 7A snapshots have no revision metadata. Treat as untrusted concurrent
 * legacy versions; never infer deletion from absence in such snapshots.
 */
function legacyRevision(kind: SyncEntity, item: PhraseItem | ReviewCard): SyncRevision {
  const digest = fingerprint(item);
  return {
    key: keyFor(kind, item.id), entity: kind, itemId: item.id,
    revision: `legacy-${digest}`, ancestors: [], operation: 'upsert',
    fingerprint: digest,
    changedAt: '1970-01-01T00:00:00.000Z',
  };
}

export interface CloudEntities {
  phrases: PhraseItem[];
  reviews: ReviewCard[];
  syncRevisions?: SyncRevision[];
}
export interface MergeSafetyStats {
  additions: number;
  updates: number;
  deletions: number;
  conflicts: number;
}

export function validSyncRevision(value: unknown): value is SyncRevision {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Partial<SyncRevision>;
  return (v.entity === 'phrase' || v.entity === 'review') && (v.operation === 'upsert' || v.operation === 'delete')
    && typeof v.itemId === 'string' && v.itemId.length > 0 && v.itemId.length <= 512
    && v.key === keyFor(v.entity, v.itemId)
    && typeof v.revision === 'string' && v.revision.length > 0 && v.revision.length <= 100
    && Array.isArray(v.ancestors) && v.ancestors.length <= MAX_ANCESTORS
    && v.ancestors.every(a => typeof a === 'string' && a.length <= 100)
    && typeof v.fingerprint === 'string' && v.fingerprint.length <= 64
    && typeof v.changedAt === 'string' && !Number.isNaN(Date.parse(v.changedAt));
}

export async function mergeCloudEntities(data: CloudEntities, deviceId: string, deviceName: string): Promise<MergeSafetyStats> {
  // Do not include missing records as implicit deletions. A deletion requires an explicit tombstone.
  await captureLocalChanges();
  const remoteValues = new Map<string, PhraseItem | ReviewCard>();
  for (const phrase of data.phrases) remoteValues.set(keyFor('phrase', phrase.id), phrase);
  for (const review of data.reviews) remoteValues.set(keyFor('review', review.id), review);
  const incoming = new Map<string, SyncRevision>();
  for (const [key, item] of remoteValues) {
    incoming.set(key, legacyRevision(key.startsWith('phrase:') ? 'phrase' : 'review', item));
  }
  for (const revision of data.syncRevisions ?? []) {
    if (!validSyncRevision(revision)) throw new Error('クラウド側の更新記録が不正です。');
    if (revision.operation === 'upsert') {
      const value = remoteValues.get(revision.key);
      if (!value || revision.fingerprint !== fingerprint(value)) throw new Error('クラウド側の変更履歴とデータが一致しません。');
    }
    if (revision.operation === 'delete' && remoteValues.has(revision.key)) throw new Error('クラウド側の削除記録が不正です。');
    incoming.set(revision.key, revision);
  }

  const stats: MergeSafetyStats = { additions: 0, updates: 0, deletions: 0, conflicts: 0 };
  await db.transaction('rw', db.phrases, db.reviews, db.syncRevisions, db.syncConflicts, async () => {
    for (const [key, remote] of incoming) {
      const table = remote.entity === 'phrase' ? db.phrases : db.reviews;
      const current = await db.syncRevisions.get(key);
      const value = remoteValues.get(key);
      const conflictKey = `${key}:${deviceId}`;
      // A previous unresolved conflict for this item must be resolved first.
      // Otherwise importing yet another device can change the local revision
      // and make the earlier conflict impossible to resolve.
      const pending = await db.syncConflicts.where('itemId').equals(remote.itemId).toArray();
      if (pending.some(c => c.entity === remote.entity)) {
        stats.conflicts++;
        continue;
      }
      const applyRemote = async () => {
        if (remote.operation === 'delete') {
          if (await table.get(remote.itemId)) { await table.delete(remote.itemId); stats.deletions++; }
        } else if (value) {
          const present = await table.get(remote.itemId);
          if (remote.entity === 'phrase') await db.phrases.put(value as PhraseItem);
          else await db.reviews.put(value as ReviewCard);
          if (present) stats.updates++; else stats.additions++;
        }
        await db.syncRevisions.put(remote);
        await db.syncConflicts.delete(conflictKey);
      };
      if (!current) { await applyRemote(); continue; }
      if (current.revision === remote.revision || current.ancestors.includes(remote.revision)) {
        await db.syncConflicts.delete(conflictKey); // Already synchronized or incoming revision is stale.
        continue;
      }
      if (remote.ancestors.includes(current.revision)) {
        await applyRemote(); // Incoming revision causally follows our local version.
        continue;
      }
      if (current.operation === remote.operation && (current.operation === 'delete' || current.fingerprint === remote.fingerprint)) {
        // Same state from separate devices: converge on one merged revision rather than conflict.
        const merged = nextRevision(current, current.entity, current.itemId, current.operation,
          current.operation === 'upsert' ? value : undefined);
        merged.fingerprint = current.fingerprint;
        merged.ancestors = mergeAncestors(merged.ancestors, remote.ancestors, [remote.revision]);
        await db.syncRevisions.put(merged);
        await db.syncConflicts.delete(conflictKey);
        continue;
      }
      // Concurrent edits or deletion-vs-edit: preserve both, never choose a winner silently.
      const conflict: SyncConflict = {
        key: conflictKey, entity: remote.entity, itemId: remote.itemId,
        remoteDeviceId: deviceId, remoteDeviceName: deviceName,
        localRevision: current.revision, remote, remoteValue: remote.operation === 'upsert' ? (value ?? null) : null,
        localValue: current.operation === 'upsert' ? ((await table.get(remote.itemId)) ?? null) : null,
        detectedAt: now(),
      };
      await db.syncConflicts.put(conflict);
      stats.conflicts++;
    }
  });
  return stats;
}

export async function resolveSyncConflict(key: string, decision: 'local' | 'remote'): Promise<void> {
  await db.transaction('rw', db.phrases, db.reviews, db.syncRevisions, db.syncConflicts, async () => {
    const conflict = await db.syncConflicts.get(key);
    if (!conflict) throw new Error('この競合はすでに解決済みです。');
    const current = await db.syncRevisions.get(keyFor(conflict.entity, conflict.itemId));
    if (!current || current.revision !== conflict.localRevision) {
      throw new Error('競合の確認後にこの端末の内容が変更されました。もう一度取り込み直してください。');
    }
    const table = conflict.entity === 'phrase' ? db.phrases : db.reviews;
    if (decision === 'remote') {
      if (conflict.remote.operation === 'delete') await table.delete(conflict.itemId);
      else if (conflict.remoteValue) {
        if (conflict.entity === 'phrase') await db.phrases.put(conflict.remoteValue as PhraseItem);
        else await db.reviews.put(conflict.remoteValue as ReviewCard);
      } else throw new Error('相手端末の内容が見つかりません。');
    }
    const chosen = decision === 'local'
      ? current.operation === 'upsert' ? await table.get(conflict.itemId) : undefined
      : conflict.remoteValue ?? undefined;
    const operation = decision === 'local' ? current.operation : conflict.remote.operation;
    const next = nextRevision(current, conflict.entity, conflict.itemId, operation, chosen);
    next.ancestors = mergeAncestors(next.ancestors, conflict.remote.ancestors, [conflict.remote.revision]);
    await db.syncRevisions.put(next);
    // Other remote conflicts on the same item require re-checking their ancestry.
    await db.syncConflicts.delete(key);
  });
}
