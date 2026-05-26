import { runMigrations } from '../migrate';
import type { Migration } from '../types';
import { makeTestExecutor, makeMigratedTestDb } from './testDb';

describe('runMigrations', () => {
  it('applies all migrations in order on a fresh db', async () => {
    const ex = makeTestExecutor();
    const calls: number[] = [];
    const ms: Migration[] = [
      {
        version: 1,
        async up() {
          calls.push(1);
        },
      },
      {
        version: 2,
        async up() {
          calls.push(2);
        },
      },
    ];
    await runMigrations(ex, ms);
    expect(calls).toEqual([1, 2]);
    const [{ user_version }] = await ex.getAllAsync<{ user_version: number }>(
      'PRAGMA user_version',
    );
    expect(user_version).toBe(2);
    ex.close();
  });

  it('skips migrations already applied', async () => {
    const ex = makeTestExecutor();
    await ex.execAsync('PRAGMA user_version = 1');
    const calls: number[] = [];
    const ms: Migration[] = [
      {
        version: 1,
        async up() {
          calls.push(1);
        },
      },
      {
        version: 2,
        async up() {
          calls.push(2);
        },
      },
    ];
    await runMigrations(ex, ms);
    expect(calls).toEqual([2]);
    ex.close();
  });

  it('throws if migrations are not strictly ordered', async () => {
    const ex = makeTestExecutor();
    const ms: Migration[] = [
      { version: 2, async up() {} },
      { version: 1, async up() {} },
    ];
    await expect(runMigrations(ex, ms)).rejects.toThrow(/order/i);
    ex.close();
  });
});

// makeMigratedTestDb() runs ALL migrations, so these assert the v1 tables/indexes
// survive later migrations. arrayContaining tolerates tables added by newer versions.
describe('schema after all migrations — v1 objects retained', () => {
  it('creates assets, locations, pending_mutations, _meta tables', async () => {
    const ex = await makeMigratedTestDb();
    const rows = await ex.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    );
    expect(rows.map((r) => r.name)).toEqual(
      expect.arrayContaining(['_meta', 'assets', 'locations', 'pending_mutations']),
    );
    ex.close();
  });

  it('creates the asset code index', async () => {
    const ex = await makeMigratedTestDb();
    const rows = await ex.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_assets_code'",
    );
    expect(rows.length).toBe(1);
    ex.close();
  });
});

describe('v2 migration schema', () => {
  it('migration v2 creates counting tables and asset columns', async () => {
    const db = await makeMigratedTestDb();
    const cols = await db.getAllAsync<{ name: string }>("PRAGMA table_info('assets')");
    expect(cols.map((c) => c.name)).toEqual(expect.arrayContaining(['serialNo', 'specification']));
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table'",
    );
    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining(['counting_document', 'count_entry', 'photo']),
    );
    db.close();
  });
});
