import { renderHook, waitFor } from '@testing-library/react-native';
import { makeMigratedTestDb, type TestDb } from '../../../data/db/__tests__/testDb';
import { createCountingDocumentRepo } from '../../../data/repos/countingDocumentRepo';
import { createCountEntryRepo } from '../../../data/repos/countEntryRepo';
import { makeWrapper } from './renderCountingHook';
import { useCountingDocuments } from '../useCountingDocuments';
import type { CountingDocument, CountEntry } from '../../../data/api/carmenApi';

function doc(id: string, status: CountingDocument['status']): CountingDocument {
  return {
    id,
    runningNumber: null,
    locationId: 'loc1',
    locationName: 'Building A Floor 1',
    status,
    countDate: '2026-05-26',
    commitDate: null,
    description: '',
    createdBy: 'u-1',
    createdAt: '2026-05-26T08:00:00Z',
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

describe('useCountingDocuments', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
    const docs = createCountingDocumentRepo(db);
    await docs.upsert(doc('d1', 'draft'));
    await docs.upsert(doc('d2', 'committed'));
    const entries = createCountEntryRepo(db);
    await entries.upsert(entry('e1', 'd1', 'a1', 2));
    await entries.upsert(entry('e2', 'd1', 'a2', 0)); // not counted
  });
  afterEach(() => db.close());

  it('returns only documents of the requested status, with counted totals', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useCountingDocuments('draft'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      { document: expect.objectContaining({ id: 'd1', status: 'draft' }), countedTotal: 1 },
    ]);
  });

  it('returns committed documents with a zero counted total', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useCountingDocuments('committed'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      { document: expect.objectContaining({ id: 'd2', status: 'committed' }), countedTotal: 0 },
    ]);
  });
});
