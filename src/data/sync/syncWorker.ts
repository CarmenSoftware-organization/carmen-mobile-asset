import { CarmenApiError } from '../api/errors';
import type { CarmenApi } from '../api/carmenApi';
import type { MutationQueue } from './mutationQueue';
import type { PendingMutation } from '../repos/types';
import { useSyncStore } from './syncStore';

export const BACKOFF_MS = [2_000, 5_000, 15_000, 30_000, 60_000, 120_000];
const PERMANENT_ERROR_CODES = new Set([
  'unauthenticated',
  'conflict',
  'not_implemented',
  'not_found',
]);

export interface SyncWorkerDeps {
  queue: MutationQueue;
  api: CarmenApi;
  isOnline: () => boolean;
}

export interface SyncWorker {
  drainOnce(): Promise<void>;
  start(): () => void;
}

async function performMutation(api: CarmenApi, m: PendingMutation): Promise<void> {
  switch (m.kind) {
    case 'document.upsert':
      await api.upsertCountingDocument(m.payload as never);
      return;
    case 'document.commit': {
      const { id } = m.payload as { id: string };
      await api.commitCountingDocument(id);
      return;
    }
    case 'entry.upsert': {
      const { documentId, entries } = m.payload as { documentId: string; entries: never };
      await api.upsertCountEntries(documentId, entries);
      return;
    }
    case 'photo.upload':
      await api.uploadPhoto(m.payload as never);
      return;
  }
}

export function createSyncWorker(deps: SyncWorkerDeps): SyncWorker {
  async function drainOnce(): Promise<void> {
    if (!deps.isOnline()) return;
    const pending = await deps.queue.listPending();
    useSyncStore.getState().setQueued(pending.length);
    if (pending.length === 0) {
      useSyncStore.getState().recordSuccess();
      return;
    }
    const m = pending[0];
    useSyncStore.getState().setStatus('syncing');
    await deps.queue.markInFlight(m.id);
    try {
      await performMutation(deps.api, m);
      await deps.queue.markDone(m.id);
      useSyncStore.getState().recordSuccess();
    } catch (err) {
      const code = err instanceof CarmenApiError ? err.code : 'unknown';
      const msg = err instanceof Error ? err.message : String(err);
      if (PERMANENT_ERROR_CODES.has(code)) {
        await deps.queue.markFailed(m.id, msg);
        useSyncStore.getState().setStatus('error', msg);
        return;
      }
      const nextAttempts = m.attempts + 1;
      if (nextAttempts >= BACKOFF_MS.length) {
        await deps.queue.markFailed(m.id, msg);
        useSyncStore.getState().setStatus('error', msg);
        return;
      }
      await deps.queue.incrementAttempts(m.id, msg);
      useSyncStore.getState().setStatus('error', msg);
    }
  }

  return {
    drainOnce,
    start() {
      const unsubscribe = deps.queue.subscribe(() => {
        void drainOnce();
      });
      void drainOnce();
      return unsubscribe;
    },
  };
}
