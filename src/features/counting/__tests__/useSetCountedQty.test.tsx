import { renderHook, act } from '@testing-library/react-native';
import { makeMigratedTestDb, type TestDb } from '../../../data/db/__tests__/testDb';
import { createCountEntryRepo } from '../../../data/repos/countEntryRepo';
import { createPendingMutationRepo } from '../../../data/repos/pendingMutationRepo';
import { makeWrapper } from './renderCountingHook';
import { useSetCountedQty } from '../useSetCountedQty';
import type { CountEntry } from '../../../data/api/carmenApi';

describe('useSetCountedQty', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
  });
  afterEach(() => db.close());

  it('creates an entry and enqueues entry.upsert on first set', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useSetCountedQty('d1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ assetId: 'a1', qty: 2 });
    });

    const entry = await createCountEntryRepo(db).findByDocumentAndAsset('d1', 'a1');
    expect(entry?.countQty).toBe(2);

    const pending = await createPendingMutationRepo(db).listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].kind).toBe('entry.upsert');
    const payload = pending[0].payload as { documentId: string; entries: CountEntry[] };
    expect(payload.documentId).toBe('d1');
    expect(payload.entries[0].assetId).toBe('a1');
    expect(payload.entries[0].countQty).toBe(2);
  });

  it('updates the same entry row on a second set', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useSetCountedQty('d1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ assetId: 'a1', qty: 2 });
    });
    await act(async () => {
      await result.current.mutateAsync({ assetId: 'a1', qty: 0 });
    });

    expect(await createCountEntryRepo(db).listByDocument('d1')).toHaveLength(1);
    const entry = await createCountEntryRepo(db).findByDocumentAndAsset('d1', 'a1');
    expect(entry?.countQty).toBe(0);
  });
});
