import { renderHook, act } from '@testing-library/react-native';
import { makeMigratedTestDb, type TestDb } from '../../../data/db/__tests__/testDb';
import { createCountingDocumentRepo } from '../../../data/repos/countingDocumentRepo';
import { createPendingMutationRepo } from '../../../data/repos/pendingMutationRepo';
import { useAuthStore } from '../../auth/authStore';
import { makeWrapper } from './renderCountingHook';
import { useCreateCountingDocument } from '../useCreateCountingDocument';
import type { Session } from '../../../data/api/carmenApi';
import type { CountingDocument } from '../../../data/api/carmenApi';

const location = { id: 'loc1', name: 'Building A Floor 1', updatedAt: '2026-05-22T10:00:00Z' };
const session: Session = {
  token: 't',
  refreshToken: 'r',
  expiresAt: '2030-01-01T00:00:00Z',
  user: { id: 'u-1', displayName: 'Tester', email: null, roles: [] },
};

describe('useCreateCountingDocument', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
    useAuthStore.setState({ session, status: 'signedIn' });
  });
  afterEach(() => {
    db.close();
    useAuthStore.setState({ session: null, status: 'loading' });
  });

  it('persists a draft document and enqueues a document.upsert mutation', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useCreateCountingDocument(), { wrapper });

    let created: CountingDocument | undefined;
    await act(async () => {
      created = await result.current.mutateAsync(location);
    });

    const stored = await createCountingDocumentRepo(db).list({ status: 'draft' });
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      id: created!.id,
      status: 'draft',
      locationId: 'loc1',
      locationName: 'Building A Floor 1',
      createdBy: 'u-1',
      runningNumber: null,
    });

    const pending = await createPendingMutationRepo(db).listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].kind).toBe('document.upsert');
    expect((pending[0].payload as CountingDocument).id).toBe(created!.id);
  });
});
