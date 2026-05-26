import { renderHook, waitFor } from '@testing-library/react-native';
import { makeMigratedTestDb, type TestDb } from '../../../data/db/__tests__/testDb';
import { createCountingDocumentRepo } from '../../../data/repos/countingDocumentRepo';
import { makeWrapper } from './renderCountingHook';
import { useCountingDocument } from '../useCountingDocument';
import type { CountingDocument } from '../../../data/api/carmenApi';

const doc: CountingDocument = {
  id: 'd1',
  runningNumber: null,
  locationId: 'loc1',
  locationName: 'Building A Floor 1',
  status: 'draft',
  countDate: '2026-05-26',
  commitDate: null,
  description: '',
  createdBy: 'u-1',
  createdAt: '2026-05-26T08:00:00Z',
};

describe('useCountingDocument', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
    await createCountingDocumentRepo(db).upsert(doc);
  });
  afterEach(() => db.close());

  it('loads a document by id', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useCountingDocument('d1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ id: 'd1', locationId: 'loc1', status: 'draft' });
  });

  it('returns null for a missing id', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useCountingDocument('nope'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});
