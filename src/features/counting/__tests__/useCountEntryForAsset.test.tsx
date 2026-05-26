import { renderHook, waitFor } from '@testing-library/react-native';
import { makeMigratedTestDb, type TestDb } from '../../../data/db/__tests__/testDb';
import { createCountEntryRepo } from '../../../data/repos/countEntryRepo';
import { makeWrapper } from './renderCountingHook';
import { useCountEntryForAsset } from '../useCountEntryForAsset';
import type { CountEntry } from '../../../data/api/carmenApi';

const entry: CountEntry = {
  id: 'e1',
  documentId: 'd1',
  assetId: 'a1',
  unknownCode: null,
  countQty: 4,
  location: null,
  observedSerialNo: 'SN-1',
  observedSpecification: null,
  observedRemark: null,
  comment: 'hi',
  photoIds: [],
  transferDate: null,
  scannedAt: '2026-05-26T08:00:00Z',
  updatedAt: '2026-05-26T08:00:00Z',
};

describe('useCountEntryForAsset', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
    await createCountEntryRepo(db).upsert(entry);
  });
  afterEach(() => db.close());

  it('loads an existing entry', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useCountEntryForAsset('d1', 'a1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ id: 'e1', countQty: 4, observedSerialNo: 'SN-1' });
  });

  it('returns null when no entry exists', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useCountEntryForAsset('d1', 'zzz'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});
