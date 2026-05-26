import { renderHook, act } from '@testing-library/react-native';
import { makeMigratedTestDb, type TestDb } from '../../../data/db/__tests__/testDb';
import { createCountEntryRepo } from '../../../data/repos/countEntryRepo';
import { createPendingMutationRepo } from '../../../data/repos/pendingMutationRepo';
import { makeWrapper } from './renderCountingHook';
import { useSaveCountEntry } from '../useSaveCountEntry';
import type { CountEntry } from '../../../data/api/carmenApi';

describe('useSaveCountEntry', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
  });
  afterEach(() => db.close());

  it('persists observations + qty, stamps transferDate, enqueues entry.upsert', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useSaveCountEntry('d1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        assetId: 'a1',
        countQty: 3,
        location: 'Warehouse A',
        observedSerialNo: 'SN-9',
        observedSpecification: 'spec',
        observedRemark: 'looks fine',
        comment: 'ok',
      });
    });

    const saved = await createCountEntryRepo(db).findByDocumentAndAsset('d1', 'a1');
    expect(saved).toMatchObject({
      countQty: 3,
      location: 'Warehouse A',
      observedSerialNo: 'SN-9',
      observedSpecification: 'spec',
      observedRemark: 'looks fine',
      comment: 'ok',
    });
    expect(saved?.transferDate).not.toBeNull();

    const pending = await createPendingMutationRepo(db).listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].kind).toBe('entry.upsert');
    const payload = pending[0].payload as { documentId: string; entries: CountEntry[] };
    expect(payload.documentId).toBe('d1');
    expect(payload.entries[0].assetId).toBe('a1');
    expect(payload.entries[0].location).toBe('Warehouse A');
  });

  it('reuses the existing entry row (no duplicate) on re-save', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useSaveCountEntry('d1'), { wrapper });
    const input = {
      assetId: 'a1',
      countQty: 1,
      location: 'L',
      observedSerialNo: '',
      observedSpecification: '',
      observedRemark: '',
      comment: '',
    };
    await act(async () => {
      await result.current.mutateAsync(input);
    });
    await act(async () => {
      await result.current.mutateAsync({ ...input, countQty: 5 });
    });
    expect(await createCountEntryRepo(db).listByDocument('d1')).toHaveLength(1);
    expect((await createCountEntryRepo(db).findByDocumentAndAsset('d1', 'a1'))?.countQty).toBe(5);
  });
});
