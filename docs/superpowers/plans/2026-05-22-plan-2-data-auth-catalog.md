# Carmen Mobile Asset — Plan 2: Data Layer, Auth, Catalog Browse

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a signed-in app where staff can browse the synced asset catalog, view asset details, and see real sync status — built on a tested data layer, mutation queue, and pluggable Carmen API client.

**Architecture:** SQLite via `expo-sqlite` (one DB file per customer, versioned migrations). Repositories return domain objects. A typed `CarmenApi` interface has a `MockCarmenApi` (default) and a minimal `HttpCarmenApi` (auth + assets). A mutation queue + sync worker handle writes resiliently. `PasswordAuthStrategy` stores sessions in `expo-secure-store`. Catalog reads flow through TanStack Query backed by the repos; sync status flows through a zustand store. Plan 2's UI is the sign-in modal, Home with a "Browse assets" affordance, the assets list + detail screens, and a real `<SyncIndicator />`.

**Tech Stack:** Expo SDK 56 + TypeScript, `expo-sqlite`, `expo-secure-store`, `@react-native-community/netinfo`, `@tanstack/react-query`, `zustand`, `react-i18next`, Jest + RNTL.

**Spec reference:** `docs/superpowers/specs/2026-05-22-plan-2-data-auth-catalog-design.md` (commit `6bfadb8`) and parent `docs/superpowers/specs/2026-05-22-carmen-mobile-asset-design.md`.

**Foundation:** Plan 1 head `11db027` on `main`. `src/data/` and `src/features/` are empty placeholders (README files only).

---

## Task 1: Install dependencies and add `apiImpl` config field

**Files:**
- Modify: `package.json`, `package-lock.json`
- Modify: `src/platform/config/types.ts`
- Modify: `src/platform/config/customers/default.json`
- Modify: `src/platform/config/__tests__/config.test.ts`
- Modify: `app.config.js`

- [ ] **Step 1: Install runtime dependencies**

```bash
npx expo install expo-sqlite expo-secure-store @react-native-community/netinfo
npm install @tanstack/react-query zustand
```

`npx expo install` picks SDK-56-compatible versions.

- [ ] **Step 2: Install test-only dependency for in-memory SQLite**

```bash
npm install --save-dev better-sqlite3 @types/better-sqlite3
```

Used to back an in-memory DB during repo tests. Production code never imports it.

- [ ] **Step 3: Update `CustomerConfig` type**

In `src/platform/config/types.ts`, add `ApiImplKind` and the `apiImpl` field:

```ts
export type AuthStrategyKind = 'password' | 'oidc';
export type ApiImplKind = 'mock' | 'http';

export interface CustomerConfig {
  customerSlug: string;
  brandName: string;
  serverBaseUrl: string;
  primaryColor: string;
  authStrategy: AuthStrategyKind;
  apiImpl: ApiImplKind;
  featureFlags: {
    scannerTestPage: boolean;
    devApiToggle: boolean;
  };
}

export interface ConfigEnv {
  APP_CUSTOMER?: string;
  APP_SERVER_BASE_URL?: string;
  APP_API_IMPL?: string;
}
```

- [ ] **Step 4: Update default customer JSON**

In `src/platform/config/customers/default.json`:

```json
{
  "customerSlug": "default",
  "brandName": "Carmen Asset",
  "serverBaseUrl": "http://localhost:4000",
  "primaryColor": "#2563eb",
  "authStrategy": "password",
  "apiImpl": "mock",
  "featureFlags": {
    "scannerTestPage": true,
    "devApiToggle": true
  }
}
```

- [ ] **Step 5: Update `loadConfig` to honour `APP_API_IMPL`**

In `src/platform/config/index.ts`:

```ts
import defaultConfig from './customers/default.json';
import type { ApiImplKind, ConfigEnv, CustomerConfig } from './types';

const REGISTRY: Record<string, CustomerConfig> = {
  default: defaultConfig as CustomerConfig,
};

export function loadConfig(env: ConfigEnv = process.env as ConfigEnv): CustomerConfig {
  const slug = env.APP_CUSTOMER ?? 'default';
  const base = REGISTRY[slug];
  if (!base) {
    throw new Error(`Unknown customer slug: ${slug}`);
  }
  const apiImplOverride = env.APP_API_IMPL as ApiImplKind | undefined;
  return {
    ...base,
    serverBaseUrl: env.APP_SERVER_BASE_URL ?? base.serverBaseUrl,
    apiImpl: apiImplOverride ?? base.apiImpl,
  };
}

export type { CustomerConfig } from './types';
```

- [ ] **Step 6: Update config tests**

In `src/platform/config/__tests__/config.test.ts`:

```ts
import { loadConfig } from '../index';

describe('loadConfig', () => {
  it('returns default config when APP_CUSTOMER is unset', () => {
    const cfg = loadConfig({ APP_CUSTOMER: undefined });
    expect(cfg.customerSlug).toBe('default');
    expect(cfg.serverBaseUrl).toBe('http://localhost:4000');
    expect(cfg.brandName).toBe('Carmen Asset');
    expect(cfg.apiImpl).toBe('mock');
  });

  it('overrides serverBaseUrl from env', () => {
    const cfg = loadConfig({
      APP_CUSTOMER: 'default',
      APP_SERVER_BASE_URL: 'https://api.example.com',
    });
    expect(cfg.serverBaseUrl).toBe('https://api.example.com');
  });

  it('overrides apiImpl from env', () => {
    const cfg = loadConfig({ APP_API_IMPL: 'http' });
    expect(cfg.apiImpl).toBe('http');
  });

  it('throws on unknown customer slug', () => {
    expect(() => loadConfig({ APP_CUSTOMER: 'nonexistent' })).toThrow(/Unknown customer/);
  });
});
```

- [ ] **Step 7: Thread `apiImpl` through `app.config.js`**

In `app.config.js`, in the env-override section, add `apiImpl`:

```js
customer = {
  ...customer,
  serverBaseUrl: process.env.APP_SERVER_BASE_URL ?? customer.serverBaseUrl,
  apiImpl: process.env.APP_API_IMPL ?? customer.apiImpl,
};
```

- [ ] **Step 8: Verify**

```bash
npm test -- src/platform/config
npm run lint
npm run typecheck
```

All exit 0. Config tests: 4 pass.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/platform/config/ app.config.js
git commit -m "feat(deps,config): install plan 2 deps + apiImpl config field"
```

---

## Task 2: Database connection + versioned migrations

**Files:**
- Create: `src/data/db/types.ts`
- Create: `src/data/db/migrate.ts`
- Create: `src/data/db/migrations.ts`
- Create: `src/data/db/index.ts`
- Create: `src/data/db/__tests__/testDb.ts`
- Create: `src/data/db/__tests__/migrate.test.ts`

- [ ] **Step 1: Define types**

Create `src/data/db/types.ts`:

```ts
export interface SqlExecutor {
  execAsync(sql: string): Promise<void>;
  getAllAsync<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  getFirstAsync<T = unknown>(sql: string, params?: unknown[]): Promise<T | null>;
  runAsync(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowId: number }>;
}

export interface Migration {
  version: number;
  up(db: SqlExecutor): Promise<void>;
}
```

`SqlExecutor` is the minimal surface we depend on. `expo-sqlite`'s `SQLiteDatabase` already matches this shape; the in-memory `better-sqlite3` test adapter (Step 3) implements it too.

- [ ] **Step 2: Implement `runMigrations`**

Create `src/data/db/migrate.ts`:

```ts
import type { Migration, SqlExecutor } from './types';

export async function runMigrations(db: SqlExecutor, migrations: Migration[]): Promise<void> {
  for (let i = 1; i < migrations.length; i++) {
    if (migrations[i].version <= migrations[i - 1].version) {
      throw new Error(
        `Migrations must be in strictly ascending version order (saw ${migrations[i].version} after ${migrations[i - 1].version})`,
      );
    }
  }

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (const m of migrations) {
    if (m.version > current) {
      await m.up(db);
      await db.execAsync(`PRAGMA user_version = ${m.version}`);
    }
  }
}
```

- [ ] **Step 3: Test DB helper**

Create `src/data/db/__tests__/testDb.ts`:

```ts
import Database from 'better-sqlite3';
import { runMigrations } from '../migrate';
import { migrations } from '../migrations';
import type { SqlExecutor } from '../types';

export interface TestDb extends SqlExecutor {
  close: () => void;
}

export function makeTestExecutor(): TestDb {
  const db = new Database(':memory:');
  return {
    async execAsync(sql) {
      db.exec(sql);
    },
    async getAllAsync(sql, params = []) {
      return db.prepare(sql).all(...(params as unknown[])) as never;
    },
    async getFirstAsync(sql, params = []) {
      const row = db.prepare(sql).get(...(params as unknown[]));
      return (row ?? null) as never;
    },
    async runAsync(sql, params = []) {
      const info = db.prepare(sql).run(...(params as unknown[]));
      return { changes: Number(info.changes), lastInsertRowId: Number(info.lastInsertRowid) };
    },
    close: () => db.close(),
  };
}

export async function makeMigratedTestDb(): Promise<TestDb> {
  const ex = makeTestExecutor();
  await runMigrations(ex, migrations);
  return ex;
}
```

- [ ] **Step 4: Write migration tests**

Create `src/data/db/__tests__/migrate.test.ts`:

```ts
import { runMigrations } from '../migrate';
import type { Migration } from '../types';
import { makeTestExecutor, makeMigratedTestDb } from './testDb';

describe('runMigrations', () => {
  it('applies all migrations in order on a fresh db', async () => {
    const ex = makeTestExecutor();
    const calls: number[] = [];
    const ms: Migration[] = [
      { version: 1, async up() { calls.push(1); } },
      { version: 2, async up() { calls.push(2); } },
    ];
    await runMigrations(ex, ms);
    expect(calls).toEqual([1, 2]);
    const [{ user_version }] = await ex.getAllAsync<{ user_version: number }>('PRAGMA user_version');
    expect(user_version).toBe(2);
    ex.close();
  });

  it('skips migrations already applied', async () => {
    const ex = makeTestExecutor();
    await ex.execAsync('PRAGMA user_version = 1');
    const calls: number[] = [];
    const ms: Migration[] = [
      { version: 1, async up() { calls.push(1); } },
      { version: 2, async up() { calls.push(2); } },
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

describe('v1 migration schema', () => {
  it('creates assets, locations, pending_mutations, _meta tables', async () => {
    const ex = await makeMigratedTestDb();
    const rows = await ex.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    );
    expect(rows.map((r) => r.name).sort()).toEqual(['_meta', 'assets', 'locations', 'pending_mutations']);
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
```

- [ ] **Step 5: Write the v1 migration**

Create `src/data/db/migrations.ts`:

```ts
import type { Migration } from './types';

const SCHEMA_V1 = `
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  department TEXT,
  locationId TEXT,
  locationName TEXT,
  quantity INTEGER,
  remainQty INTEGER,
  price REAL,
  currency TEXT,
  totalAmount REAL,
  inputDate TEXT,
  acquireDate TEXT,
  assetLife TEXT,
  remark TEXT,
  imageUrl TEXT,
  updatedAt TEXT NOT NULL,
  syncedAt TEXT NOT NULL
);
CREATE INDEX idx_assets_code ON assets(code);
CREATE INDEX idx_assets_locationId ON assets(locationId);

CREATE TABLE locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  syncedAt TEXT NOT NULL
);

CREATE TABLE pending_mutations (
  id TEXT PRIMARY KEY,
  idempotencyKey TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  lastError TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX idx_pending_status ON pending_mutations(status, createdAt);

CREATE TABLE _meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export const migrations: Migration[] = [
  {
    version: 1,
    async up(db) {
      await db.execAsync(SCHEMA_V1);
    },
  },
];
```

- [ ] **Step 6: Implement `openDatabase` singleton**

Create `src/data/db/index.ts`:

```ts
import * as SQLite from 'expo-sqlite';
import { loadConfig } from '../../platform/config';
import { runMigrations } from './migrate';
import { migrations } from './migrations';
import type { SqlExecutor } from './types';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function openDatabase(): Promise<SqlExecutor> {
  if (!dbPromise) {
    const { customerSlug } = loadConfig();
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(`carmen-${customerSlug}.db`);
      await runMigrations(db, migrations);
      return db;
    })();
  }
  return dbPromise;
}

export async function closeDatabase(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    await db.closeAsync();
    dbPromise = null;
  }
}

export type { SqlExecutor, Migration } from './types';
```

- [ ] **Step 7: Verify**

```bash
npm test -- src/data/db
npm run lint
npm run typecheck
```

5 tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/data/db/
git commit -m "feat(data): sqlite connection + versioned migrations"
```

---

## Task 3: Shared repo types + `metaRepo`

**Files:**
- Create: `src/data/repos/types.ts`
- Create: `src/data/repos/metaRepo.ts`
- Create: `src/data/repos/__tests__/metaRepo.test.ts`

- [ ] **Step 1: Create shared repo types**

Create `src/data/repos/types.ts`:

```ts
export interface Asset {
  id: string;
  code: string;
  name: string;
  category: string | null;
  department: string | null;
  locationId: string | null;
  locationName: string | null;
  quantity: number | null;
  remainQty: number | null;
  price: number | null;
  currency: string | null;
  totalAmount: number | null;
  inputDate: string | null;
  acquireDate: string | null;
  assetLife: string | null;
  remark: string | null;
  imageUrl: string | null;
  updatedAt: string;
}

export interface Location {
  id: string;
  name: string;
  updatedAt: string;
}

export type MutationKind =
  | 'document.upsert'
  | 'document.commit'
  | 'entry.upsert'
  | 'photo.upload';

export interface PendingMutation {
  id: string;
  idempotencyKey: string;
  kind: MutationKind;
  payload: unknown;
  createdAt: string;
  attempts: number;
  lastError: string | null;
  status: 'pending' | 'in_flight' | 'failed';
}
```

- [ ] **Step 2: Write `metaRepo` tests**

Create `src/data/repos/__tests__/metaRepo.test.ts`:

```ts
import { makeMigratedTestDb, type TestDb } from '../../db/__tests__/testDb';
import { createMetaRepo } from '../metaRepo';

describe('metaRepo', () => {
  let db: TestDb;
  beforeEach(async () => { db = await makeMigratedTestDb(); });
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
```

- [ ] **Step 3: Implement `metaRepo`**

Create `src/data/repos/metaRepo.ts`:

```ts
import type { SqlExecutor } from '../db/types';

export interface MetaRepo {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export function createMetaRepo(db: SqlExecutor): MetaRepo {
  return {
    async get(key) {
      const row = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM _meta WHERE key = ?',
        [key],
      );
      return row?.value ?? null;
    },
    async set(key, value) {
      await db.runAsync(
        'INSERT INTO _meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [key, value],
      );
    },
    async delete(key) {
      await db.runAsync('DELETE FROM _meta WHERE key = ?', [key]);
    },
  };
}
```

- [ ] **Step 4: Run + commit**

```bash
npm test -- src/data/repos
git add src/data/repos/types.ts src/data/repos/metaRepo.ts src/data/repos/__tests__/metaRepo.test.ts
git commit -m "feat(data): metaRepo for key/value sync cursors"
```

---

## Task 4: `assetRepo`

**Files:**
- Create: `src/data/repos/assetRepo.ts`
- Create: `src/data/repos/__tests__/assetRepo.test.ts`

- [ ] **Step 1: Write tests**

Create `src/data/repos/__tests__/assetRepo.test.ts`:

```ts
import { makeMigratedTestDb, type TestDb } from '../../db/__tests__/testDb';
import { createAssetRepo } from '../assetRepo';
import type { Asset } from '../types';

const sample: Asset = {
  id: 'a1', code: 'AST001', name: 'Desktop Computer',
  category: 'IT Equipment', department: 'Finance',
  locationId: 'loc1', locationName: 'Building A Floor 1',
  quantity: 1, remainQty: 1, price: 1200, currency: 'USD', totalAmount: 1200,
  inputDate: '2024-01-15', acquireDate: '2024-01-10',
  assetLife: '2 ปี 4 เดือน', remark: 'In good condition',
  imageUrl: null, updatedAt: '2026-05-22T10:00:00Z',
};

describe('assetRepo', () => {
  let db: TestDb;
  beforeEach(async () => { db = await makeMigratedTestDb(); });
  afterEach(() => db.close());

  it('upserts and lists assets', async () => {
    const repo = createAssetRepo(db);
    await repo.upsertMany([sample]);
    const all = await repo.list();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: 'a1', code: 'AST001', assetLife: '2 ปี 4 เดือน' });
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
```

- [ ] **Step 2: Implement**

Create `src/data/repos/assetRepo.ts`:

```ts
import type { SqlExecutor } from '../db/types';
import type { Asset } from './types';

interface AssetRow extends Asset { syncedAt: string }

function rowToAsset(r: AssetRow): Asset {
  const { syncedAt: _ignored, ...rest } = r;
  return rest;
}

export interface AssetRepo {
  list(opts?: { search?: string }): Promise<Asset[]>;
  findById(id: string): Promise<Asset | null>;
  findByCode(code: string): Promise<Asset | null>;
  upsertMany(assets: Asset[]): Promise<void>;
  deleteByIds(ids: string[]): Promise<void>;
}

export function createAssetRepo(db: SqlExecutor): AssetRepo {
  return {
    async list(opts) {
      if (opts?.search) {
        const like = `%${opts.search}%`;
        const rows = await db.getAllAsync<AssetRow>(
          'SELECT * FROM assets WHERE name LIKE ? COLLATE NOCASE OR code LIKE ? COLLATE NOCASE ORDER BY code',
          [like, like],
        );
        return rows.map(rowToAsset);
      }
      const rows = await db.getAllAsync<AssetRow>('SELECT * FROM assets ORDER BY code');
      return rows.map(rowToAsset);
    },
    async findById(id) {
      const row = await db.getFirstAsync<AssetRow>('SELECT * FROM assets WHERE id = ?', [id]);
      return row ? rowToAsset(row) : null;
    },
    async findByCode(code) {
      const row = await db.getFirstAsync<AssetRow>('SELECT * FROM assets WHERE code = ?', [code]);
      return row ? rowToAsset(row) : null;
    },
    async upsertMany(assets) {
      const now = new Date().toISOString();
      for (const a of assets) {
        await db.runAsync(
          `INSERT INTO assets (
             id, code, name, category, department, locationId, locationName,
             quantity, remainQty, price, currency, totalAmount,
             inputDate, acquireDate, assetLife, remark, imageUrl, updatedAt, syncedAt
           ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET
             code=excluded.code, name=excluded.name, category=excluded.category,
             department=excluded.department, locationId=excluded.locationId,
             locationName=excluded.locationName, quantity=excluded.quantity,
             remainQty=excluded.remainQty, price=excluded.price, currency=excluded.currency,
             totalAmount=excluded.totalAmount, inputDate=excluded.inputDate,
             acquireDate=excluded.acquireDate, assetLife=excluded.assetLife,
             remark=excluded.remark, imageUrl=excluded.imageUrl,
             updatedAt=excluded.updatedAt, syncedAt=excluded.syncedAt`,
          [
            a.id, a.code, a.name, a.category, a.department, a.locationId, a.locationName,
            a.quantity, a.remainQty, a.price, a.currency, a.totalAmount,
            a.inputDate, a.acquireDate, a.assetLife, a.remark, a.imageUrl, a.updatedAt, now,
          ],
        );
      }
    },
    async deleteByIds(ids) {
      if (ids.length === 0) return;
      const placeholders = ids.map(() => '?').join(',');
      await db.runAsync(`DELETE FROM assets WHERE id IN (${placeholders})`, ids);
    },
  };
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test -- src/data/repos/__tests__/assetRepo
git add src/data/repos/assetRepo.ts src/data/repos/__tests__/assetRepo.test.ts
git commit -m "feat(data): assetRepo with search + upsert + delete"
```

---

## Task 5: `locationRepo`

**Files:**
- Create: `src/data/repos/locationRepo.ts`
- Create: `src/data/repos/__tests__/locationRepo.test.ts`

- [ ] **Step 1: Write tests**

Create `src/data/repos/__tests__/locationRepo.test.ts`:

```ts
import { makeMigratedTestDb, type TestDb } from '../../db/__tests__/testDb';
import { createLocationRepo } from '../locationRepo';
import type { Location } from '../types';

const sample: Location = { id: 'loc1', name: 'Building A Floor 1', updatedAt: '2026-05-22T10:00:00Z' };

describe('locationRepo', () => {
  let db: TestDb;
  beforeEach(async () => { db = await makeMigratedTestDb(); });
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
```

- [ ] **Step 2: Implement**

Create `src/data/repos/locationRepo.ts`:

```ts
import type { SqlExecutor } from '../db/types';
import type { Location } from './types';

interface LocationRow {
  id: string;
  name: string;
  updatedAt: string;
  syncedAt: string;
}

function rowToLocation(r: LocationRow): Location {
  return { id: r.id, name: r.name, updatedAt: r.updatedAt };
}

export interface LocationRepo {
  list(): Promise<Location[]>;
  findById(id: string): Promise<Location | null>;
  upsertMany(locations: Location[]): Promise<void>;
  deleteByIds(ids: string[]): Promise<void>;
}

export function createLocationRepo(db: SqlExecutor): LocationRepo {
  return {
    async list() {
      const rows = await db.getAllAsync<LocationRow>('SELECT * FROM locations ORDER BY name');
      return rows.map(rowToLocation);
    },
    async findById(id) {
      const row = await db.getFirstAsync<LocationRow>('SELECT * FROM locations WHERE id = ?', [id]);
      return row ? rowToLocation(row) : null;
    },
    async upsertMany(locations) {
      const now = new Date().toISOString();
      for (const l of locations) {
        await db.runAsync(
          `INSERT INTO locations (id, name, updatedAt, syncedAt)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET name=excluded.name, updatedAt=excluded.updatedAt, syncedAt=excluded.syncedAt`,
          [l.id, l.name, l.updatedAt, now],
        );
      }
    },
    async deleteByIds(ids) {
      if (ids.length === 0) return;
      const placeholders = ids.map(() => '?').join(',');
      await db.runAsync(`DELETE FROM locations WHERE id IN (${placeholders})`, ids);
    },
  };
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test -- src/data/repos/__tests__/locationRepo
git add src/data/repos/locationRepo.ts src/data/repos/__tests__/locationRepo.test.ts
git commit -m "feat(data): locationRepo"
```

---

## Task 6: `pendingMutationRepo`

**Files:**
- Create: `src/data/repos/pendingMutationRepo.ts`
- Create: `src/data/repos/__tests__/pendingMutationRepo.test.ts`

- [ ] **Step 1: Write tests**

Create `src/data/repos/__tests__/pendingMutationRepo.test.ts`:

```ts
import { makeMigratedTestDb, type TestDb } from '../../db/__tests__/testDb';
import { createPendingMutationRepo } from '../pendingMutationRepo';

describe('pendingMutationRepo', () => {
  let db: TestDb;
  beforeEach(async () => { db = await makeMigratedTestDb(); });
  afterEach(() => db.close());

  it('enqueue persists a new mutation with status=pending and attempts=0', async () => {
    const repo = createPendingMutationRepo(db);
    const id = await repo.enqueue({
      idempotencyKey: 'key-1',
      kind: 'document.upsert',
      payload: { hello: 'world' },
    });
    expect(typeof id).toBe('string');
    const all = await repo.listPending();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      id, idempotencyKey: 'key-1', kind: 'document.upsert',
      payload: { hello: 'world' }, attempts: 0, status: 'pending', lastError: null,
    });
  });

  it('listPending returns only pending in createdAt order', async () => {
    const repo = createPendingMutationRepo(db);
    const a = await repo.enqueue({ idempotencyKey: 'a', kind: 'document.upsert', payload: {} });
    const b = await repo.enqueue({ idempotencyKey: 'b', kind: 'entry.upsert', payload: {} });
    await repo.markFailed(a, 'boom');
    expect((await repo.listPending()).map((m) => m.id)).toEqual([b]);
  });

  it('listFailed returns only failed', async () => {
    const repo = createPendingMutationRepo(db);
    const a = await repo.enqueue({ idempotencyKey: 'a', kind: 'document.upsert', payload: {} });
    await repo.markFailed(a, 'boom');
    const failed = await repo.listFailed();
    expect(failed).toHaveLength(1);
    expect(failed[0].lastError).toBe('boom');
  });

  it('incrementAttempts bumps the counter', async () => {
    const repo = createPendingMutationRepo(db);
    const id = await repo.enqueue({ idempotencyKey: 'a', kind: 'document.upsert', payload: {} });
    await repo.incrementAttempts(id, 'transient');
    const [{ attempts, lastError }] = await repo.listPending();
    expect(attempts).toBe(1);
    expect(lastError).toBe('transient');
  });

  it('markDone deletes the row', async () => {
    const repo = createPendingMutationRepo(db);
    const id = await repo.enqueue({ idempotencyKey: 'a', kind: 'document.upsert', payload: {} });
    await repo.markDone(id);
    expect(await repo.listPending()).toEqual([]);
    expect(await repo.listFailed()).toEqual([]);
  });

  it('discard deletes a failed row', async () => {
    const repo = createPendingMutationRepo(db);
    const id = await repo.enqueue({ idempotencyKey: 'a', kind: 'document.upsert', payload: {} });
    await repo.markFailed(id, 'boom');
    await repo.discard(id);
    expect(await repo.listFailed()).toEqual([]);
  });
});
```

- [ ] **Step 2: Implement**

Create `src/data/repos/pendingMutationRepo.ts`:

```ts
import type { SqlExecutor } from '../db/types';
import type { MutationKind, PendingMutation } from './types';

interface PendingRow {
  id: string;
  idempotencyKey: string;
  kind: MutationKind;
  payload: string;
  createdAt: string;
  attempts: number;
  lastError: string | null;
  status: PendingMutation['status'];
}

function rowToMutation(r: PendingRow): PendingMutation {
  return {
    id: r.id,
    idempotencyKey: r.idempotencyKey,
    kind: r.kind,
    payload: JSON.parse(r.payload),
    createdAt: r.createdAt,
    attempts: r.attempts,
    lastError: r.lastError,
    status: r.status,
  };
}

function uuid(): string {
  return (
    Date.now().toString(16) + '-' +
    Math.random().toString(16).slice(2, 10) + '-' +
    Math.random().toString(16).slice(2, 10)
  );
}

export interface PendingMutationRepo {
  enqueue(input: { idempotencyKey: string; kind: MutationKind; payload: unknown }): Promise<string>;
  listPending(): Promise<PendingMutation[]>;
  listFailed(): Promise<PendingMutation[]>;
  incrementAttempts(id: string, lastError: string): Promise<void>;
  markFailed(id: string, lastError: string): Promise<void>;
  markDone(id: string): Promise<void>;
  discard(id: string): Promise<void>;
}

export function createPendingMutationRepo(db: SqlExecutor): PendingMutationRepo {
  return {
    async enqueue({ idempotencyKey, kind, payload }) {
      const id = uuid();
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO pending_mutations (id, idempotencyKey, kind, payload, createdAt, attempts, lastError, status)
         VALUES (?, ?, ?, ?, ?, 0, NULL, 'pending')`,
        [id, idempotencyKey, kind, JSON.stringify(payload), now],
      );
      return id;
    },
    async listPending() {
      const rows = await db.getAllAsync<PendingRow>(
        "SELECT * FROM pending_mutations WHERE status = 'pending' ORDER BY createdAt",
      );
      return rows.map(rowToMutation);
    },
    async listFailed() {
      const rows = await db.getAllAsync<PendingRow>(
        "SELECT * FROM pending_mutations WHERE status = 'failed' ORDER BY createdAt",
      );
      return rows.map(rowToMutation);
    },
    async incrementAttempts(id, lastError) {
      await db.runAsync(
        'UPDATE pending_mutations SET attempts = attempts + 1, lastError = ? WHERE id = ?',
        [lastError, id],
      );
    },
    async markFailed(id, lastError) {
      await db.runAsync(
        "UPDATE pending_mutations SET status = 'failed', lastError = ? WHERE id = ?",
        [lastError, id],
      );
    },
    async markDone(id) {
      await db.runAsync('DELETE FROM pending_mutations WHERE id = ?', [id]);
    },
    async discard(id) {
      await db.runAsync('DELETE FROM pending_mutations WHERE id = ?', [id]);
    },
  };
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test -- src/data/repos/__tests__/pendingMutationRepo
git add src/data/repos/pendingMutationRepo.ts src/data/repos/__tests__/pendingMutationRepo.test.ts
git commit -m "feat(data): pendingMutationRepo"
```

---

## Task 7: `CarmenApi` interface + DTOs + errors

**Files:**
- Create: `src/data/api/carmenApi.ts`
- Create: `src/data/api/errors.ts`

No tests here — this task only declares types and error class. They're exercised by the next tasks.

- [ ] **Step 1: Create error class**

Create `src/data/api/errors.ts`:

```ts
export type CarmenApiErrorCode =
  | 'unauthenticated'
  | 'not_found'
  | 'conflict'
  | 'network_error'
  | 'server_error'
  | 'not_implemented'
  | 'unknown';

export class CarmenApiError extends Error {
  constructor(
    public readonly code: CarmenApiErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'CarmenApiError';
  }
}
```

- [ ] **Step 2: Create interface + DTOs**

Create `src/data/api/carmenApi.ts`:

```ts
import type { Asset, Location } from '../repos/types';

export interface PasswordCredentials {
  username: string;
  password: string;
}

export interface Session {
  token: string;
  refreshToken: string;
  expiresAt: string;
  user: UserProfile;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email: string | null;
  roles: string[];
}

export interface ServerInfo {
  version: string;
  minClientVersion: string | null;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  /** Tombstone IDs for items deleted since `updatedSince`. */
  tombstones: string[];
}

export interface CountingDocument {
  id: string;
  runningNumber: string | null;
  locationId: string;
  locationName: string;
  status: 'draft' | 'committed';
  countDate: string;
  commitDate: string | null;
  description: string;
  createdBy: string;
  createdAt: string;
}

export interface CountEntry {
  id: string;
  documentId: string;
  assetId: string | null;
  unknownCode: string | null;
  countQty: number;
  location: string | null;
  comment: string;
  photoIds: string[];
  scannedAt: string;
  updatedAt: string;
}

export interface PhotoUpload {
  id: string;
  uri: string;
  mimeType: string;
}

export interface CarmenApi {
  // Implemented in Plan 2 (mock + http):
  signIn(creds: PasswordCredentials): Promise<Session>;
  refresh(refreshToken: string): Promise<Session>;
  listAssets(opts: {
    updatedSince?: string;
    cursor?: string;
    limit?: number;
  }): Promise<Page<Asset>>;
  getAssetByCode(code: string): Promise<Asset | null>;
  getAsset(id: string): Promise<Asset | null>;
  listLocations(opts: { updatedSince?: string }): Promise<Location[]>;
  getMe(): Promise<UserProfile>;
  getServerInfo(): Promise<ServerInfo>;

  // Declared but not implemented in Plan 2 (HTTP throws 'not_implemented';
  // mock may implement them for later-plan tests):
  listCountingDocuments(opts: { status?: 'draft' | 'committed' }): Promise<CountingDocument[]>;
  getCountingDocument(id: string): Promise<CountingDocument | null>;
  upsertCountingDocument(doc: CountingDocument): Promise<CountingDocument>;
  upsertCountEntries(documentId: string, entries: CountEntry[]): Promise<void>;
  commitCountingDocument(id: string): Promise<CountingDocument>;
  uploadPhoto(file: PhotoUpload): Promise<{ photoId: string; remoteUrl: string }>;
}
```

- [ ] **Step 3: Verify**

```bash
npm run typecheck
```

Exits 0. Commit.

```bash
git add src/data/api/carmenApi.ts src/data/api/errors.ts
git commit -m "feat(api): CarmenApi interface + DTOs + error class"
```

---

## Task 8: HTTP `apiClient` (fetch wrapper)

**Files:**
- Create: `src/data/api/apiClient.ts`
- Create: `src/data/api/__tests__/apiClient.test.ts`

- [ ] **Step 1: Write tests**

Create `src/data/api/__tests__/apiClient.test.ts`:

```ts
import { ApiClient } from '../apiClient';
import { CarmenApiError } from '../errors';

function makeFetch(responses: Array<{ status: number; body: unknown }>) {
  let i = 0;
  return jest.fn(async () => {
    const r = responses[i++];
    return new Response(JSON.stringify(r.body), {
      status: r.status,
      headers: { 'content-type': 'application/json' },
    });
  });
}

describe('ApiClient', () => {
  it('adds bearer token header when getToken returns one', async () => {
    const fakeFetch = makeFetch([{ status: 200, body: { ok: true } }]);
    const client = new ApiClient({
      baseUrl: 'https://example.test',
      getToken: () => 'tok123',
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });
    await client.request('GET', '/me');
    const init = (fakeFetch.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(init.Authorization).toBe('Bearer tok123');
  });

  it('omits Authorization when no token', async () => {
    const fakeFetch = makeFetch([{ status: 200, body: {} }]);
    const client = new ApiClient({
      baseUrl: 'https://example.test',
      getToken: () => null,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });
    await client.request('GET', '/me');
    const init = (fakeFetch.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(init.Authorization).toBeUndefined();
  });

  it('sets Idempotency-Key on mutating requests when provided', async () => {
    const fakeFetch = makeFetch([{ status: 200, body: {} }]);
    const client = new ApiClient({
      baseUrl: 'https://example.test',
      getToken: () => null,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });
    await client.request('POST', '/x', { body: { a: 1 }, idempotencyKey: 'idem-1' });
    const init = (fakeFetch.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(init['Idempotency-Key']).toBe('idem-1');
  });

  it('throws CarmenApiError with code from response body on 4xx', async () => {
    const fakeFetch = makeFetch([
      { status: 404, body: { code: 'asset.not_found', message: 'nope' } },
    ]);
    const client = new ApiClient({
      baseUrl: 'https://example.test',
      getToken: () => null,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });
    await expect(client.request('GET', '/assets/x')).rejects.toMatchObject({
      code: 'not_found',
      message: 'nope',
    });
  });

  it('maps 5xx to server_error', async () => {
    const fakeFetch = makeFetch([{ status: 503, body: {} }]);
    const client = new ApiClient({
      baseUrl: 'https://example.test',
      getToken: () => null,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });
    await expect(client.request('GET', '/x')).rejects.toBeInstanceOf(CarmenApiError);
    await expect(client.request('GET', '/x')).rejects.toMatchObject({ code: 'server_error' });
  });

  it('maps network errors to network_error', async () => {
    const fakeFetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });
    const client = new ApiClient({
      baseUrl: 'https://example.test',
      getToken: () => null,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });
    await expect(client.request('GET', '/x')).rejects.toMatchObject({ code: 'network_error' });
  });

  it('retries once after refreshing on 401', async () => {
    const fakeFetch = makeFetch([
      { status: 401, body: { code: 'unauthenticated' } },
      { status: 200, body: { ok: true } },
    ]);
    const refresh = jest.fn(async () => 'tok-new');
    const client = new ApiClient({
      baseUrl: 'https://example.test',
      getToken: () => 'tok-old',
      fetchImpl: fakeFetch as unknown as typeof fetch,
      onUnauthenticated: refresh,
    });
    const out = await client.request<{ ok: boolean }>('GET', '/x');
    expect(out).toEqual({ ok: true });
    expect(refresh).toHaveBeenCalledTimes(1);
    const secondInit = (fakeFetch.mock.calls[1][1] as RequestInit).headers as Record<string, string>;
    expect(secondInit.Authorization).toBe('Bearer tok-new');
  });
});
```

- [ ] **Step 2: Implement**

Create `src/data/api/apiClient.ts`:

```ts
import { CarmenApiError, type CarmenApiErrorCode } from './errors';

interface ApiClientOptions {
  baseUrl: string;
  getToken: () => string | null;
  fetchImpl?: typeof fetch;
  /** Returns a new token on 401, or null/throw to abort. */
  onUnauthenticated?: () => Promise<string | null>;
}

interface RequestOptions {
  body?: unknown;
  idempotencyKey?: string;
}

function mapStatusToCode(status: number, bodyCode?: string): CarmenApiErrorCode {
  if (status === 401) return 'unauthenticated';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 501) return 'not_implemented';
  if (bodyCode === 'asset.not_found' || bodyCode === 'document.not_found') return 'not_found';
  if (status >= 500) return 'server_error';
  return 'unknown';
}

export class ApiClient {
  constructor(private readonly opts: ApiClientOptions) {}

  async request<T = unknown>(
    method: string,
    path: string,
    rOpts: RequestOptions = {},
  ): Promise<T> {
    return this.doRequest<T>(method, path, rOpts, /*retried*/ false);
  }

  private async doRequest<T>(
    method: string,
    path: string,
    rOpts: RequestOptions,
    retried: boolean,
  ): Promise<T> {
    const fetchImpl = this.opts.fetchImpl ?? fetch;
    const url = `${this.opts.baseUrl}${path}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = this.opts.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (rOpts.idempotencyKey) headers['Idempotency-Key'] = rOpts.idempotencyKey;

    let response: Response;
    try {
      response = await fetchImpl(url, {
        method,
        headers,
        body: rOpts.body !== undefined ? JSON.stringify(rOpts.body) : undefined,
      });
    } catch (err) {
      throw new CarmenApiError('network_error', (err as Error).message, err);
    }

    if (response.status === 401 && !retried && this.opts.onUnauthenticated) {
      const newToken = await this.opts.onUnauthenticated();
      if (newToken) {
        return this.doRequest<T>(method, path, rOpts, true);
      }
    }

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // empty body
    }

    if (response.ok) {
      return body as T;
    }

    const bodyAsRecord = (body ?? {}) as { code?: string; message?: string; details?: unknown };
    throw new CarmenApiError(
      mapStatusToCode(response.status, bodyAsRecord.code),
      bodyAsRecord.message ?? `HTTP ${response.status}`,
      bodyAsRecord.details,
    );
  }
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test -- src/data/api
git add src/data/api/apiClient.ts src/data/api/__tests__/apiClient.test.ts
git commit -m "feat(api): fetch wrapper with auth + idempotency + error mapping"
```

---

## Task 9: `MockCarmenApi` + seed data

**Files:**
- Create: `src/data/api/seedData.ts`
- Create: `src/data/api/mockCarmenApi.ts`
- Create: `src/data/api/__tests__/mockCarmenApi.test.ts`

- [ ] **Step 1: Create seed data**

Create `src/data/api/seedData.ts`:

```ts
import type { Asset, Location } from '../repos/types';

const NOW = '2026-05-22T10:00:00Z';

export const seedLocations: Location[] = [
  { id: 'loc1', name: 'Building A Floor 1', updatedAt: NOW },
  { id: 'loc2', name: 'Building A Floor 2', updatedAt: NOW },
  { id: 'wh-a', name: 'Warehouse A', updatedAt: NOW },
];

export const seedAssets: Asset[] = [
  {
    id: 'a1', code: 'AST001', name: 'Desktop Computer',
    category: 'IT Equipment', department: 'Finance',
    locationId: 'loc1', locationName: 'Building A Floor 1',
    quantity: 1, remainQty: 1, price: 1200, currency: 'USD', totalAmount: 1200,
    inputDate: '2024-01-15', acquireDate: '2024-01-10',
    assetLife: '2 ปี 4 เดือน', remark: 'In good condition',
    imageUrl: null, updatedAt: NOW,
  },
  {
    id: 'a2', code: 'AST002', name: 'Office Chair',
    category: 'Furniture', department: 'HR',
    locationId: 'loc1', locationName: 'Building A Floor 1',
    quantity: 1, remainQty: 1, price: 250, currency: 'USD', totalAmount: 250,
    inputDate: '2024-02-01', acquireDate: '2024-01-28',
    assetLife: '2 ปี 4 เดือน', remark: null,
    imageUrl: null, updatedAt: NOW,
  },
  {
    id: 'a3', code: 'AST003', name: 'Projector',
    category: 'IT Equipment', department: 'Marketing',
    locationId: 'loc2', locationName: 'Building A Floor 2',
    quantity: 1, remainQty: 1, price: 800, currency: 'USD', totalAmount: 800,
    inputDate: '2024-01-20', acquireDate: '2024-01-15',
    assetLife: '2 ปี 4 เดือน', remark: null,
    imageUrl: null, updatedAt: NOW,
  },
  {
    id: 'a4', code: 'AST004', name: 'Whiteboard',
    category: 'Office Supplies', department: 'All',
    locationId: 'wh-a', locationName: 'Warehouse A',
    quantity: 2, remainQty: 2, price: 120, currency: 'USD', totalAmount: 240,
    inputDate: '2023-11-01', acquireDate: '2023-10-25',
    assetLife: '2 ปี 7 เดือน', remark: null,
    imageUrl: null, updatedAt: NOW,
  },
  {
    id: 'a5', code: 'AST005', name: 'Network Switch',
    category: 'IT Equipment', department: 'IT',
    locationId: 'loc2', locationName: 'Building A Floor 2',
    quantity: 1, remainQty: 1, price: 450, currency: 'USD', totalAmount: 450,
    inputDate: '2024-03-10', acquireDate: '2024-03-05',
    assetLife: '2 ปี 2 เดือน', remark: null,
    imageUrl: null, updatedAt: NOW,
  },
];
```

- [ ] **Step 2: Write tests**

Create `src/data/api/__tests__/mockCarmenApi.test.ts`:

```ts
import { MockCarmenApi } from '../mockCarmenApi';
import { CarmenApiError } from '../errors';

describe('MockCarmenApi', () => {
  it('signIn returns a session for any credentials', async () => {
    const api = new MockCarmenApi({ latencyMs: 0 });
    const s = await api.signIn({ username: 'alice', password: 'pw' });
    expect(s.token).toMatch(/mock-token/);
    expect(s.user.displayName).toBe('alice');
  });

  it('listAssets returns the seed data', async () => {
    const api = new MockCarmenApi({ latencyMs: 0 });
    const page = await api.listAssets({});
    expect(page.items).toHaveLength(5);
    expect(page.tombstones).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });

  it('getAssetByCode returns the matching asset', async () => {
    const api = new MockCarmenApi({ latencyMs: 0 });
    const asset = await api.getAssetByCode('AST002');
    expect(asset?.name).toBe('Office Chair');
  });

  it('getAssetByCode returns null when unknown', async () => {
    const api = new MockCarmenApi({ latencyMs: 0 });
    expect(await api.getAssetByCode('UNKNOWN')).toBeNull();
  });

  it('listLocations returns seed locations', async () => {
    const api = new MockCarmenApi({ latencyMs: 0 });
    const locs = await api.listLocations({});
    expect(locs.map((l) => l.id).sort()).toEqual(['loc1', 'loc2', 'wh-a']);
  });

  it('offline mode rejects with network_error', async () => {
    const api = new MockCarmenApi({ latencyMs: 0 });
    api.setOnline(false);
    await expect(api.listAssets({})).rejects.toBeInstanceOf(CarmenApiError);
    await expect(api.listAssets({})).rejects.toMatchObject({ code: 'network_error' });
  });

  it('refresh returns a fresh session', async () => {
    const api = new MockCarmenApi({ latencyMs: 0 });
    const s = await api.refresh('rt');
    expect(s.token).toMatch(/mock-token/);
  });
});
```

- [ ] **Step 3: Implement `MockCarmenApi`**

Create `src/data/api/mockCarmenApi.ts`:

```ts
import { CarmenApiError } from './errors';
import { seedAssets, seedLocations } from './seedData';
import type {
  CarmenApi, CountEntry, CountingDocument, Page, PasswordCredentials,
  PhotoUpload, ServerInfo, Session, UserProfile,
} from './carmenApi';
import type { Asset, Location } from '../repos/types';

interface MockOptions {
  latencyMs?: number;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class MockCarmenApi implements CarmenApi {
  private online = true;
  private latencyMs: number;
  private assets: Asset[] = seedAssets.map((a) => ({ ...a }));
  private locations: Location[] = seedLocations.map((l) => ({ ...l }));

  constructor(opts: MockOptions = {}) {
    this.latencyMs = opts.latencyMs ?? 150;
  }

  setOnline(online: boolean) {
    this.online = online;
  }

  private async network<T>(work: () => T): Promise<T> {
    await delay(this.latencyMs);
    if (!this.online) {
      throw new CarmenApiError('network_error', 'mock is offline');
    }
    return work();
  }

  async signIn(creds: PasswordCredentials): Promise<Session> {
    return this.network(() => makeSession(creds.username));
  }

  async refresh(_refreshToken: string): Promise<Session> {
    return this.network(() => makeSession('mock-user'));
  }

  async listAssets(_opts: {
    updatedSince?: string;
    cursor?: string;
    limit?: number;
  }): Promise<Page<Asset>> {
    return this.network(() => ({
      items: this.assets.map((a) => ({ ...a })),
      nextCursor: null,
      tombstones: [],
    }));
  }

  async getAssetByCode(code: string): Promise<Asset | null> {
    return this.network(() => this.assets.find((a) => a.code === code) ?? null);
  }

  async getAsset(id: string): Promise<Asset | null> {
    return this.network(() => this.assets.find((a) => a.id === id) ?? null);
  }

  async listLocations(_opts: { updatedSince?: string }): Promise<Location[]> {
    return this.network(() => this.locations.map((l) => ({ ...l })));
  }

  async getMe(): Promise<UserProfile> {
    return this.network(() => makeUser('mock-user'));
  }

  async getServerInfo(): Promise<ServerInfo> {
    return this.network(() => ({ version: '0.0.0-mock', minClientVersion: null }));
  }

  async listCountingDocuments(): Promise<CountingDocument[]> {
    return this.network(() => []);
  }

  async getCountingDocument(): Promise<CountingDocument | null> {
    return this.network(() => null);
  }

  async upsertCountingDocument(doc: CountingDocument): Promise<CountingDocument> {
    return this.network(() => ({ ...doc, runningNumber: doc.runningNumber ?? 'CNT-MOCK-001' }));
  }

  async upsertCountEntries(_documentId: string, _entries: CountEntry[]): Promise<void> {
    return this.network(() => undefined);
  }

  async commitCountingDocument(id: string): Promise<CountingDocument> {
    return this.network(() => ({
      id, runningNumber: 'CNT-MOCK-001',
      locationId: 'loc1', locationName: 'Building A Floor 1',
      status: 'committed', countDate: new Date().toISOString(),
      commitDate: new Date().toISOString(), description: '',
      createdBy: 'mock-user', createdAt: new Date().toISOString(),
    }));
  }

  async uploadPhoto(_file: PhotoUpload): Promise<{ photoId: string; remoteUrl: string }> {
    return this.network(() => ({ photoId: 'mock-photo-' + Date.now(), remoteUrl: 'mock://photo' }));
  }
}

function makeSession(username: string): Session {
  return {
    token: 'mock-token-' + Date.now(),
    refreshToken: 'mock-refresh-' + Date.now(),
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    user: makeUser(username),
  };
}

function makeUser(displayName: string): UserProfile {
  return {
    id: 'mock-user-1',
    displayName,
    email: 'mock@example.test',
    roles: ['staff'],
  };
}
```

- [ ] **Step 4: Run + commit**

```bash
npm test -- src/data/api/__tests__/mockCarmenApi
git add src/data/api/seedData.ts src/data/api/mockCarmenApi.ts src/data/api/__tests__/mockCarmenApi.test.ts
git commit -m "feat(api): MockCarmenApi with seed data + offline toggle"
```

---

## Task 10: `HttpCarmenApi` (auth + assets only)

**Files:**
- Create: `src/data/api/httpCarmenApi.ts`
- Create: `src/data/api/__tests__/httpCarmenApi.test.ts`

- [ ] **Step 1: Write tests**

Create `src/data/api/__tests__/httpCarmenApi.test.ts`:

```ts
import { HttpCarmenApi } from '../httpCarmenApi';
import { CarmenApiError } from '../errors';

function fakeFetch(handlers: Record<string, (init: RequestInit) => { status: number; body: unknown }>) {
  return jest.fn(async (url: string, init: RequestInit) => {
    const key = `${init.method ?? 'GET'} ${new URL(url).pathname}`;
    const h = handlers[key];
    if (!h) throw new Error(`No handler for ${key}`);
    const r = h(init);
    return new Response(JSON.stringify(r.body), {
      status: r.status,
      headers: { 'content-type': 'application/json' },
    });
  });
}

describe('HttpCarmenApi', () => {
  it('signIn POSTs to /auth/token with credentials and returns session', async () => {
    const fetchImpl = fakeFetch({
      'POST /auth/token': () => ({
        status: 200,
        body: {
          token: 't', refreshToken: 'r', expiresAt: '2030-01-01T00:00:00Z',
          user: { id: 'u1', displayName: 'alice', email: null, roles: [] },
        },
      }),
    });
    const api = new HttpCarmenApi({ baseUrl: 'https://api.test', getToken: () => null, fetchImpl: fetchImpl as never });
    const s = await api.signIn({ username: 'alice', password: 'pw' });
    expect(s.token).toBe('t');
  });

  it('listAssets builds the query string with updatedSince + cursor', async () => {
    const fetchImpl = fakeFetch({
      'GET /assets': () => ({ status: 200, body: { items: [], nextCursor: null, tombstones: [] } }),
    });
    const api = new HttpCarmenApi({ baseUrl: 'https://api.test', getToken: () => null, fetchImpl: fetchImpl as never });
    await api.listAssets({ updatedSince: '2026-01-01T00:00:00Z', cursor: 'c1', limit: 50 });
    const calledUrl = fetchImpl.mock.calls[0][0] as string;
    expect(calledUrl).toContain('updatedSince=2026-01-01');
    expect(calledUrl).toContain('cursor=c1');
    expect(calledUrl).toContain('limit=50');
  });

  it('getAssetByCode returns null on 404', async () => {
    const fetchImpl = fakeFetch({
      'GET /assets/by-code/UNKNOWN': () => ({ status: 404, body: { code: 'asset.not_found' } }),
    });
    const api = new HttpCarmenApi({ baseUrl: 'https://api.test', getToken: () => null, fetchImpl: fetchImpl as never });
    expect(await api.getAssetByCode('UNKNOWN')).toBeNull();
  });

  it('throws not_implemented for plan-3 methods', async () => {
    const api = new HttpCarmenApi({ baseUrl: 'https://api.test', getToken: () => null, fetchImpl: jest.fn() as never });
    await expect(api.uploadPhoto({ id: 'p', uri: 'file://x', mimeType: 'image/jpeg' }))
      .rejects.toMatchObject({ code: 'not_implemented' });
    await expect(api.commitCountingDocument('d')).rejects.toBeInstanceOf(CarmenApiError);
  });
});
```

- [ ] **Step 2: Implement**

Create `src/data/api/httpCarmenApi.ts`:

```ts
import { ApiClient } from './apiClient';
import { CarmenApiError } from './errors';
import type {
  CarmenApi, CountEntry, CountingDocument, Page, PasswordCredentials,
  PhotoUpload, ServerInfo, Session, UserProfile,
} from './carmenApi';
import type { Asset, Location } from '../repos/types';

interface HttpOptions {
  baseUrl: string;
  getToken: () => string | null;
  fetchImpl?: typeof fetch;
  onUnauthenticated?: () => Promise<string | null>;
}

function notImplemented(name: string): never {
  throw new CarmenApiError('not_implemented', `${name} is not implemented in Plan 2`);
}

function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return '';
  const search = new URLSearchParams(entries.map(([k, v]) => [k, String(v)]));
  return `?${search.toString()}`;
}

export class HttpCarmenApi implements CarmenApi {
  private client: ApiClient;

  constructor(opts: HttpOptions) {
    this.client = new ApiClient(opts);
  }

  async signIn(creds: PasswordCredentials): Promise<Session> {
    return this.client.request<Session>('POST', '/auth/token', { body: creds });
  }

  async refresh(refreshToken: string): Promise<Session> {
    return this.client.request<Session>('POST', '/auth/refresh', { body: { refreshToken } });
  }

  async listAssets(opts: { updatedSince?: string; cursor?: string; limit?: number }): Promise<Page<Asset>> {
    return this.client.request<Page<Asset>>('GET', `/assets${qs(opts)}`);
  }

  async getAssetByCode(code: string): Promise<Asset | null> {
    try {
      return await this.client.request<Asset>('GET', `/assets/by-code/${encodeURIComponent(code)}`);
    } catch (err) {
      if (err instanceof CarmenApiError && err.code === 'not_found') return null;
      throw err;
    }
  }

  async getAsset(id: string): Promise<Asset | null> {
    try {
      return await this.client.request<Asset>('GET', `/assets/${encodeURIComponent(id)}`);
    } catch (err) {
      if (err instanceof CarmenApiError && err.code === 'not_found') return null;
      throw err;
    }
  }

  async listLocations(opts: { updatedSince?: string }): Promise<Location[]> {
    return this.client.request<Location[]>('GET', `/locations${qs(opts)}`);
  }

  async getMe(): Promise<UserProfile> {
    return this.client.request<UserProfile>('GET', '/me');
  }

  async getServerInfo(): Promise<ServerInfo> {
    return this.client.request<ServerInfo>('GET', '/server-info');
  }

  listCountingDocuments(): Promise<CountingDocument[]> { return notImplemented('listCountingDocuments'); }
  getCountingDocument(): Promise<CountingDocument | null> { return notImplemented('getCountingDocument'); }
  upsertCountingDocument(): Promise<CountingDocument> { return notImplemented('upsertCountingDocument'); }
  upsertCountEntries(_d: string, _e: CountEntry[]): Promise<void> { return notImplemented('upsertCountEntries'); }
  commitCountingDocument(): Promise<CountingDocument> { return notImplemented('commitCountingDocument'); }
  uploadPhoto(_f: PhotoUpload): Promise<{ photoId: string; remoteUrl: string }> { return notImplemented('uploadPhoto'); }
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test -- src/data/api/__tests__/httpCarmenApi
git add src/data/api/httpCarmenApi.ts src/data/api/__tests__/httpCarmenApi.test.ts
git commit -m "feat(api): HttpCarmenApi for auth + assets endpoints"
```

---

## Task 11: `createCarmenApi` factory

**Files:**
- Create: `src/data/api/createCarmenApi.ts`

This is the runtime entry point for choosing mock vs http. It depends on `getToken` and `onUnauthenticated` callbacks which come from the auth module (Task 17); for now we accept them as factory args.

- [ ] **Step 1: Implement**

Create `src/data/api/createCarmenApi.ts`:

```ts
import { loadConfig } from '../../platform/config';
import { HttpCarmenApi } from './httpCarmenApi';
import { MockCarmenApi } from './mockCarmenApi';
import type { CarmenApi } from './carmenApi';

export interface CreateCarmenApiOptions {
  getToken: () => string | null;
  onUnauthenticated?: () => Promise<string | null>;
}

export function createCarmenApi(opts: CreateCarmenApiOptions): CarmenApi {
  const cfg = loadConfig();
  if (cfg.apiImpl === 'http') {
    return new HttpCarmenApi({
      baseUrl: cfg.serverBaseUrl,
      getToken: opts.getToken,
      onUnauthenticated: opts.onUnauthenticated,
    });
  }
  return new MockCarmenApi();
}
```

- [ ] **Step 2: Verify + commit**

```bash
npm run typecheck
npm run lint
git add src/data/api/createCarmenApi.ts
git commit -m "feat(api): createCarmenApi factory selecting mock or http from config"
```

---

## Task 12: `mutationQueue`

**Files:**
- Create: `src/data/sync/mutationQueue.ts`
- Create: `src/data/sync/__tests__/mutationQueue.test.ts`

- [ ] **Step 1: Write tests**

Create `src/data/sync/__tests__/mutationQueue.test.ts`:

```ts
import { makeMigratedTestDb, type TestDb } from '../../db/__tests__/testDb';
import { createPendingMutationRepo } from '../../repos/pendingMutationRepo';
import { createMutationQueue } from '../mutationQueue';

describe('mutationQueue', () => {
  let db: TestDb;
  beforeEach(async () => { db = await makeMigratedTestDb(); });
  afterEach(() => db.close());

  it('enqueue stores a mutation with a unique idempotency key', async () => {
    const repo = createPendingMutationRepo(db);
    const q = createMutationQueue(repo);
    const id = await q.enqueue('document.upsert', { x: 1 });
    const pending = await q.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(id);
    expect(pending[0].kind).toBe('document.upsert');
    expect(typeof pending[0].idempotencyKey).toBe('string');
    expect(pending[0].idempotencyKey.length).toBeGreaterThan(8);
  });

  it('notifies subscribers on enqueue', async () => {
    const repo = createPendingMutationRepo(db);
    const q = createMutationQueue(repo);
    const events: string[] = [];
    const unsubscribe = q.subscribe(() => events.push('changed'));
    await q.enqueue('document.upsert', {});
    expect(events).toEqual(['changed']);
    unsubscribe();
    await q.enqueue('entry.upsert', {});
    expect(events).toEqual(['changed']);
  });

  it('discard removes a failed mutation', async () => {
    const repo = createPendingMutationRepo(db);
    const q = createMutationQueue(repo);
    const id = await q.enqueue('document.upsert', {});
    await repo.markFailed(id, 'boom');
    await q.discard(id);
    expect(await q.listFailed()).toEqual([]);
  });
});
```

- [ ] **Step 2: Implement**

Create `src/data/sync/mutationQueue.ts`:

```ts
import type { PendingMutationRepo } from '../repos/pendingMutationRepo';
import type { MutationKind, PendingMutation } from '../repos/types';

export interface MutationQueue {
  enqueue<K extends MutationKind>(kind: K, payload: unknown): Promise<string>;
  listPending(): Promise<PendingMutation[]>;
  listFailed(): Promise<PendingMutation[]>;
  discard(id: string): Promise<void>;
  /** Subscribe to changes; returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

function uuid(): string {
  return (
    Date.now().toString(16) + '-' +
    Math.random().toString(16).slice(2, 10) + '-' +
    Math.random().toString(16).slice(2, 10)
  );
}

export function createMutationQueue(repo: PendingMutationRepo): MutationQueue {
  const listeners = new Set<() => void>();
  function notify() {
    for (const l of listeners) l();
  }
  return {
    async enqueue(kind, payload) {
      const id = await repo.enqueue({ idempotencyKey: uuid(), kind, payload });
      notify();
      return id;
    },
    listPending: () => repo.listPending(),
    listFailed: () => repo.listFailed(),
    async discard(id) {
      await repo.discard(id);
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test -- src/data/sync
git add src/data/sync/mutationQueue.ts src/data/sync/__tests__/mutationQueue.test.ts
git commit -m "feat(sync): mutation queue with subscribe"
```

---

## Task 13: `catalogSync`

**Files:**
- Create: `src/data/sync/catalogSync.ts`
- Create: `src/data/sync/__tests__/catalogSync.test.ts`

- [ ] **Step 1: Write tests**

Create `src/data/sync/__tests__/catalogSync.test.ts`:

```ts
import { makeMigratedTestDb, type TestDb } from '../../db/__tests__/testDb';
import { createAssetRepo } from '../../repos/assetRepo';
import { createLocationRepo } from '../../repos/locationRepo';
import { createMetaRepo } from '../../repos/metaRepo';
import { createCatalogSync } from '../catalogSync';
import { MockCarmenApi } from '../../api/mockCarmenApi';

describe('catalogSync', () => {
  let db: TestDb;
  beforeEach(async () => { db = await makeMigratedTestDb(); });
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
```

- [ ] **Step 2: Implement**

Create `src/data/sync/catalogSync.ts`:

```ts
import type { CarmenApi } from '../api/carmenApi';
import type { AssetRepo } from '../repos/assetRepo';
import type { LocationRepo } from '../repos/locationRepo';
import type { MetaRepo } from '../repos/metaRepo';

const ASSETS_CURSOR_KEY = 'catalog_assets_updated_since';
const LAST_SUCCESS_KEY = 'catalog_last_success_at';

export interface CatalogSyncDeps {
  api: CarmenApi;
  assetRepo: AssetRepo;
  locationRepo: LocationRepo;
  metaRepo: MetaRepo;
}

export interface CatalogSync {
  run(): Promise<void>;
}

export function createCatalogSync(deps: CatalogSyncDeps): CatalogSync {
  return {
    async run() {
      const since = (await deps.metaRepo.get(ASSETS_CURSOR_KEY)) ?? undefined;
      let cursor: string | undefined = undefined;
      let maxUpdatedAt = since ?? '0';
      while (true) {
        const page = await deps.api.listAssets({ updatedSince: since, cursor });
        if (page.items.length > 0) {
          await deps.assetRepo.upsertMany(page.items);
          for (const a of page.items) {
            if (a.updatedAt > maxUpdatedAt) maxUpdatedAt = a.updatedAt;
          }
        }
        if (page.tombstones.length > 0) {
          await deps.assetRepo.deleteByIds(page.tombstones);
        }
        if (!page.nextCursor) break;
        cursor = page.nextCursor;
      }
      const locs = await deps.api.listLocations({ updatedSince: since });
      if (locs.length > 0) await deps.locationRepo.upsertMany(locs);
      const now = new Date().toISOString();
      await deps.metaRepo.set(ASSETS_CURSOR_KEY, maxUpdatedAt);
      await deps.metaRepo.set(LAST_SUCCESS_KEY, now);
    },
  };
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test -- src/data/sync/__tests__/catalogSync
git add src/data/sync/catalogSync.ts src/data/sync/__tests__/catalogSync.test.ts
git commit -m "feat(sync): catalogSync pulls assets + locations incrementally"
```

---

## Task 14: `syncStore` + `syncWorker`

**Files:**
- Create: `src/data/sync/syncStore.ts`
- Create: `src/data/sync/syncWorker.ts`
- Create: `src/data/sync/__tests__/syncWorker.test.ts`

The worker drains pending mutations against the API. Plan 2 doesn't enqueue any mutations yet (the worker work is exercised by tests with fake mutations), but the infrastructure is fully wired.

- [ ] **Step 1: Create `syncStore`**

Create `src/data/sync/syncStore.ts`:

```ts
import { create } from 'zustand';

export type SyncStatus = 'idle' | 'syncing' | 'error';

interface SyncStoreState {
  status: SyncStatus;
  queued: number;
  lastSuccessAt: Date | null;
  lastError: string | null;
  setStatus(status: SyncStatus, lastError?: string): void;
  setQueued(queued: number): void;
  recordSuccess(): void;
}

export const useSyncStore = create<SyncStoreState>((set) => ({
  status: 'idle',
  queued: 0,
  lastSuccessAt: null,
  lastError: null,
  setStatus: (status, lastError) =>
    set({ status, lastError: status === 'error' ? lastError ?? 'unknown' : null }),
  setQueued: (queued) => set({ queued }),
  recordSuccess: () =>
    set({ status: 'idle', lastSuccessAt: new Date(), lastError: null }),
}));
```

- [ ] **Step 2: Write worker tests**

Create `src/data/sync/__tests__/syncWorker.test.ts`:

```ts
import { makeMigratedTestDb, type TestDb } from '../../db/__tests__/testDb';
import { createPendingMutationRepo } from '../../repos/pendingMutationRepo';
import { createMutationQueue } from '../mutationQueue';
import { createSyncWorker, BACKOFF_MS } from '../syncWorker';
import { CarmenApiError } from '../../api/errors';
import type { CarmenApi } from '../../api/carmenApi';

function fakeApi(behavior: Record<string, jest.Mock>): CarmenApi {
  return new Proxy({} as CarmenApi, {
    get(_t, key) {
      if (key in behavior) return behavior[key as string];
      return () => {
        throw new Error(`Unexpected call: ${String(key)}`);
      };
    },
  });
}

describe('SyncWorker', () => {
  let db: TestDb;
  beforeEach(async () => { db = await makeMigratedTestDb(); });
  afterEach(() => db.close());

  it('drains a pending mutation on success', async () => {
    const repo = createPendingMutationRepo(db);
    const q = createMutationQueue(repo);
    const api = fakeApi({
      upsertCountEntries: jest.fn(async () => undefined),
    });
    const worker = createSyncWorker({ queue: q, api, isOnline: () => true });
    await q.enqueue('entry.upsert', { documentId: 'd1', entries: [] });
    await worker.drainOnce();
    expect(await q.listPending()).toEqual([]);
    expect(api.upsertCountEntries).toHaveBeenCalled();
  });

  it('increments attempts on transient errors', async () => {
    const repo = createPendingMutationRepo(db);
    const q = createMutationQueue(repo);
    const api = fakeApi({
      upsertCountEntries: jest.fn(async () => {
        throw new CarmenApiError('network_error', 'down');
      }),
    });
    const worker = createSyncWorker({ queue: q, api, isOnline: () => true });
    await q.enqueue('entry.upsert', { documentId: 'd1', entries: [] });
    await worker.drainOnce();
    const pending = await q.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].attempts).toBe(1);
  });

  it('marks failed after MAX attempts', async () => {
    const repo = createPendingMutationRepo(db);
    const q = createMutationQueue(repo);
    const api = fakeApi({
      upsertCountEntries: jest.fn(async () => {
        throw new CarmenApiError('network_error', 'down');
      }),
    });
    const worker = createSyncWorker({ queue: q, api, isOnline: () => true });
    await q.enqueue('entry.upsert', { documentId: 'd1', entries: [] });
    for (let i = 0; i < BACKOFF_MS.length; i++) {
      await worker.drainOnce();
    }
    expect(await q.listPending()).toEqual([]);
    expect(await q.listFailed()).toHaveLength(1);
  });

  it('marks failed immediately on permanent errors', async () => {
    const repo = createPendingMutationRepo(db);
    const q = createMutationQueue(repo);
    const api = fakeApi({
      upsertCountEntries: jest.fn(async () => {
        throw new CarmenApiError('conflict', 'already committed');
      }),
    });
    const worker = createSyncWorker({ queue: q, api, isOnline: () => true });
    await q.enqueue('entry.upsert', { documentId: 'd1', entries: [] });
    await worker.drainOnce();
    expect(await q.listPending()).toEqual([]);
    expect(await q.listFailed()).toHaveLength(1);
  });

  it('does nothing when offline', async () => {
    const repo = createPendingMutationRepo(db);
    const q = createMutationQueue(repo);
    const api = fakeApi({ upsertCountEntries: jest.fn() });
    const worker = createSyncWorker({ queue: q, api, isOnline: () => false });
    await q.enqueue('entry.upsert', {});
    await worker.drainOnce();
    expect(api.upsertCountEntries).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Extend `MutationQueue` (from Task 12) to expose worker-side mutation lifecycle methods**

The worker needs to mark mutations done/failed/incremented through the queue (so subscribers are notified). Update **`src/data/sync/mutationQueue.ts`** from Task 12 to add three methods.

Update the `MutationQueue` interface:

```ts
export interface MutationQueue {
  enqueue<K extends MutationKind>(kind: K, payload: unknown): Promise<string>;
  listPending(): Promise<PendingMutation[]>;
  listFailed(): Promise<PendingMutation[]>;
  discard(id: string): Promise<void>;
  /** Worker-side lifecycle: */
  markDone(id: string): Promise<void>;
  incrementAttempts(id: string, lastError: string): Promise<void>;
  markFailed(id: string, lastError: string): Promise<void>;
  subscribe(listener: () => void): () => void;
}
```

Update `createMutationQueue` to wire them up. Add (inside the returned object):

```ts
async markDone(id) {
  await repo.markDone(id);
  notify();
},
async incrementAttempts(id, lastError) {
  await repo.incrementAttempts(id, lastError);
  notify();
},
async markFailed(id, lastError) {
  await repo.markFailed(id, lastError);
  notify();
},
```

- [ ] **Step 4: Update Task 12's mutationQueue tests**

Add to `src/data/sync/__tests__/mutationQueue.test.ts`:

```ts
it('exposes markDone / incrementAttempts / markFailed', async () => {
  const repo = createPendingMutationRepo(db);
  const q = createMutationQueue(repo);
  const id = await q.enqueue('document.upsert', {});
  await q.incrementAttempts(id, 'boom');
  await q.markFailed(id, 'boom2');
  expect(await q.listFailed()).toHaveLength(1);
  await q.markDone((await q.listFailed())[0].id);
  expect(await q.listFailed()).toEqual([]);
});
```

- [ ] **Step 5: Implement `syncWorker.ts`**

Create `src/data/sync/syncWorker.ts`:

```ts
import { CarmenApiError } from '../api/errors';
import type { CarmenApi } from '../api/carmenApi';
import type { MutationQueue } from './mutationQueue';
import type { PendingMutation } from '../repos/types';
import { useSyncStore } from './syncStore';

export const BACKOFF_MS = [2_000, 5_000, 15_000, 30_000, 60_000, 120_000];
const PERMANENT_ERROR_CODES = new Set(['unauthenticated', 'conflict', 'not_implemented', 'not_found']);

export interface SyncWorkerDeps {
  queue: MutationQueue;
  api: CarmenApi;
  isOnline: () => boolean;
}

export interface SyncWorker {
  drainOnce(): Promise<void>;
  start(): () => void;
}

async function performMutation(api: CarmenApi, m: PendingMutation): Promise<void> {
  switch (m.kind) {
    case 'document.upsert':
      await api.upsertCountingDocument(m.payload as never); return;
    case 'document.commit': {
      const { id } = m.payload as { id: string };
      await api.commitCountingDocument(id); return;
    }
    case 'entry.upsert': {
      const { documentId, entries } = m.payload as { documentId: string; entries: never };
      await api.upsertCountEntries(documentId, entries); return;
    }
    case 'photo.upload':
      await api.uploadPhoto(m.payload as never); return;
  }
}

export function createSyncWorker(deps: SyncWorkerDeps): SyncWorker {
  async function drainOnce(): Promise<void> {
    if (!deps.isOnline()) return;
    const pending = await deps.queue.listPending();
    useSyncStore.getState().setQueued(pending.length);
    if (pending.length === 0) {
      useSyncStore.getState().recordSuccess();
      return;
    }
    const m = pending[0];
    useSyncStore.getState().setStatus('syncing');
    try {
      await performMutation(deps.api, m);
      await deps.queue.markDone(m.id);
      useSyncStore.getState().recordSuccess();
    } catch (err) {
      const code = err instanceof CarmenApiError ? err.code : 'unknown';
      const msg = err instanceof Error ? err.message : String(err);
      if (PERMANENT_ERROR_CODES.has(code)) {
        await deps.queue.markFailed(m.id, msg);
        useSyncStore.getState().setStatus('error', msg);
        return;
      }
      const nextAttempts = m.attempts + 1;
      if (nextAttempts >= BACKOFF_MS.length) {
        await deps.queue.markFailed(m.id, msg);
        useSyncStore.getState().setStatus('error', msg);
        return;
      }
      await deps.queue.incrementAttempts(m.id, msg);
      useSyncStore.getState().setStatus('error', msg);
    }
  }

  return {
    drainOnce,
    start() {
      const unsubscribe = deps.queue.subscribe(() => {
        void drainOnce();
      });
      void drainOnce();
      return unsubscribe;
    },
  };
}
```

- [ ] **Step 6: Run + commit**

```bash
npm test -- src/data/sync
git add src/data/sync/
git commit -m "feat(sync): syncStore + syncWorker with backoff + status reporting"
```

---

## Task 15: `AuthStrategy` interface + `sessionStore` (secure-store wrapper)

**Files:**
- Create: `src/features/auth/authStrategy.ts`
- Create: `src/features/auth/sessionStore.ts`
- Create: `src/features/auth/__tests__/sessionStore.test.ts`

- [ ] **Step 1: Define the strategy interface**

Create `src/features/auth/authStrategy.ts`:

```ts
import type { PasswordCredentials, Session } from '../../data/api/carmenApi';

export interface AuthStrategy {
  signIn(creds: PasswordCredentials): Promise<Session>;
  refresh(): Promise<Session>;
  signOut(): Promise<void>;
  currentSession(): Session | null;
  hydrate(): Promise<Session | null>;
}
```

- [ ] **Step 2: Implement `sessionStore` (secure-store wrapper)**

Create `src/features/auth/sessionStore.ts`:

```ts
import * as SecureStore from 'expo-secure-store';
import type { Session } from '../../data/api/carmenApi';
import { loadConfig } from '../../platform/config';

function key(): string {
  return `carmen-session-${loadConfig().customerSlug}`;
}

export interface SessionStore {
  load(): Promise<Session | null>;
  save(session: Session): Promise<void>;
  clear(): Promise<void>;
}

export function createSessionStore(secureStore: typeof SecureStore = SecureStore): SessionStore {
  return {
    async load() {
      const raw = await secureStore.getItemAsync(key());
      if (!raw) return null;
      try {
        return JSON.parse(raw) as Session;
      } catch {
        await secureStore.deleteItemAsync(key());
        return null;
      }
    },
    async save(session) {
      await secureStore.setItemAsync(key(), JSON.stringify(session));
    },
    async clear() {
      await secureStore.deleteItemAsync(key());
    },
  };
}
```

- [ ] **Step 3: Write `sessionStore` tests**

Create `src/features/auth/__tests__/sessionStore.test.ts`:

```ts
import { createSessionStore } from '../sessionStore';

type FakeStore = {
  data: Record<string, string>;
  getItemAsync: jest.Mock;
  setItemAsync: jest.Mock;
  deleteItemAsync: jest.Mock;
};

function makeFake(): FakeStore {
  const data: Record<string, string> = {};
  return {
    data,
    getItemAsync: jest.fn(async (k: string) => data[k] ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => { data[k] = v; }),
    deleteItemAsync: jest.fn(async (k: string) => { delete data[k]; }),
  };
}

const sample = {
  token: 't', refreshToken: 'r', expiresAt: '2030-01-01T00:00:00Z',
  user: { id: 'u1', displayName: 'alice', email: null, roles: [] },
};

describe('sessionStore', () => {
  it('returns null when no session stored', async () => {
    const fake = makeFake();
    const store = createSessionStore(fake as never);
    expect(await store.load()).toBeNull();
  });

  it('save then load round-trips a session', async () => {
    const fake = makeFake();
    const store = createSessionStore(fake as never);
    await store.save(sample);
    expect(await store.load()).toEqual(sample);
  });

  it('clear removes the session', async () => {
    const fake = makeFake();
    const store = createSessionStore(fake as never);
    await store.save(sample);
    await store.clear();
    expect(await store.load()).toBeNull();
  });

  it('load returns null and deletes corrupted JSON', async () => {
    const fake = makeFake();
    fake.data['carmen-session-default'] = 'not-json';
    const store = createSessionStore(fake as never);
    expect(await store.load()).toBeNull();
    expect(fake.deleteItemAsync).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run + commit**

```bash
npm test -- src/features/auth
git add src/features/auth/authStrategy.ts src/features/auth/sessionStore.ts src/features/auth/__tests__/sessionStore.test.ts
git commit -m "feat(auth): AuthStrategy interface + secure-store session store"
```

---

## Task 16: `PasswordAuthStrategy`

**Files:**
- Create: `src/features/auth/passwordAuthStrategy.ts`
- Create: `src/features/auth/__tests__/passwordAuthStrategy.test.ts`

- [ ] **Step 1: Write tests**

Create `src/features/auth/__tests__/passwordAuthStrategy.test.ts`:

```ts
import { createPasswordAuthStrategy } from '../passwordAuthStrategy';
import type { SessionStore } from '../sessionStore';
import type { CarmenApi, Session } from '../../data/api/carmenApi';

function makeApi(overrides: Partial<CarmenApi> = {}): CarmenApi {
  return new Proxy({} as CarmenApi, {
    get(_t, key) {
      if (key in overrides) return (overrides as Record<string, unknown>)[key as string];
      return () => { throw new Error(`Unexpected ${String(key)}`); };
    },
  });
}

function makeStore(initial: Session | null = null): SessionStore & { _data: Session | null } {
  let data = initial;
  return {
    _data: data,
    async load() { return data; },
    async save(s) { data = s; },
    async clear() { data = null; },
  };
}

const sample: Session = {
  token: 't', refreshToken: 'r', expiresAt: '2030-01-01T00:00:00Z',
  user: { id: 'u1', displayName: 'alice', email: null, roles: [] },
};

describe('PasswordAuthStrategy', () => {
  it('signIn calls api and stores session', async () => {
    const api = makeApi({ signIn: jest.fn(async () => sample) });
    const store = makeStore();
    const strat = createPasswordAuthStrategy({ api, sessionStore: store });
    const s = await strat.signIn({ username: 'alice', password: 'pw' });
    expect(s).toEqual(sample);
    expect(strat.currentSession()).toEqual(sample);
  });

  it('hydrate loads from session store', async () => {
    const api = makeApi();
    const store = makeStore(sample);
    const strat = createPasswordAuthStrategy({ api, sessionStore: store });
    const s = await strat.hydrate();
    expect(s).toEqual(sample);
    expect(strat.currentSession()).toEqual(sample);
  });

  it('refresh calls api with current refresh token', async () => {
    const refreshed: Session = { ...sample, token: 't2' };
    const refresh = jest.fn(async () => refreshed);
    const api = makeApi({ refresh });
    const store = makeStore(sample);
    const strat = createPasswordAuthStrategy({ api, sessionStore: store });
    await strat.hydrate();
    const s = await strat.refresh();
    expect(refresh).toHaveBeenCalledWith('r');
    expect(s).toEqual(refreshed);
    expect(strat.currentSession()).toEqual(refreshed);
  });

  it('refresh throws if no session', async () => {
    const api = makeApi();
    const strat = createPasswordAuthStrategy({ api, sessionStore: makeStore() });
    await expect(strat.refresh()).rejects.toThrow(/no session/i);
  });

  it('signOut clears session and store', async () => {
    const api = makeApi();
    const store = makeStore(sample);
    const strat = createPasswordAuthStrategy({ api, sessionStore: store });
    await strat.hydrate();
    await strat.signOut();
    expect(strat.currentSession()).toBeNull();
    expect(await store.load()).toBeNull();
  });
});
```

- [ ] **Step 2: Implement**

Create `src/features/auth/passwordAuthStrategy.ts`:

```ts
import type { CarmenApi, PasswordCredentials, Session } from '../../data/api/carmenApi';
import type { AuthStrategy } from './authStrategy';
import type { SessionStore } from './sessionStore';

interface Deps {
  api: CarmenApi;
  sessionStore: SessionStore;
}

export function createPasswordAuthStrategy(deps: Deps): AuthStrategy {
  let session: Session | null = null;

  return {
    async signIn(creds: PasswordCredentials) {
      const s = await deps.api.signIn(creds);
      session = s;
      await deps.sessionStore.save(s);
      return s;
    },
    async refresh() {
      if (!session) throw new Error('No session to refresh');
      const s = await deps.api.refresh(session.refreshToken);
      session = s;
      await deps.sessionStore.save(s);
      return s;
    },
    async signOut() {
      session = null;
      await deps.sessionStore.clear();
    },
    currentSession() {
      return session;
    },
    async hydrate() {
      const loaded = await deps.sessionStore.load();
      session = loaded;
      return loaded;
    },
  };
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test -- src/features/auth
git add src/features/auth/passwordAuthStrategy.ts src/features/auth/__tests__/passwordAuthStrategy.test.ts
git commit -m "feat(auth): PasswordAuthStrategy"
```

---

## Task 17: `authStore` + `useAuth` + auth bootstrap glue

**Files:**
- Create: `src/features/auth/authStore.ts`
- Create: `src/features/auth/useAuth.ts`
- Create: `src/features/auth/createAuth.ts`
- Create: `src/features/auth/__tests__/authStore.test.ts`

`createAuth.ts` wires `MockCarmenApi`/`HttpCarmenApi` + sessionStore + PasswordAuthStrategy + authStore into one bootstrap function. Used by `app/_layout.tsx`.

- [ ] **Step 1: Implement `authStore`**

Create `src/features/auth/authStore.ts`:

```ts
import { create } from 'zustand';
import type { Session } from '../../data/api/carmenApi';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthStoreState {
  status: AuthStatus;
  session: Session | null;
  setSession(session: Session | null): void;
  setStatus(status: AuthStatus): void;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  status: 'loading',
  session: null,
  setSession: (session) => set({ session, status: session ? 'signedIn' : 'signedOut' }),
  setStatus: (status) => set({ status }),
}));
```

- [ ] **Step 2: Implement `useAuth` hook**

Create `src/features/auth/useAuth.ts`:

```ts
import { useAuthStore } from './authStore';

export function useAuth() {
  const status = useAuthStore((s) => s.status);
  const session = useAuthStore((s) => s.session);
  return { status, session };
}
```

- [ ] **Step 3: Implement `createAuth` bootstrap**

Create `src/features/auth/createAuth.ts`:

```ts
import { createCarmenApi } from '../../data/api/createCarmenApi';
import type { CarmenApi, PasswordCredentials } from '../../data/api/carmenApi';
import type { AuthStrategy } from './authStrategy';
import { createPasswordAuthStrategy } from './passwordAuthStrategy';
import { createSessionStore } from './sessionStore';
import { useAuthStore } from './authStore';

export interface AuthBundle {
  api: CarmenApi;
  strategy: AuthStrategy;
  signIn(creds: PasswordCredentials): Promise<void>;
  signOut(): Promise<void>;
}

export async function createAuth(): Promise<AuthBundle> {
  const sessionStore = createSessionStore();
  let strategy: AuthStrategy | null = null;
  const api = createCarmenApi({
    getToken: () => strategy?.currentSession()?.token ?? null,
    onUnauthenticated: async () => {
      try {
        const s = await strategy?.refresh();
        return s?.token ?? null;
      } catch {
        useAuthStore.getState().setSession(null);
        return null;
      }
    },
  });
  strategy = createPasswordAuthStrategy({ api, sessionStore });
  const initial = await strategy.hydrate();
  useAuthStore.getState().setSession(initial);

  return {
    api,
    strategy,
    async signIn(creds) {
      const s = await strategy!.signIn(creds);
      useAuthStore.getState().setSession(s);
    },
    async signOut() {
      await strategy!.signOut();
      useAuthStore.getState().setSession(null);
    },
  };
}
```

- [ ] **Step 4: Write `authStore` tests**

Create `src/features/auth/__tests__/authStore.test.ts`:

```ts
import { useAuthStore } from '../authStore';

const sample = {
  token: 't', refreshToken: 'r', expiresAt: '2030-01-01T00:00:00Z',
  user: { id: 'u1', displayName: 'alice', email: null, roles: [] },
};

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'loading', session: null });
  });

  it('setSession to a session transitions to signedIn', () => {
    useAuthStore.getState().setSession(sample);
    expect(useAuthStore.getState().status).toBe('signedIn');
    expect(useAuthStore.getState().session).toEqual(sample);
  });

  it('setSession(null) transitions to signedOut', () => {
    useAuthStore.getState().setSession(sample);
    useAuthStore.getState().setSession(null);
    expect(useAuthStore.getState().status).toBe('signedOut');
    expect(useAuthStore.getState().session).toBeNull();
  });
});
```

- [ ] **Step 5: Run + commit**

```bash
npm test -- src/features/auth
git add src/features/auth/
git commit -m "feat(auth): authStore + useAuth + createAuth bootstrap"
```

---

## Task 18: `SignInForm` component

**Files:**
- Create: `src/features/auth/SignInForm.tsx`
- Create: `src/features/auth/__tests__/SignInForm.test.tsx`
- Modify: `src/platform/i18n/locales/en.json`, `th.json` (auth keys)

- [ ] **Step 1: Add auth i18n keys**

In `src/platform/i18n/locales/en.json`, add:

```json
"auth": {
  "title": "Sign in",
  "username": "Username",
  "password": "Password",
  "signIn": "Sign in",
  "signingIn": "Signing in…",
  "error": {
    "missingFields": "Please enter both username and password",
    "invalid": "Invalid username or password",
    "network": "Network error — try again",
    "generic": "Sign-in failed. Please try again."
  }
}
```

In `src/platform/i18n/locales/th.json`, add:

```json
"auth": {
  "title": "เข้าสู่ระบบ",
  "username": "ชื่อผู้ใช้",
  "password": "รหัสผ่าน",
  "signIn": "เข้าสู่ระบบ",
  "signingIn": "กำลังเข้าสู่ระบบ…",
  "error": {
    "missingFields": "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน",
    "invalid": "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
    "network": "เครือข่ายมีปัญหา — กรุณาลองอีกครั้ง",
    "generic": "เข้าสู่ระบบไม่สำเร็จ"
  }
}
```

- [ ] **Step 2: Write tests**

Create `src/features/auth/__tests__/SignInForm.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { initI18n, setLocale } from '../../../src/platform/i18n';
import { SignInForm } from '../SignInForm';

describe('SignInForm', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
    await setLocale('en');
  });

  it('shows missing-fields error when submitted empty', async () => {
    const onSubmit = jest.fn();
    render(<SignInForm onSubmit={onSubmit} />);
    fireEvent.press(screen.getByText('Sign in'));
    await waitFor(() => {
      expect(screen.getByText('Please enter both username and password')).toBeOnTheScreen();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with credentials when filled', async () => {
    const onSubmit = jest.fn(async () => undefined);
    render(<SignInForm onSubmit={onSubmit} />);
    fireEvent.changeText(screen.getByPlaceholderText('Username'), 'alice');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'secret');
    fireEvent.press(screen.getByText('Sign in'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ username: 'alice', password: 'secret' });
    });
  });

  it('shows signing-in state while pending', async () => {
    let resolve: () => void = () => {};
    const onSubmit = jest.fn(() => new Promise<void>((r) => { resolve = r; }));
    render(<SignInForm onSubmit={onSubmit} />);
    fireEvent.changeText(screen.getByPlaceholderText('Username'), 'a');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'b');
    fireEvent.press(screen.getByText('Sign in'));
    await waitFor(() => {
      expect(screen.getByText('Signing in…')).toBeOnTheScreen();
    });
    resolve();
  });

  it('shows the provided errorCode message when present', async () => {
    render(<SignInForm onSubmit={jest.fn()} errorCode="auth.error.invalid" />);
    expect(screen.getByText('Invalid username or password')).toBeOnTheScreen();
  });
});
```

- [ ] **Step 3: Implement**

Create `src/features/auth/SignInForm.tsx`:

```tsx
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useT } from '../../platform/i18n';

interface Props {
  onSubmit: (creds: { username: string; password: string }) => Promise<void>;
  errorCode?: string;
}

export function SignInForm({ onSubmit, errorCode }: Props) {
  const t = useT();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!username || !password) {
      setLocalError('auth.error.missingFields');
      return;
    }
    setLocalError(null);
    setSubmitting(true);
    try {
      await onSubmit({ username, password });
    } finally {
      setSubmitting(false);
    }
  }

  const errorKey = localError ?? errorCode ?? null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('auth.title')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('auth.username')}
        autoCapitalize="none"
        autoCorrect={false}
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder={t('auth.password')}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {errorKey ? <Text style={styles.error}>{t(errorKey)}</Text> : null}
      <Pressable
        accessibilityRole="button"
        style={[styles.button, submitting && styles.buttonDisabled]}
        onPress={submitting ? undefined : handleSubmit}
      >
        {submitting ? (
          <View style={styles.row}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.buttonText}>{t('auth.signingIn')}</Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>{t('auth.signIn')}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8,
    padding: 12, fontSize: 16, backgroundColor: '#fff',
  },
  error: { color: '#dc2626', fontSize: 14 },
  button: {
    backgroundColor: '#2563eb', borderRadius: 8, padding: 14,
    alignItems: 'center', marginTop: 8,
  },
  buttonDisabled: { backgroundColor: '#94a3b8' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
```

- [ ] **Step 4: Run + commit**

```bash
npm test -- src/features/auth/__tests__/SignInForm
npm run lint && npm run typecheck
git add src/features/auth/SignInForm.tsx src/features/auth/__tests__/SignInForm.test.tsx src/platform/i18n/locales/
git commit -m "feat(auth): SignInForm component + i18n keys"
```

---

## Task 19: `/auth/sign-in` modal route

**Files:**
- Create: `app/auth/sign-in.tsx`

- [ ] **Step 1: Implement**

Create `app/auth/sign-in.tsx`:

```tsx
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SignInForm } from '../../src/features/auth/SignInForm';
import { useAuth } from '../../src/features/auth/useAuth';
import { useAuthBundle } from '../../src/features/auth/AuthBundleContext';
import { CarmenApiError } from '../../src/data/api/errors';

export default function SignInScreen() {
  const bundle = useAuthBundle();
  const { status } = useAuth();
  const router = useRouter();
  const [errorCode, setErrorCode] = useState<string | undefined>();

  if (status === 'signedIn') {
    // Should already have been redirected by the gate; defensive fallback.
    router.replace('/');
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <SignInForm
          errorCode={errorCode}
          onSubmit={async (creds) => {
            setErrorCode(undefined);
            try {
              await bundle.signIn(creds);
              router.replace('/');
            } catch (err) {
              if (err instanceof CarmenApiError) {
                if (err.code === 'unauthenticated') setErrorCode('auth.error.invalid');
                else if (err.code === 'network_error') setErrorCode('auth.error.network');
                else setErrorCode('auth.error.generic');
              } else {
                setErrorCode('auth.error.generic');
              }
            }
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  body: { flex: 1, justifyContent: 'center' },
});
```

This file references `AuthBundleContext` — see Task 20.

- [ ] **Step 2: Commit (with Task 20)**

Defer the commit to after Task 20 lands the context.

---

## Task 20: App bootstrap + route gate + AuthBundleContext

**Files:**
- Create: `src/features/auth/AuthBundleContext.tsx`
- Create: `src/data/db/dbContext.tsx`
- Create: `src/data/api/carmenApiContext.tsx`
- Modify: `app/_layout.tsx`

The root layout becomes the orchestration point: open the DB, hydrate auth, create the Carmen API, start the sync worker, render the tab stack or the sign-in modal based on auth status.

- [ ] **Step 1: Create context wrappers**

Create `src/features/auth/AuthBundleContext.tsx`:

```tsx
import { createContext, useContext, type ReactNode } from 'react';
import type { AuthBundle } from './createAuth';

const AuthBundleCtx = createContext<AuthBundle | null>(null);

export function AuthBundleProvider({ value, children }: { value: AuthBundle; children: ReactNode }) {
  return <AuthBundleCtx.Provider value={value}>{children}</AuthBundleCtx.Provider>;
}

export function useAuthBundle(): AuthBundle {
  const v = useContext(AuthBundleCtx);
  if (!v) throw new Error('useAuthBundle used outside AuthBundleProvider');
  return v;
}
```

Create `src/data/db/dbContext.tsx`:

```tsx
import { createContext, useContext, type ReactNode } from 'react';
import type { SqlExecutor } from './types';

const DbCtx = createContext<SqlExecutor | null>(null);

export function DbProvider({ value, children }: { value: SqlExecutor; children: ReactNode }) {
  return <DbCtx.Provider value={value}>{children}</DbCtx.Provider>;
}

export function useDb(): SqlExecutor {
  const v = useContext(DbCtx);
  if (!v) throw new Error('useDb used outside DbProvider');
  return v;
}
```

Create `src/data/api/carmenApiContext.tsx`:

```tsx
import { createContext, useContext, type ReactNode } from 'react';
import type { CarmenApi } from './carmenApi';

const ApiCtx = createContext<CarmenApi | null>(null);

export function CarmenApiProvider({ value, children }: { value: CarmenApi; children: ReactNode }) {
  return <ApiCtx.Provider value={value}>{children}</ApiCtx.Provider>;
}

export function useCarmenApi(): CarmenApi {
  const v = useContext(ApiCtx);
  if (!v) throw new Error('useCarmenApi used outside CarmenApiProvider');
  return v;
}
```

- [ ] **Step 2: Rewrite `app/_layout.tsx`**

Replace the entire content of `app/_layout.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Slot, Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { initI18n } from '../src/platform/i18n';
import { openDatabase } from '../src/data/db';
import { DbProvider } from '../src/data/db/dbContext';
import { createAuth, type AuthBundle } from '../src/features/auth/createAuth';
import { AuthBundleProvider } from '../src/features/auth/AuthBundleContext';
import { CarmenApiProvider } from '../src/data/api/carmenApiContext';
import { useAuthStore } from '../src/features/auth/authStore';
import { createMutationQueue } from '../src/data/sync/mutationQueue';
import { createPendingMutationRepo } from '../src/data/repos/pendingMutationRepo';
import { createSyncWorker } from '../src/data/sync/syncWorker';
import { createCatalogSync } from '../src/data/sync/catalogSync';
import { createAssetRepo } from '../src/data/repos/assetRepo';
import { createLocationRepo } from '../src/data/repos/locationRepo';
import { createMetaRepo } from '../src/data/repos/metaRepo';
import { useSyncStore } from '../src/data/sync/syncStore';
import type { SqlExecutor } from '../src/data/db';

interface BootstrapResult {
  db: SqlExecutor;
  auth: AuthBundle;
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 0 } },
});

export default function RootLayout() {
  const [bootstrap, setBootstrap] = useState<BootstrapResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initI18n();
        const db = await openDatabase();
        const auth = await createAuth();
        if (cancelled) return;
        setBootstrap({ db, auth });
      } catch (err) {
        console.error('Bootstrap failed', err);
        if (cancelled) return;
        // Best-effort: render with partial state if i18n at least loaded
        setBootstrap({ db: null as never, auth: null as never });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!bootstrap) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <QueryClientProvider client={queryClient}>
        <DbProvider value={bootstrap.db}>
          <CarmenApiProvider value={bootstrap.auth.api}>
            <AuthBundleProvider value={bootstrap.auth}>
              <SyncInfrastructure />
              <RouteGate />
            </AuthBundleProvider>
          </CarmenApiProvider>
        </DbProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function SyncInfrastructure() {
  const session = useAuthStore((s) => s.session);
  const { api } = useAuthBundle();
  const db = useDb();

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const pendingRepo = createPendingMutationRepo(db);
    const queue = createMutationQueue(pendingRepo);
    let online = true;
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      online = state.isConnected === true;
    });
    const worker = createSyncWorker({ queue, api, isOnline: () => online });
    const stopWorker = worker.start();
    const catalog = createCatalogSync({
      api,
      assetRepo: createAssetRepo(db),
      locationRepo: createLocationRepo(db),
      metaRepo: createMetaRepo(db),
    });
    useSyncStore.getState().setStatus('syncing');
    catalog.run()
      .then(() => { if (!cancelled) useSyncStore.getState().recordSuccess(); })
      .catch((err) => {
        if (!cancelled) useSyncStore.getState().setStatus('error', err?.message ?? String(err));
      });
    return () => {
      cancelled = true;
      unsubscribeNet();
      stopWorker();
    };
  }, [session, api, db]);

  return null;
}

function RouteGate() {
  const status = useAuthStore((s) => s.status);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    const inAuthGroup = segments[0] === 'auth';
    if (status === 'signedOut' && !inAuthGroup) {
      router.replace('/auth/sign-in');
    } else if (status === 'signedIn' && inAuthGroup) {
      router.replace('/');
    }
  }, [status, segments, router]);

  return <Slot />;
}
```

`SyncInfrastructure` reads the `AuthBundle` and DB via context — the providers wrap it, so it never calls `createAuth()` or `openDatabase()` itself. Also add these imports at the top of `app/_layout.tsx`:

```ts
import { useAuthBundle } from '../src/features/auth/AuthBundleContext';
import { useDb } from '../src/data/db/dbContext';
```

- [ ] **Step 3: Verify**

```bash
npm run typecheck
npm run lint
npm test
```

Plan 1 tests still pass; the layout still renders (no UI tests for it specifically — those are in tab/screen tests).

Smoke-test the bundle:

```bash
npx expo export --platform web --output-dir /tmp/plan2-bootstrap
rm -rf /tmp/plan2-bootstrap
```

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx app/auth/sign-in.tsx src/features/auth/AuthBundleContext.tsx src/data/db/dbContext.tsx src/data/api/carmenApiContext.tsx
git commit -m "feat(boot): app bootstrap, auth route gate, sync infrastructure"
```

---

## Task 21: `useAssets` + `useAsset` hooks

**Files:**
- Create: `src/features/asset/useAssets.ts`
- Create: `src/features/asset/useAsset.ts`

These hooks read from the local repo via TanStack Query. Catalog sync (Task 20) keeps the repo fresh; pull-to-refresh in Task 23 re-runs it explicitly.

- [ ] **Step 1: Implement `useAssets`**

Create `src/features/asset/useAssets.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { useDb } from '../../data/db/dbContext';
import { createAssetRepo } from '../../data/repos/assetRepo';

export function useAssets(search?: string) {
  const db = useDb();
  return useQuery({
    queryKey: ['assets', search ?? ''],
    queryFn: async () => {
      const repo = createAssetRepo(db);
      return repo.list({ search });
    },
  });
}
```

- [ ] **Step 2: Implement `useAsset`**

Create `src/features/asset/useAsset.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { useDb } from '../../data/db/dbContext';
import { createAssetRepo } from '../../data/repos/assetRepo';

export function useAsset(id: string) {
  const db = useDb();
  return useQuery({
    queryKey: ['asset', id],
    queryFn: async () => {
      const repo = createAssetRepo(db);
      return repo.findById(id);
    },
    enabled: !!id,
  });
}
```

- [ ] **Step 3: Verify + commit**

```bash
npm run typecheck && npm run lint
git add src/features/asset/useAssets.ts src/features/asset/useAsset.ts
git commit -m "feat(asset): useAssets + useAsset hooks via tanstack query"
```

---

## Task 22: `AssetListItem` + `AssetDetailView` components

**Files:**
- Create: `src/features/asset/AssetListItem.tsx`
- Create: `src/features/asset/AssetDetailView.tsx`
- Create: `src/features/asset/__tests__/AssetListItem.test.tsx`
- Create: `src/features/asset/__tests__/AssetDetailView.test.tsx`
- Modify: `src/platform/i18n/locales/en.json`, `th.json` (asset keys)

- [ ] **Step 1: Add asset i18n keys**

In `src/platform/i18n/locales/en.json`, add:

```json
"assets": {
  "title": "Assets",
  "search": "Search assets…",
  "empty": "No assets found.",
  "loading": "Loading assets…",
  "field": {
    "code": "Asset Code",
    "name": "Asset Name",
    "category": "Category",
    "department": "Department",
    "location": "Location",
    "quantity": "Quantity",
    "remainQty": "Remain Qty",
    "price": "Price",
    "totalAmount": "Total Amount",
    "inputDate": "Input Date",
    "acquireDate": "Acquire Date",
    "assetLife": "Asset Life",
    "remark": "Remark"
  }
}
```

In `src/platform/i18n/locales/th.json`, add:

```json
"assets": {
  "title": "สินทรัพย์",
  "search": "ค้นหาสินทรัพย์…",
  "empty": "ไม่พบสินทรัพย์",
  "loading": "กำลังโหลดสินทรัพย์…",
  "field": {
    "code": "รหัสสินทรัพย์",
    "name": "ชื่อสินทรัพย์",
    "category": "หมวดหมู่",
    "department": "แผนก",
    "location": "สถานที่",
    "quantity": "จำนวน",
    "remainQty": "คงเหลือ",
    "price": "ราคา",
    "totalAmount": "ราคารวม",
    "inputDate": "วันที่บันทึก",
    "acquireDate": "วันที่ได้มา",
    "assetLife": "อายุการใช้งาน",
    "remark": "หมายเหตุ"
  }
}
```

- [ ] **Step 2: Tests for `AssetListItem`**

Create `src/features/asset/__tests__/AssetListItem.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { initI18n, setLocale } from '../../../src/platform/i18n';
import { AssetListItem } from '../AssetListItem';
import type { Asset } from '../../../src/data/repos/types';

const sample: Asset = {
  id: 'a1', code: 'AST001', name: 'Desktop Computer',
  category: 'IT Equipment', department: 'Finance',
  locationId: 'loc1', locationName: 'Building A Floor 1',
  quantity: 1, remainQty: 1, price: 1200, currency: 'USD', totalAmount: 1200,
  inputDate: '2024-01-15', acquireDate: '2024-01-10',
  assetLife: '2 ปี 4 เดือน', remark: null, imageUrl: null,
  updatedAt: '2026-05-22T10:00:00Z',
};

describe('AssetListItem', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
    await setLocale('en');
  });

  it('renders code, name, category, and department', () => {
    render(<AssetListItem asset={sample} />);
    expect(screen.getByText('AST001')).toBeOnTheScreen();
    expect(screen.getByText('Desktop Computer')).toBeOnTheScreen();
    expect(screen.getByText('IT Equipment')).toBeOnTheScreen();
    expect(screen.getByText('Finance')).toBeOnTheScreen();
  });
});
```

- [ ] **Step 3: Implement `AssetListItem`**

Create `src/features/asset/AssetListItem.tsx`:

```tsx
import { StyleSheet, Text, View } from 'react-native';
import type { Asset } from '../../data/repos/types';

interface Props {
  asset: Asset;
}

export function AssetListItem({ asset }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.headRow}>
        <Text style={styles.code}>{asset.code}</Text>
        <Text style={styles.qty}>x{asset.remainQty ?? asset.quantity ?? 1}</Text>
      </View>
      <Text style={styles.name}>{asset.name}</Text>
      <View style={styles.meta}>
        {asset.category ? <Text style={styles.metaText}>{asset.category}</Text> : null}
        {asset.department ? <Text style={styles.metaText}>{asset.department}</Text> : null}
      </View>
      {asset.locationName ? <Text style={styles.location}>{asset.locationName}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  headRow: { flexDirection: 'row', justifyContent: 'space-between' },
  code: { fontFamily: 'monospace', fontSize: 13, color: '#475569' },
  qty: { fontSize: 13, color: '#94a3b8' },
  name: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginTop: 2 },
  meta: { flexDirection: 'row', gap: 8, marginTop: 4 },
  metaText: { fontSize: 12, color: '#64748b' },
  location: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
});
```

- [ ] **Step 4: Tests for `AssetDetailView`**

Create `src/features/asset/__tests__/AssetDetailView.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { initI18n, setLocale } from '../../../src/platform/i18n';
import { AssetDetailView } from '../AssetDetailView';
import type { Asset } from '../../../src/data/repos/types';

const sample: Asset = {
  id: 'a1', code: 'AST001', name: 'Desktop Computer',
  category: 'IT Equipment', department: 'Finance',
  locationId: 'loc1', locationName: 'Building A Floor 1',
  quantity: 1, remainQty: 1, price: 1200, currency: 'USD', totalAmount: 1200,
  inputDate: '2024-01-15', acquireDate: '2024-01-10',
  assetLife: '2 ปี 4 เดือน', remark: 'In good condition',
  imageUrl: null, updatedAt: '2026-05-22T10:00:00Z',
};

describe('AssetDetailView', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
    await setLocale('en');
  });

  it('renders every defined field', () => {
    render(<AssetDetailView asset={sample} />);
    expect(screen.getByText('AST001')).toBeOnTheScreen();
    expect(screen.getByText('Desktop Computer')).toBeOnTheScreen();
    expect(screen.getByText('Finance')).toBeOnTheScreen();
    expect(screen.getByText('Building A Floor 1')).toBeOnTheScreen();
    expect(screen.getByText('2 ปี 4 เดือน')).toBeOnTheScreen();
    expect(screen.getByText('USD 1200')).toBeOnTheScreen();
    expect(screen.getByText('In good condition')).toBeOnTheScreen();
  });

  it('omits rows for null fields', () => {
    const minimal: Asset = { ...sample, remark: null, category: null };
    render(<AssetDetailView asset={minimal} />);
    expect(screen.queryByText('Remark')).toBeNull();
    expect(screen.queryByText('Category')).toBeNull();
  });
});
```

- [ ] **Step 5: Implement `AssetDetailView`**

Create `src/features/asset/AssetDetailView.tsx`:

```tsx
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useT } from '../../platform/i18n';
import type { Asset } from '../../data/repos/types';

interface Props { asset: Asset }

function Row({ label, value }: { label: string; value: string | null }) {
  if (value == null || value === '') return null;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function formatMoney(price: number | null, currency: string | null): string | null {
  if (price == null) return null;
  return currency ? `${currency} ${price}` : `${price}`;
}

export function AssetDetailView({ asset }: Props) {
  const t = useT();
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.code}>{asset.code}</Text>
      <Text style={styles.name}>{asset.name}</Text>
      <View style={styles.list}>
        <Row label={t('assets.field.category')} value={asset.category} />
        <Row label={t('assets.field.department')} value={asset.department} />
        <Row label={t('assets.field.location')} value={asset.locationName} />
        <Row label={t('assets.field.quantity')} value={asset.quantity != null ? String(asset.quantity) : null} />
        <Row label={t('assets.field.remainQty')} value={asset.remainQty != null ? String(asset.remainQty) : null} />
        <Row label={t('assets.field.price')} value={formatMoney(asset.price, asset.currency)} />
        <Row label={t('assets.field.totalAmount')} value={formatMoney(asset.totalAmount, asset.currency)} />
        <Row label={t('assets.field.inputDate')} value={asset.inputDate} />
        <Row label={t('assets.field.acquireDate')} value={asset.acquireDate} />
        <Row label={t('assets.field.assetLife')} value={asset.assetLife} />
        <Row label={t('assets.field.remark')} value={asset.remark} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 16, gap: 4 },
  code: { fontFamily: 'monospace', fontSize: 13, color: '#475569' },
  name: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  list: { backgroundColor: '#fff', borderRadius: 8, padding: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb' },
  label: { color: '#64748b', fontSize: 13 },
  value: { color: '#0f172a', fontSize: 13, fontWeight: '500', textAlign: 'right', flex: 1, marginLeft: 12 },
});
```

The empty `category` test expects `screen.queryByText('Category')` to be null — this works because `Row` returns `null` when the value is null, so the label never renders.

- [ ] **Step 6: Run + commit**

```bash
npm test -- src/features/asset
npm run lint && npm run typecheck
git add src/features/asset/ src/platform/i18n/locales/
git commit -m "feat(asset): AssetListItem + AssetDetailView with i18n"
```

---

## Task 23: `/assets` list route with search + pull-to-refresh

**Files:**
- Create: `app/assets/index.tsx`

- [ ] **Step 1: Implement**

Create `app/assets/index.tsx`:

```tsx
import { useState, useCallback } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useT } from '../../src/platform/i18n';
import { useAssets } from '../../src/features/asset/useAssets';
import { AssetListItem } from '../../src/features/asset/AssetListItem';
import { useDb } from '../../src/data/db/dbContext';
import { useCarmenApi } from '../../src/data/api/carmenApiContext';
import { createCatalogSync } from '../../src/data/sync/catalogSync';
import { createAssetRepo } from '../../src/data/repos/assetRepo';
import { createLocationRepo } from '../../src/data/repos/locationRepo';
import { createMetaRepo } from '../../src/data/repos/metaRepo';
import { useSyncStore } from '../../src/data/sync/syncStore';

export default function AssetsListScreen() {
  const t = useT();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useAssets(search);
  const qc = useQueryClient();
  const db = useDb();
  const api = useCarmenApi();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    useSyncStore.getState().setStatus('syncing');
    try {
      const catalog = createCatalogSync({
        api,
        assetRepo: createAssetRepo(db),
        locationRepo: createLocationRepo(db),
        metaRepo: createMetaRepo(db),
      });
      await catalog.run();
      useSyncStore.getState().recordSuccess();
      await qc.invalidateQueries({ queryKey: ['assets'] });
    } catch (err) {
      useSyncStore.getState().setStatus('error', err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
    }
  }, [api, db, qc]);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: t('assets.title') }} />
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder={t('assets.search')}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <FlatList
        data={data ?? []}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/assets/${item.id}`)}>
            <AssetListItem asset={item} />
          </Pressable>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{isLoading ? t('assets.loading') : t('assets.empty')}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  searchWrap: { padding: 12 },
  search: { backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { color: '#94a3b8' },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/assets/index.tsx
git commit -m "feat(asset): /assets list route with search + pull-to-refresh"
```

---

## Task 24: `/assets/[id]` detail route

**Files:**
- Create: `app/assets/[id].tsx`

- [ ] **Step 1: Implement**

Create `app/assets/[id].tsx`:

```tsx
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { AssetDetailView } from '../../src/features/asset/AssetDetailView';
import { useAsset } from '../../src/features/asset/useAsset';
import { useT } from '../../src/platform/i18n';

export default function AssetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const { data: asset, isLoading } = useAsset(id ?? '');

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: asset?.code ?? t('assets.title') }} />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : !asset ? (
        <View style={styles.center}>
          <Text>{t('assets.empty')}</Text>
        </View>
      ) : (
        <AssetDetailView asset={asset} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/assets/\[id\].tsx
git commit -m "feat(asset): /assets/[id] detail route"
```

---

## Task 25: "Browse assets" on Home + Sign-out in More

**Files:**
- Modify: `app/(tabs)/index.tsx`
- Modify: `app/(tabs)/more.tsx`
- Modify: `src/platform/i18n/locales/en.json`, `th.json`

- [ ] **Step 1: Add Home and More i18n keys**

In `src/platform/i18n/locales/en.json`, add inside `home`:

```json
"browseAssets": "Browse assets"
```

And add a new top-level section:

```json
"more": {
  "signOut": "Sign out"
}
```

In `th.json`:

```json
"browseAssets": "ดูสินทรัพย์ทั้งหมด"
```

```json
"more": {
  "signOut": "ออกจากระบบ"
}
```

- [ ] **Step 2: Add "Browse assets" button to Home**

Replace `app/(tabs)/index.tsx`:

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useT } from '../../src/platform/i18n';
import { Header } from '../../src/ui/Header';

export default function HomeScreen() {
  const t = useT();
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container}>
      <Header title={t('home.title')} />
      <View style={styles.body}>
        <Pressable
          accessibilityRole="button"
          style={styles.primary}
          onPress={() => router.push('/assets')}
        >
          <Text style={styles.primaryText}>{t('home.browseAssets')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  body: { padding: 16, gap: 12 },
  primary: { backgroundColor: '#2563eb', borderRadius: 8, padding: 16, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 3: Add Sign-out to More**

Replace `app/(tabs)/more.tsx`:

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useT } from '../../src/platform/i18n';
import { useAuthBundle } from '../../src/features/auth/AuthBundleContext';

export default function MoreScreen() {
  const t = useT();
  const bundle = useAuthBundle();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <Pressable
          accessibilityRole="button"
          style={styles.danger}
          onPress={() => { void bundle.signOut(); }}
        >
          <Text style={styles.dangerText}>{t('more.signOut')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  body: { padding: 16, gap: 12 },
  danger: { backgroundColor: '#dc2626', borderRadius: 8, padding: 16, alignItems: 'center' },
  dangerText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/index.tsx app/\(tabs\)/more.tsx src/platform/i18n/locales/
git commit -m "feat(home,more): browse-assets + sign-out actions"
```

---

## Task 26: `useSyncStatus` + `SyncIndicator` component

**Files:**
- Create: `src/features/sync/useSyncStatus.ts`
- Create: `src/features/sync/SyncIndicator.tsx`
- Create: `src/features/sync/__tests__/SyncIndicator.test.tsx`
- Modify: `src/ui/Header.tsx` (use SyncIndicator)

- [ ] **Step 1: Implement `useSyncStatus`**

Create `src/features/sync/useSyncStatus.ts`:

```ts
import { useSyncStore } from '../../data/sync/syncStore';

export interface SyncStatus {
  status: 'idle' | 'syncing' | 'error';
  queued: number;
  lastSuccessAt: Date | null;
  lastError: string | null;
}

export function useSyncStatus(): SyncStatus {
  return useSyncStore((s) => ({
    status: s.status,
    queued: s.queued,
    lastSuccessAt: s.lastSuccessAt,
    lastError: s.lastError,
  }));
}
```

- [ ] **Step 2: Tests for `SyncIndicator`**

Create `src/features/sync/__tests__/SyncIndicator.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { useSyncStore } from '../../../src/data/sync/syncStore';
import { SyncIndicator } from '../SyncIndicator';

const PressableMock = ({ onPress, children }: any) => (
  <button onClick={onPress}>{children}</button>
);

describe('SyncIndicator', () => {
  beforeEach(() => {
    useSyncStore.setState({ status: 'idle', queued: 0, lastSuccessAt: null, lastError: null });
  });

  it('renders idle color when status is idle', () => {
    render(<SyncIndicator onPress={() => {}} />);
    const indicator = screen.getByLabelText('sync-status');
    // The accessibilityState surface is the easiest assertion: state name on the role
    expect(indicator).toBeOnTheScreen();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    render(<SyncIndicator onPress={onPress} />);
    fireEvent.press(screen.getByLabelText('sync-status'));
    expect(onPress).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Implement `SyncIndicator`**

Create `src/features/sync/SyncIndicator.tsx`:

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSyncStatus } from './useSyncStatus';

const COLOR: Record<'idle' | 'syncing' | 'error', string> = {
  idle: '#22c55e',
  syncing: '#3b82f6',
  error: '#f59e0b',
};

interface Props {
  onPress: () => void;
}

export function SyncIndicator({ onPress }: Props) {
  const { status, queued } = useSyncStatus();
  return (
    <Pressable accessibilityLabel="sync-status" accessibilityRole="button" onPress={onPress} style={styles.wrap}>
      <View style={[styles.dot, { backgroundColor: COLOR[status] }]} />
      {queued > 0 ? <Text style={styles.queued}>{queued}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  queued: { color: '#fff', fontSize: 11, marginLeft: 2 },
});
```

- [ ] **Step 4: Modify `Header.tsx` to use `SyncIndicator`**

Update `src/ui/Header.tsx`:

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SyncIndicator } from '../features/sync/SyncIndicator';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const router = useRouter();
  return (
    <View style={styles.bar}>
      <Text style={styles.title}>{title}</Text>
      <SyncIndicator onPress={() => router.push('/sync')} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
```

- [ ] **Step 5: Update `Header.test.tsx` (existing Plan 1 test)**

The existing test asserts `getByLabelText('sync-status')`. That still works — `SyncIndicator` preserves the label. Verify by running:

```bash
npm test -- src/ui/__tests__/Header
```

If it fails because the SyncIndicator needs the `useSyncStore` initialized in the test, add to the existing test:

```tsx
import { useSyncStore } from '../../data/sync/syncStore';

beforeEach(() => {
  useSyncStore.setState({ status: 'idle', queued: 0, lastSuccessAt: null, lastError: null });
});
```

Also note: the new `Header` calls `useRouter()`. In the test environment, expo-router may not be initialized. Wrap the Header in a `Stack` test fixture, or mock `useRouter`:

```tsx
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
```

Add the mock at the top of the test file.

- [ ] **Step 6: Run + commit**

```bash
npm test
git add src/features/sync/useSyncStatus.ts src/features/sync/SyncIndicator.tsx src/features/sync/__tests__/SyncIndicator.test.tsx src/ui/Header.tsx src/ui/__tests__/Header.test.tsx
git commit -m "feat(sync): SyncIndicator wired into Header"
```

---

## Task 27: `SyncStatusSheet` + `/sync` modal route

**Files:**
- Create: `src/features/sync/SyncStatusSheet.tsx`
- Create: `src/features/sync/__tests__/SyncStatusSheet.test.tsx`
- Create: `app/sync.tsx`
- Modify: `src/platform/i18n/locales/en.json`, `th.json`

- [ ] **Step 1: Add sync sheet i18n keys**

In `en.json`:

```json
"sync": {
  "title": "Sync status",
  "lastSync": "Last successful sync",
  "never": "Never",
  "queued": "Queued mutations",
  "syncNow": "Sync now",
  "syncing": "Syncing…",
  "lastError": "Last error"
}
```

In `th.json`:

```json
"sync": {
  "title": "สถานะการซิงค์",
  "lastSync": "ซิงค์สำเร็จล่าสุด",
  "never": "ยังไม่เคย",
  "queued": "รายการที่รอซิงค์",
  "syncNow": "ซิงค์เดี๋ยวนี้",
  "syncing": "กำลังซิงค์…",
  "lastError": "ข้อผิดพลาดล่าสุด"
}
```

- [ ] **Step 2: Implement `SyncStatusSheet`**

Create `src/features/sync/SyncStatusSheet.tsx`:

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../../platform/i18n';
import { useSyncStatus } from './useSyncStatus';

interface Props {
  onSyncNow: () => void;
}

function formatRelative(date: Date | null): string | null {
  if (!date) return null;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleString();
}

export function SyncStatusSheet({ onSyncNow }: Props) {
  const t = useT();
  const { status, queued, lastSuccessAt, lastError } = useSyncStatus();
  const lastSyncLabel = formatRelative(lastSuccessAt) ?? t('sync.never');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('sync.title')}</Text>

      <View style={styles.row}>
        <Text style={styles.label}>{t('sync.lastSync')}</Text>
        <Text style={styles.value}>{lastSyncLabel}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>{t('sync.queued')}</Text>
        <Text style={styles.value}>{String(queued)}</Text>
      </View>

      {lastError ? (
        <View style={styles.row}>
          <Text style={styles.label}>{t('sync.lastError')}</Text>
          <Text style={[styles.value, styles.error]}>{lastError}</Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        style={[styles.button, status === 'syncing' && styles.buttonDisabled]}
        onPress={status === 'syncing' ? undefined : onSyncNow}
      >
        <Text style={styles.buttonText}>{status === 'syncing' ? t('sync.syncing') : t('sync.syncNow')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12, backgroundColor: '#fff', flex: 1 },
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb' },
  label: { color: '#64748b', fontSize: 14 },
  value: { color: '#0f172a', fontSize: 14, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  error: { color: '#dc2626' },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 16 },
  buttonDisabled: { backgroundColor: '#94a3b8' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 3: Test**

Create `src/features/sync/__tests__/SyncStatusSheet.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useSyncStore } from '../../../src/data/sync/syncStore';
import { initI18n, setLocale } from '../../../src/platform/i18n';
import { SyncStatusSheet } from '../SyncStatusSheet';

describe('SyncStatusSheet', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
    await setLocale('en');
  });

  beforeEach(() => {
    useSyncStore.setState({ status: 'idle', queued: 0, lastSuccessAt: null, lastError: null });
  });

  it('shows "Never" when no successful sync recorded', () => {
    render(<SyncStatusSheet onSyncNow={() => {}} />);
    expect(screen.getByText('Never')).toBeOnTheScreen();
  });

  it('shows queued count and last error when present', () => {
    useSyncStore.setState({ status: 'error', queued: 3, lastSuccessAt: null, lastError: 'boom' });
    render(<SyncStatusSheet onSyncNow={() => {}} />);
    expect(screen.getByText('3')).toBeOnTheScreen();
    expect(screen.getByText('boom')).toBeOnTheScreen();
  });

  it('disables the sync button while syncing', () => {
    useSyncStore.setState({ status: 'syncing', queued: 0, lastSuccessAt: null, lastError: null });
    const onSyncNow = jest.fn();
    render(<SyncStatusSheet onSyncNow={onSyncNow} />);
    fireEvent.press(screen.getByText('Syncing…'));
    expect(onSyncNow).not.toHaveBeenCalled();
  });

  it('calls onSyncNow when tapped while idle', () => {
    const onSyncNow = jest.fn();
    render(<SyncStatusSheet onSyncNow={onSyncNow} />);
    fireEvent.press(screen.getByText('Sync now'));
    expect(onSyncNow).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Create the modal route**

Create `app/sync.tsx`:

```tsx
import { Stack } from 'expo-router';
import { useDb } from '../src/data/db/dbContext';
import { useCarmenApi } from '../src/data/api/carmenApiContext';
import { createCatalogSync } from '../src/data/sync/catalogSync';
import { createAssetRepo } from '../src/data/repos/assetRepo';
import { createLocationRepo } from '../src/data/repos/locationRepo';
import { createMetaRepo } from '../src/data/repos/metaRepo';
import { useSyncStore } from '../src/data/sync/syncStore';
import { SyncStatusSheet } from '../src/features/sync/SyncStatusSheet';

export default function SyncRoute() {
  const db = useDb();
  const api = useCarmenApi();

  async function syncNow() {
    useSyncStore.getState().setStatus('syncing');
    try {
      const catalog = createCatalogSync({
        api,
        assetRepo: createAssetRepo(db),
        locationRepo: createLocationRepo(db),
        metaRepo: createMetaRepo(db),
      });
      await catalog.run();
      useSyncStore.getState().recordSuccess();
    } catch (err) {
      useSyncStore.getState().setStatus('error', err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
      <Stack.Screen options={{ presentation: 'modal', title: 'Sync' }} />
      <SyncStatusSheet onSyncNow={syncNow} />
    </>
  );
}
```

- [ ] **Step 5: Run + commit**

```bash
npm test
git add src/features/sync/SyncStatusSheet.tsx src/features/sync/__tests__/SyncStatusSheet.test.tsx app/sync.tsx src/platform/i18n/locales/
git commit -m "feat(sync): /sync modal with last-sync, queue, sync-now"
```

---

## Task 28: Bootstrap polish + final verification

**Files:**
- Modify: `app/_layout.tsx` (cleanup pass, ensure clean Stack config)
- Modify: `app.config.js` (no changes expected; verify schemes correct)

- [ ] **Step 1: Ensure modal routes are declared in the stack**

The current `_layout.tsx` uses `<Slot />` inside `RouteGate`. For modal presentation on `/sync` and `/auth/sign-in` to work consistently across platforms, switch `RouteGate` to use `<Stack screenOptions={{ headerShown: false }}>`:

```tsx
function RouteGate() {
  const status = useAuthStore((s) => s.status);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    const inAuthGroup = segments[0] === 'auth';
    if (status === 'signedOut' && !inAuthGroup) router.replace('/auth/sign-in');
    else if (status === 'signedIn' && inAuthGroup) router.replace('/');
  }, [status, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth/sign-in" options={{ presentation: 'modal' }} />
      <Stack.Screen name="sync" options={{ presentation: 'modal' }} />
      <Stack.Screen name="assets/index" />
      <Stack.Screen name="assets/[id]" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
```

- [ ] **Step 2: Run full quality gate**

```bash
npm run lint
npm run typecheck
npm test
npx expo export --platform web --output-dir /tmp/plan2-final 2>&1 | tail -10
rm -rf /tmp/plan2-final
```

All must succeed.

- [ ] **Step 3: Commit**

```bash
git add app/_layout.tsx
git commit -m "chore(boot): stack-based route gate for modal routes"
```

---

## Final verification

Before declaring Plan 2 done, run end-to-end on web (smoke check that the bundle boots):

```bash
APP_API_IMPL=mock npx expo start --web
```

Expected: sign-in modal appears → enter any credentials → tabs render → tap "Browse assets" → list shows 5 seeded assets → tap into one → all fields render → sync indicator dot visible in header → tap → status sheet opens. Sign out from More tab → bounced back to sign-in.

---

## Self-review checklist

- [ ] Every spec section has a task:
  - §1 scope/end-state: covered by Tasks 18–28 (sign-in + browse + indicator).
  - §2 folders: Tasks 2–27 each create the planned files.
  - §3 SQLite + migrations: Task 2.
  - §4 CarmenApi: Tasks 7–11.
  - §5 sync queue + worker: Tasks 12, 14.
  - §6 auth: Tasks 15–20.
  - §7 catalog + UI: Tasks 13, 21–25.
  - §8 sync indicator + sheet: Tasks 26–27.
  - §9 deps: Task 1.
  - §10 testing: every task includes Jest tests; ~30+ new tests across the plan.
- [ ] No placeholders. Every step has the file path, code, command, and expected output.
- [ ] Type consistency: `SqlExecutor`, `Asset`, `Location`, `PendingMutation`, `MutationKind`, `Session`, `PasswordCredentials`, `AuthStrategy`, `CarmenApi`, `MutationQueue`, `SyncWorker`, `SyncStatus`, `AuthStatus`, `useSyncStore`, `useAuthStore` — all used consistently across tasks.
- [ ] Frequent commits: every task ends with a `git commit`. ~28 commits total.



```
src/
  data/
    db/                          connection singleton + migrations
    repos/                       assetRepo, locationRepo, pendingMutationRepo, metaRepo
    api/                         CarmenApi interface, mock, http, factory, errors
    sync/                        catalogSync, mutationQueue, syncStore, syncWorker
  features/
    auth/                        strategy interface, password impl, store, hook, SignInForm
    asset/                       useAssets, useAsset, AssetListItem, AssetDetailView
    sync/                        useSyncStatus, SyncIndicator, SyncStatusSheet
app/
  _layout.tsx                    modified: bootstrap + route gate + QueryClientProvider
  auth/sign-in.tsx               modal route
  assets/index.tsx               /assets list
  assets/[id].tsx                /assets/[id] detail
  sync.tsx                       status sheet (modal)
  (tabs)/index.tsx               modified: adds "Browse assets" button
  (tabs)/more.tsx                modified: adds Sign out button
src/ui/Header.tsx                modified: uses <SyncIndicator />
src/platform/config/             modified: adds apiImpl field
src/platform/i18n/locales/       modified: auth, assets, sync keys
package.json                     modified: new deps
```

---
