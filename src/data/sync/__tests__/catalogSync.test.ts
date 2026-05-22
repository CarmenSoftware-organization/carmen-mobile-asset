import { makeMigratedTestDb, type TestDb } from '../../db/__tests__/testDb';
import { createAssetRepo } from '../../repos/assetRepo';
import { createLocationRepo } from '../../repos/locationRepo';
import { createMetaRepo } from '../../repos/metaRepo';
import { createCatalogSync } from '../catalogSync';
import { MockCarmenApi } from '../../api/mockCarmenApi';

describe('catalogSync', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
  });
  afterEach(() => db.close());

  it('downloads assets and locations into local repos', async () => {
    const api = new MockCarmenApi({ latencyMs: 0 });
    const sync = createCatalogSync({
      api,
      assetRepo: createAssetRepo(db),
      locationRepo: createLocationRepo(db),
      metaRepo: createMetaRepo(db),
    });
    await sync.run();
    const assets = await createAssetRepo(db).list();
    expect(assets).toHaveLength(5);
    const locations = await createLocationRepo(db).list();
    expect(locations).toHaveLength(3);
  });

  it('writes lastSuccessAt to meta', async () => {
    const api = new MockCarmenApi({ latencyMs: 0 });
    const meta = createMetaRepo(db);
    const sync = createCatalogSync({
      api,
      assetRepo: createAssetRepo(db),
      locationRepo: createLocationRepo(db),
      metaRepo: meta,
    });
    await sync.run();
    expect(await meta.get('catalog_last_success_at')).toMatch(/T/);
  });
});
