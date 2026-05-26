import { renderHook, waitFor } from '@testing-library/react-native';
import { makeMigratedTestDb, type TestDb } from '../../../data/db/__tests__/testDb';
import { createAssetRepo } from '../../../data/repos/assetRepo';
import { createCountEntryRepo } from '../../../data/repos/countEntryRepo';
import { makeWrapper } from './renderCountingHook';
import { useAssetCountList } from '../useAssetCountList';
import type { Asset } from '../../../data/repos/types';
import type { CountEntry } from '../../../data/api/carmenApi';

function asset(id: string, code: string, locationId: string): Asset {
  return {
    id,
    code,
    name: code,
    category: null,
    department: null,
    locationId,
    locationName: 'L',
    quantity: 1,
    remainQty: 1,
    price: null,
    currency: null,
    totalAmount: null,
    inputDate: null,
    acquireDate: null,
    assetLife: null,
    remark: null,
    imageUrl: null,
    serialNo: null,
    specification: null,
    updatedAt: '2026-05-22T10:00:00Z',
  };
}
function entry(id: string, documentId: string, assetId: string, countQty: number): CountEntry {
  return {
    id,
    documentId,
    assetId,
    unknownCode: null,
    countQty,
    location: null,
    observedSerialNo: null,
    observedSpecification: null,
    observedRemark: null,
    comment: '',
    photoIds: [],
    transferDate: null,
    scannedAt: '2026-05-26T08:05:00Z',
    updatedAt: '2026-05-26T08:05:00Z',
  };
}

describe('useAssetCountList', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
    await createAssetRepo(db).upsertMany([
      asset('a1', 'AST001', 'loc1'),
      asset('a2', 'AST002', 'loc1'),
      asset('a3', 'AST003', 'loc2'),
    ]);
    await createCountEntryRepo(db).upsert(entry('e1', 'd1', 'a1', 3));
  });
  afterEach(() => db.close());

  it('returns location assets left-joined with this document entries', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useAssetCountList('d1', 'loc1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      { asset: expect.objectContaining({ id: 'a1' }), countedQty: 3 },
      { asset: expect.objectContaining({ id: 'a2' }), countedQty: 0 },
    ]);
  });
});
