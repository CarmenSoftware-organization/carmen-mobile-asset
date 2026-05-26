import { makeMigratedTestDb, type TestDb } from '../../db/__tests__/testDb';
import { createCountingDocumentRepo } from '../countingDocumentRepo';
import type { CountingDocument } from '../../api/carmenApi';

const doc: CountingDocument = {
  id: 'd1',
  runningNumber: null,
  locationId: 'loc1',
  locationName: 'Building A Floor 1',
  status: 'draft',
  countDate: '2025-06-01',
  commitDate: null,
  description: 'June count',
  createdBy: 'user1',
  createdAt: '2025-06-01T08:00:00Z',
};

describe('countingDocumentRepo', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
  });
  afterEach(() => db.close());

  it('upserts a doc with syncedAt = null and reads it back', async () => {
    const repo = createCountingDocumentRepo(db);
    await repo.upsert(doc);
    const found = await repo.findById('d1');
    expect(found).toMatchObject({ id: 'd1', status: 'draft', runningNumber: null });
    const raw = await db.getFirstAsync<{ syncedAt: string | null }>(
      'SELECT syncedAt FROM counting_document WHERE id = ?',
      ['d1'],
    );
    expect(raw?.syncedAt).toBeNull();
  });

  it('list filters by status', async () => {
    const repo = createCountingDocumentRepo(db);
    await repo.upsert(doc);
    await repo.upsert({ ...doc, id: 'd2', status: 'committed' });
    await repo.upsert({ ...doc, id: 'd3', status: 'void' });
    expect((await repo.list({ status: 'draft' })).map((d) => d.id)).toEqual(['d1']);
    expect((await repo.list()).map((d) => d.id).sort()).toEqual(['d1', 'd2', 'd3']);
  });

  it('markSynced writes server fields and stamps syncedAt', async () => {
    const repo = createCountingDocumentRepo(db);
    await repo.upsert(doc);
    await repo.markSynced({ ...doc, runningNumber: 'CD25060001' });
    expect((await repo.findById('d1'))?.runningNumber).toBe('CD25060001');
    const raw = await db.getFirstAsync<{ syncedAt: string | null }>(
      'SELECT syncedAt FROM counting_document WHERE id = ?',
      ['d1'],
    );
    expect(raw?.syncedAt).not.toBeNull();
  });
});
