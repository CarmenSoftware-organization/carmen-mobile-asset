import { CarmenApiError } from '../api/errors';
import type { CarmenApi, CountEntry, CountingDocument, PhotoUpload } from '../api/carmenApi';
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

// Hooks invoked after a mutation syncs, to write server-assigned values back
// to local rows. A hook that throws is treated by the worker as a retryable
// mutation failure (see drainOnce): both the mutations and the repo markSynced
// writes are idempotent, so re-running on retry is safe.
export interface SyncReconciler {
  onDocumentUpserted(doc: CountingDocument): Promise<void>;
  onDocumentCommitted(doc: CountingDocument): Promise<void>;
  /** `entries` is the local payload — upsertCountEntries returns void, so there is no server response. */
  onEntriesUpserted(documentId: string, entries: CountEntry[]): Promise<void>;
  onPhotoUploaded(
    localPhotoId: string,
    result: { photoId: string; remoteUrl: string },
  ): Promise<void>;
}

export interface SyncWorkerDeps {
  queue: MutationQueue;
  api: CarmenApi;
  isOnline: () => boolean;
  reconcile?: SyncReconciler;
}

export interface SyncWorker {
  drainOnce(): Promise<void>;
  start(): () => void;
}

async function performMutation(
  api: CarmenApi,
  m: PendingMutation,
  reconcile?: SyncReconciler,
): Promise<void> {
  switch (m.kind) {
    case 'document.upsert': {
      const result = await api.upsertCountingDocument(m.payload as never);
      await reconcile?.onDocumentUpserted(result);
      return;
    }
    case 'document.commit': {
      const { id } = m.payload as { id: string };
      const result = await api.commitCountingDocument(id);
      await reconcile?.onDocumentCommitted(result);
      return;
    }
    case 'entry.upsert': {
      const { documentId, entries } = m.payload as { documentId: string; entries: CountEntry[] };
      await api.upsertCountEntries(documentId, entries);
      await reconcile?.onEntriesUpserted(documentId, entries);
      return;
    }
    case 'photo.upload': {
      const file = m.payload as PhotoUpload;
      const result = await api.uploadPhoto(file);
      await reconcile?.onPhotoUploaded(file.id, result);
      return;
    }
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
      await performMutation(deps.api, m, deps.reconcile);
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
