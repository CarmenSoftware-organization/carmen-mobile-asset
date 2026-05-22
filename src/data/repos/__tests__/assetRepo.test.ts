import { makeMigratedTestDb, type TestDb } from '../../db/__tests__/testDb';
import { createAssetRepo } from '../assetRepo';
import type { Asset } from '../types';

const sample: Asset = {
  id: 'a1',
  code: 'AST001',
  name: 'Desktop Computer',
  category: 'IT Equipment',
  department: 'Finance',
  locationId: 'loc1',
  locationName: 'Building A Floor 1',
  quantity: 1,
  remainQty: 1,
  price: 1200,
  currency: 'USD',
  totalAmount: 1200,
  inputDate: '2024-01-15',
  acquireDate: '2024-01-10',
  assetLife: '2 ปี 4 เดือน',
  remark: 'In good condition',
  imageUrl: null,
  updatedAt: '2026-05-22T10:00:00Z',
};

describe('assetRepo', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
  });
  afterEach(() => db.close());

  it('upserts and lists assets', async () => {
    const repo = createAssetRepo(db);
    await repo.upsertMany([sample]);
    const all = await repo.list();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      id: 'a1',
      code: 'AST001',
      assetLife: '2 ปี 4 เดือน',
    });
  });

  it('findById returns null when missing', async () => {
    expect(await createAssetRepo(db).findById('nope')).toBeNull();
  });

  it('findByCode returns the asset', async () => {
    const repo = createAssetRepo(db);
    await repo.upsertMany([sample]);
    expect((await repo.findByCode('AST001'))?.id).toBe('a1');
  });

  it('upsert replaces an existing asset by id', async () => {
    const repo = createAssetRepo(db);
    await repo.upsertMany([sample]);
    await repo.upsertMany([{ ...sample, name: 'Renamed' }]);
    expect((await repo.findById('a1'))?.name).toBe('Renamed');
  });

  it('search filters by case-insensitive substring on name or code', async () => {
    const repo = createAssetRepo(db);
    await repo.upsertMany([
      sample,
      { ...sample, id: 'a2', code: 'AST002', name: 'Office Chair' },
      { ...sample, id: 'a3', code: 'AST003', name: 'Projector' },
    ]);
    expect((await repo.list({ search: 'chair' })).map((r) => r.id)).toEqual(['a2']);
    expect((await repo.list({ search: 'AST003' })).map((r) => r.id)).toEqual(['a3']);
  });

  it('deleteByIds removes the given assets', async () => {
    const repo = createAssetRepo(db);
    await repo.upsertMany([sample, { ...sample, id: 'a2', code: 'AST002' }]);
    await repo.deleteByIds(['a1']);
    expect((await repo.list()).map((r) => r.id)).toEqual(['a2']);
  });
});
