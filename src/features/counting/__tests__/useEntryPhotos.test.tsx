import { renderHook, waitFor } from '@testing-library/react-native';
import { makeMigratedTestDb, type TestDb } from '../../../data/db/__tests__/testDb';
import { createPhotoRepo } from '../../../data/repos/photoRepo';
import { makeWrapper } from './renderCountingHook';
import { useEntryPhotos } from '../useEntryPhotos';

describe('useEntryPhotos', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
    await createPhotoRepo(db).insert({
      id: 'ph1',
      entryId: 'e1',
      localUri: 'file://a.jpg',
      remoteUrl: null,
      capturedAt: '2026-05-26T09:00:00Z',
      uploadStatus: 'queued',
      attempts: 0,
      lastError: null,
    });
  });
  afterEach(() => db.close());

  it('loads photos for an entry', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useEntryPhotos('e1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((p) => p.id)).toEqual(['ph1']);
  });

  it('returns [] for a falsy entry id (no query)', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useEntryPhotos(''), { wrapper });
    expect(result.current.data ?? []).toEqual([]);
  });
});
