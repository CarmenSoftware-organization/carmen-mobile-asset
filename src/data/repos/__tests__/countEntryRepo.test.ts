import { makeMigratedTestDb, type TestDb } from '../../db/__tests__/testDb';
import { createCountEntryRepo } from '../countEntryRepo';
import type { CountEntry } from '../../api/carmenApi';

const entry: CountEntry = {
  id: 'e1',
  documentId: 'd1',
  assetId: 'a1',
  unknownCode: null,
  countQty: 1,
  location: null,
  observedSerialNo: null,
  observedSpecification: null,
  observedRemark: null,
  comment: '',
  photoIds: [],
  transferDate: null,
  scannedAt: '2025-06-01T09:00:00Z',
  updatedAt: '2025-06-01T09:00:00Z',
};

describe('countEntryRepo', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
  });
  afterEach(() => db.close());

  it('upserts and round-trips photoIds as JSON', async () => {
    const repo = createCountEntryRepo(db);
    await repo.upsert({ ...entry, photoIds: ['p1', 'p2'], comment: 'ok' });
    const found = await repo.findById('e1');
    expect(found).toMatchObject({ id: 'e1', comment: 'ok', photoIds: ['p1', 'p2'] });
  });

  it('updates the same row on re-upsert (accumulation target)', async () => {
    const repo = createCountEntryRepo(db);
    await repo.upsert(entry);
    await repo.upsert({ ...entry, countQty: 3 });
    expect(await repo.listByDocument('d1')).toHaveLength(1);
    expect((await repo.findById('e1'))?.countQty).toBe(3);
  });

  it('findByDocumentAndAsset locates an existing entry', async () => {
    const repo = createCountEntryRepo(db);
    await repo.upsert(entry);
    expect((await repo.findByDocumentAndAsset('d1', 'a1'))?.id).toBe('e1');
    expect(await repo.findByDocumentAndAsset('d1', 'nope')).toBeNull();
  });

  it('markSynced stamps syncedAt for the given ids', async () => {
    const repo = createCountEntryRepo(db);
    await repo.upsert(entry);
    await repo.markSynced(['e1']);
    const raw = await db.getFirstAsync<{ syncedAt: string | null }>(
      'SELECT syncedAt FROM count_entry WHERE id = ?',
      ['e1'],
    );
    expect(raw?.syncedAt).not.toBeNull();
  });

  it('countedTotalsByDocument counts only entries with countQty > 0, grouped by document', async () => {
    const repo = createCountEntryRepo(db);
    // d1: two counted (a1, a2) + one zero (a3) => 2
    await repo.upsert({ ...entry, id: 'e1', documentId: 'd1', assetId: 'a1', countQty: 1 });
    await repo.upsert({ ...entry, id: 'e2', documentId: 'd1', assetId: 'a2', countQty: 5 });
    await repo.upsert({ ...entry, id: 'e3', documentId: 'd1', assetId: 'a3', countQty: 0 });
    // d2: one counted => 1
    await repo.upsert({ ...entry, id: 'e4', documentId: 'd2', assetId: 'a1', countQty: 2 });

    const totals = await repo.countedTotalsByDocument(['d1', 'd2', 'd3']);
    expect(totals).toEqual({ d1: 2, d2: 1 }); // d3 absent (no counted entries)
  });

  it('countedTotalsByDocument returns {} for an empty id list', async () => {
    const repo = createCountEntryRepo(db);
    expect(await repo.countedTotalsByDocument([])).toEqual({});
  });
});
