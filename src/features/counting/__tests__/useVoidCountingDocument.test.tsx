import { renderHook, act } from '@testing-library/react-native';
import { makeMigratedTestDb, type TestDb } from '../../../data/db/__tests__/testDb';
import { createCountingDocumentRepo } from '../../../data/repos/countingDocumentRepo';
import { createPendingMutationRepo } from '../../../data/repos/pendingMutationRepo';
import { makeWrapper } from './renderCountingHook';
import { useVoidCountingDocument } from '../useVoidCountingDocument';
import type { CountingDocument } from '../../../data/api/carmenApi';

const draft: CountingDocument = {
  id: 'd1',
  runningNumber: 'CD26050001',
  locationId: 'loc1',
  locationName: 'Building A Floor 1',
  status: 'draft',
  countDate: '2026-05-26',
  commitDate: null,
  description: '',
  createdBy: 'u-1',
  createdAt: '2026-05-26T08:00:00Z',
};

describe('useVoidCountingDocument', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
    await createCountingDocumentRepo(db).upsert(draft);
  });
  afterEach(() => db.close());

  it('sets status to void locally and enqueues a document.upsert mutation', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useVoidCountingDocument(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(draft);
    });

    const stored = await createCountingDocumentRepo(db).findById('d1');
    expect(stored?.status).toBe('void');

    const pending = await createPendingMutationRepo(db).listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].kind).toBe('document.upsert');
    expect((pending[0].payload as CountingDocument).status).toBe('void');
  });
});
