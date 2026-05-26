import { renderHook, waitFor } from '@testing-library/react-native';
import { makeMigratedTestDb, type TestDb } from '../../../data/db/__tests__/testDb';
import { createLocationRepo } from '../../../data/repos/locationRepo';
import { makeWrapper } from './renderCountingHook';
import { useLocations } from '../useLocations';

describe('useLocations', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
    await createLocationRepo(db).upsertMany([
      { id: 'loc1', name: 'Building A Floor 1', updatedAt: '2026-05-22T10:00:00Z' },
      { id: 'loc2', name: 'Building A Floor 2', updatedAt: '2026-05-22T10:00:00Z' },
    ]);
  });
  afterEach(() => db.close());

  it('returns locations from the repo', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useLocations(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((l) => l.id)).toEqual(['loc1', 'loc2']);
  });
});
