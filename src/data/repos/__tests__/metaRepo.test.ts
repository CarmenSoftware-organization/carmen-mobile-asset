import { makeMigratedTestDb, type TestDb } from '../../db/__tests__/testDb';
import { createMetaRepo } from '../metaRepo';

describe('metaRepo', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
  });
  afterEach(() => db.close());

  it('returns null for an unknown key', async () => {
    expect(await createMetaRepo(db).get('missing')).toBeNull();
  });

  it('sets and gets a value', async () => {
    const repo = createMetaRepo(db);
    await repo.set('assets_updated_since', '2026-05-22T10:00:00Z');
    expect(await repo.get('assets_updated_since')).toBe('2026-05-22T10:00:00Z');
  });

  it('overwrites an existing value', async () => {
    const repo = createMetaRepo(db);
    await repo.set('k', 'a');
    await repo.set('k', 'b');
    expect(await repo.get('k')).toBe('b');
  });

  it('deletes a key', async () => {
    const repo = createMetaRepo(db);
    await repo.set('k', 'v');
    await repo.delete('k');
    expect(await repo.get('k')).toBeNull();
  });
});
