import { makeMigratedTestDb, type TestDb } from '../../db/__tests__/testDb';
import { createLocationRepo } from '../locationRepo';
import type { Location } from '../types';

const sample: Location = {
  id: 'loc1',
  name: 'Building A Floor 1',
  updatedAt: '2026-05-22T10:00:00Z',
};

describe('locationRepo', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
  });
  afterEach(() => db.close());

  it('upserts and lists', async () => {
    const repo = createLocationRepo(db);
    await repo.upsertMany([sample]);
    expect(await repo.list()).toEqual([sample]);
  });

  it('findById returns null when missing', async () => {
    expect(await createLocationRepo(db).findById('nope')).toBeNull();
  });

  it('list is sorted by name', async () => {
    const repo = createLocationRepo(db);
    await repo.upsertMany([{ ...sample, id: 'loc2', name: 'Warehouse A' }, sample]);
    expect((await repo.list()).map((l) => l.name)).toEqual(['Building A Floor 1', 'Warehouse A']);
  });

  it('upsert replaces existing rows', async () => {
    const repo = createLocationRepo(db);
    await repo.upsertMany([sample]);
    await repo.upsertMany([{ ...sample, name: 'Renamed' }]);
    expect((await repo.findById('loc1'))?.name).toBe('Renamed');
  });

  it('deleteByIds removes rows', async () => {
    const repo = createLocationRepo(db);
    await repo.upsertMany([sample, { ...sample, id: 'loc2', name: 'X' }]);
    await repo.deleteByIds(['loc1']);
    expect((await repo.list()).map((l) => l.id)).toEqual(['loc2']);
  });
});
