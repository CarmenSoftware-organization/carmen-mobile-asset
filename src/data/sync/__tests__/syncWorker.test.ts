import { makeMigratedTestDb, type TestDb } from '../../db/__tests__/testDb';
import { createPendingMutationRepo } from '../../repos/pendingMutationRepo';
import { createMutationQueue } from '../mutationQueue';
import { createSyncWorker, BACKOFF_MS } from '../syncWorker';
import { useSyncStore } from '../syncStore';
import { CarmenApiError } from '../../api/errors';
import type { CarmenApi } from '../../api/carmenApi';

function fakeApi(behavior: Record<string, jest.Mock>): CarmenApi {
  return new Proxy({} as CarmenApi, {
    get(_t, key) {
      if (key in behavior) return behavior[key as string];
      return () => {
        throw new Error(`Unexpected call: ${String(key)}`);
      };
    },
  });
}

describe('SyncWorker', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
    useSyncStore.setState({
      status: 'idle',
      queued: 0,
      lastSuccessAt: null,
      lastError: null,
    });
  });
  afterEach(() => db.close());

  it('drains a pending mutation on success', async () => {
    const repo = createPendingMutationRepo(db);
    const q = createMutationQueue(repo);
    const api = fakeApi({
      upsertCountEntries: jest.fn(async () => undefined),
    });
    const worker = createSyncWorker({ queue: q, api, isOnline: () => true });
    await q.enqueue('entry.upsert', { documentId: 'd1', entries: [] });
    await worker.drainOnce();
    expect(await q.listPending()).toEqual([]);
    expect(api.upsertCountEntries).toHaveBeenCalled();
  });

  it('increments attempts on transient errors', async () => {
    const repo = createPendingMutationRepo(db);
    const q = createMutationQueue(repo);
    const api = fakeApi({
      upsertCountEntries: jest.fn(async () => {
        throw new CarmenApiError('network_error', 'down');
      }),
    });
    const worker = createSyncWorker({ queue: q, api, isOnline: () => true });
    await q.enqueue('entry.upsert', { documentId: 'd1', entries: [] });
    await worker.drainOnce();
    const pending = await q.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].attempts).toBe(1);
  });

  it('marks failed after MAX attempts', async () => {
    const repo = createPendingMutationRepo(db);
    const q = createMutationQueue(repo);
    const api = fakeApi({
      upsertCountEntries: jest.fn(async () => {
        throw new CarmenApiError('network_error', 'down');
      }),
    });
    const worker = createSyncWorker({ queue: q, api, isOnline: () => true });
    await q.enqueue('entry.upsert', { documentId: 'd1', entries: [] });
    for (let i = 0; i < BACKOFF_MS.length; i++) {
      await worker.drainOnce();
    }
    expect(await q.listPending()).toEqual([]);
    expect(await q.listFailed()).toHaveLength(1);
  });

  it('marks failed immediately on permanent errors', async () => {
    const repo = createPendingMutationRepo(db);
    const q = createMutationQueue(repo);
    const api = fakeApi({
      upsertCountEntries: jest.fn(async () => {
        throw new CarmenApiError('conflict', 'already committed');
      }),
    });
    const worker = createSyncWorker({ queue: q, api, isOnline: () => true });
    await q.enqueue('entry.upsert', { documentId: 'd1', entries: [] });
    await worker.drainOnce();
    expect(await q.listPending()).toEqual([]);
    expect(await q.listFailed()).toHaveLength(1);
  });

  it('does nothing when offline', async () => {
    const repo = createPendingMutationRepo(db);
    const q = createMutationQueue(repo);
    const api = fakeApi({ upsertCountEntries: jest.fn() });
    const worker = createSyncWorker({ queue: q, api, isOnline: () => false });
    await q.enqueue('entry.upsert', {});
    await worker.drainOnce();
    expect(api.upsertCountEntries).not.toHaveBeenCalled();
  });

  it('reconciles a document.upsert result after syncing', async () => {
    const repo = createPendingMutationRepo(db);
    const q = createMutationQueue(repo);
    const serverDoc = { id: 'd1', runningNumber: 'CD25060001', status: 'draft' };
    const api = fakeApi({
      upsertCountingDocument: jest.fn(async () => serverDoc),
    });
    const reconcile = {
      onDocumentUpserted: jest.fn(async () => undefined),
      onDocumentCommitted: jest.fn(async () => undefined),
      onEntriesUpserted: jest.fn(async () => undefined),
      onPhotoUploaded: jest.fn(async () => undefined),
    };
    const worker = createSyncWorker({ queue: q, api, isOnline: () => true, reconcile });
    await q.enqueue('document.upsert', { id: 'd1' });
    await worker.drainOnce();
    expect(reconcile.onDocumentUpserted).toHaveBeenCalledWith(serverDoc);
  });
});
