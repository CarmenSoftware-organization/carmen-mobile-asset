# Counting Documents — Slice 1: Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the local persistence + mock backend + sync write-back for Counting Documents, with no UI yet — fully unit-tested.

**Architecture:** New SQLite tables (`counting_document`, `count_entry`, `photo`) and two new `asset` columns via migration v2, three `SqlExecutor`-backed factory repos, a stateful `MockCarmenApi` that assigns the `CDYYMMNNNN` running number, and a sync-worker reconciliation hook that writes server-assigned values back into local rows. Reads/writes follow the existing repo + mutation-queue patterns exactly.

**Tech Stack:** TypeScript (strict), `expo-sqlite` (prod) / `better-sqlite3` in-memory (tests), Jest + `jest-expo`. Design source: `docs/superpowers/specs/2026-05-26-counting-documents-design.md`.

**Scope note vs spec §12:** This slice implements the spec's "Slice 1" minus the real HTTP endpoints — `HttpCarmenApi` keeps throwing `not_implemented` and is finished in Slice 6 ("HTTP hardening"), because there is no backend to test it against yet. Everything else in Slice 1 lands here.

**Conventions to follow (from existing code):**
- Repos are factory functions `createXRepo(db: SqlExecutor)` returning a plain object (see `src/data/repos/assetRepo.ts`).
- Local-only `syncedAt` column is stripped from domain objects in a `rowToX` mapper.
- JSON-valued columns are stored as `TEXT` and `JSON.parse`/`JSON.stringify`d at the repo boundary (see how `pending_mutations.payload` is handled).
- No FK constraints in schema (existing tables use none) — use indexed `TEXT` id columns.
- Tests build their executor from `makeMigratedTestDb()` in `src/data/db/__tests__/testDb.ts`.

---

## Task 1: Schema migration v2 + domain types

Adds the two `asset` columns and the three new tables in one migration version, and extends the shared domain types. Updating `seedData`, `assetRepo`, and the existing asset test in the same task keeps the build green.

**Files:**
- Modify: `src/data/repos/types.ts`
- Modify: `src/data/api/carmenApi.ts:34-58`
- Modify: `src/data/db/migrations.ts`
- Modify: `src/data/repos/assetRepo.ts:48-82`
- Modify: `src/data/api/seedData.ts`
- Modify: `src/data/repos/__tests__/assetRepo.test.ts:5-24`
- Test: `src/data/db/__tests__/migrate.test.ts`

- [ ] **Step 1: Write the failing test** — assert v2 schema exists and `assetRepo` round-trips the new fields.

Add to `src/data/repos/__tests__/assetRepo.test.ts` — first extend the `sample` object (lines 5-24) with the two new fields:

```typescript
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
  serialNo: 'SN-DC-0001',
  specification: 'Intel i5, 16GB RAM',
  updatedAt: '2026-05-22T10:00:00Z',
};
```

Then add this test:

```typescript
it('round-trips serialNo and specification', async () => {
  const repo = createAssetRepo(db);
  await repo.upsertMany([sample]);
  const found = await repo.findById('a1');
  expect(found).toMatchObject({ serialNo: 'SN-DC-0001', specification: 'Intel i5, 16GB RAM' });
});
```

Add to `src/data/db/__tests__/migrate.test.ts` (append a new test inside the existing `describe`):

```typescript
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
```

> If `migrate.test.ts` does not already import `makeMigratedTestDb`, add `import { makeMigratedTestDb } from './testDb';` at the top.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/data/repos/__tests__/assetRepo.test.ts src/data/db/__tests__/migrate.test.ts`
Expected: FAIL — `no such column: serialNo` and the migrate test missing the new tables/columns.

- [ ] **Step 3: Extend domain types**

In `src/data/repos/types.ts`, add the two fields to `Asset` (after `imageUrl`) and append a `Photo` interface:

```typescript
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
  serialNo: string | null;
  specification: string | null;
  updatedAt: string;
}

export interface Photo {
  id: string;
  entryId: string;
  localUri: string;
  remoteUrl: string | null;
  capturedAt: string;
  uploadStatus: 'queued' | 'uploading' | 'done' | 'failed';
  attempts: number;
  lastError: string | null;
}
```

In `src/data/api/carmenApi.ts`, extend `CountingDocument.status` and `CountEntry` (replace lines 34-58):

```typescript
export interface CountingDocument {
  id: string;
  runningNumber: string | null;
  locationId: string;
  locationName: string;
  status: 'draft' | 'committed' | 'void';
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
  observedSerialNo: string | null;
  observedSpecification: string | null;
  observedRemark: string | null;
  comment: string;
  photoIds: string[];
  transferDate: string | null;
  scannedAt: string;
  updatedAt: string;
}
```

Also widen the `CarmenApi.listCountingDocuments` signature (currently `src/data/api/carmenApi.ts:83`) so callers can filter by `void`:

```typescript
  listCountingDocuments(opts: { status?: CountingDocument['status'] }): Promise<CountingDocument[]>;
```

- [ ] **Step 4: Add migration v2**

Replace `src/data/db/migrations.ts` entirely:

```typescript
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

const SCHEMA_V2 = `
ALTER TABLE assets ADD COLUMN serialNo TEXT;
ALTER TABLE assets ADD COLUMN specification TEXT;

CREATE TABLE counting_document (
  id TEXT PRIMARY KEY,
  runningNumber TEXT,
  locationId TEXT NOT NULL,
  locationName TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  countDate TEXT NOT NULL,
  commitDate TEXT,
  description TEXT NOT NULL DEFAULT '',
  createdBy TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  syncedAt TEXT
);
CREATE INDEX idx_counting_document_status ON counting_document(status, countDate);

CREATE TABLE count_entry (
  id TEXT PRIMARY KEY,
  documentId TEXT NOT NULL,
  assetId TEXT,
  unknownCode TEXT,
  countQty INTEGER NOT NULL DEFAULT 0,
  location TEXT,
  observedSerialNo TEXT,
  observedSpecification TEXT,
  observedRemark TEXT,
  comment TEXT NOT NULL DEFAULT '',
  photoIds TEXT NOT NULL DEFAULT '[]',
  transferDate TEXT,
  scannedAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  syncedAt TEXT
);
CREATE INDEX idx_count_entry_documentId ON count_entry(documentId);
CREATE UNIQUE INDEX idx_count_entry_doc_asset ON count_entry(documentId, assetId);

CREATE TABLE photo (
  id TEXT PRIMARY KEY,
  entryId TEXT NOT NULL,
  localUri TEXT NOT NULL,
  remoteUrl TEXT,
  capturedAt TEXT NOT NULL,
  uploadStatus TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  lastError TEXT
);
CREATE INDEX idx_photo_entryId ON photo(entryId);
`;

export const migrations: Migration[] = [
  {
    version: 1,
    async up(db) {
      await db.execAsync(SCHEMA_V1);
    },
  },
  {
    version: 2,
    async up(db) {
      await db.execAsync(SCHEMA_V2);
    },
  },
];
```

> The `UNIQUE(documentId, assetId)` index enforces one entry per asset per document (accumulation updates that row). SQLite treats `NULL` assetIds as distinct, so multiple unknown-code surprise scans coexist.

- [ ] **Step 5: Add the new columns to `assetRepo.upsertMany`**

In `src/data/repos/assetRepo.ts`, update the INSERT (lines 48-82). Add `serialNo, specification` to the column list, two more `?` placeholders, the two `ON CONFLICT` assignments, and the two values (before `a.updatedAt`):

```typescript
await db.runAsync(
  `INSERT INTO assets (
     id, code, name, category, department, locationId, locationName,
     quantity, remainQty, price, currency, totalAmount,
     inputDate, acquireDate, assetLife, remark, imageUrl,
     serialNo, specification, updatedAt, syncedAt
   ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
   ON CONFLICT(id) DO UPDATE SET
     code=excluded.code, name=excluded.name, category=excluded.category,
     department=excluded.department, locationId=excluded.locationId,
     locationName=excluded.locationName, quantity=excluded.quantity,
     remainQty=excluded.remainQty, price=excluded.price, currency=excluded.currency,
     totalAmount=excluded.totalAmount, inputDate=excluded.inputDate,
     acquireDate=excluded.acquireDate, assetLife=excluded.assetLife,
     remark=excluded.remark, imageUrl=excluded.imageUrl,
     serialNo=excluded.serialNo, specification=excluded.specification,
     updatedAt=excluded.updatedAt, syncedAt=excluded.syncedAt`,
  [
    a.id, a.code, a.name, a.category, a.department, a.locationId, a.locationName,
    a.quantity, a.remainQty, a.price, a.currency, a.totalAmount,
    a.inputDate, a.acquireDate, a.assetLife, a.remark, a.imageUrl,
    a.serialNo, a.specification, a.updatedAt, now,
  ],
);
```

- [ ] **Step 6: Add the new fields to every seed asset**

In `src/data/api/seedData.ts`, add `serialNo` and `specification` to each of the 5 assets (before `updatedAt`). Use these values:

```typescript
// a1 Desktop Computer
serialNo: 'SN-DC-0001', specification: 'Intel i5, 16GB RAM',
// a2 Office Chair
serialNo: 'SN-OC-0002', specification: 'Ergonomic, black mesh',
// a3 Projector
serialNo: 'SN-PJ-0003', specification: '1080p, 3500 lumens',
// a4 Whiteboard
serialNo: null, specification: '120x90cm magnetic',
// a5 Network Switch
serialNo: 'SN-NS-0005', specification: '24-port gigabit',
```

- [ ] **Step 7: Run tests + typecheck to verify pass**

Run: `npx jest src/data/repos/__tests__/assetRepo.test.ts src/data/db/__tests__/migrate.test.ts && npm run typecheck`
Expected: all tests PASS; `tsc --noEmit` reports no errors.

- [ ] **Step 8: Commit**

```bash
git add src/data/repos/types.ts src/data/api/carmenApi.ts src/data/db/migrations.ts \
        src/data/repos/assetRepo.ts src/data/api/seedData.ts \
        src/data/repos/__tests__/assetRepo.test.ts src/data/db/__tests__/migrate.test.ts
git commit -m "feat(db): migration v2 — counting tables + asset serialNo/specification"
```

---

## Task 2: countingDocumentRepo

**Files:**
- Create: `src/data/repos/countingDocumentRepo.ts`
- Test: `src/data/repos/__tests__/countingDocumentRepo.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/data/repos/__tests__/countingDocumentRepo.test.ts`
Expected: FAIL — `Cannot find module '../countingDocumentRepo'`.

- [ ] **Step 3: Implement the repo**

Create `src/data/repos/countingDocumentRepo.ts`:

```typescript
import type { SqlExecutor } from '../db/types';
import type { CountingDocument } from '../api/carmenApi';

interface DocRow extends CountingDocument {
  updatedAt: string;
  syncedAt: string | null;
}

function rowToDoc(r: DocRow): CountingDocument {
  return {
    id: r.id,
    runningNumber: r.runningNumber,
    locationId: r.locationId,
    locationName: r.locationName,
    status: r.status,
    countDate: r.countDate,
    commitDate: r.commitDate,
    description: r.description,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
  };
}

async function writeDoc(db: SqlExecutor, doc: CountingDocument, syncedAt: string | null) {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO counting_document (
       id, runningNumber, locationId, locationName, status, countDate,
       commitDate, description, createdBy, createdAt, updatedAt, syncedAt
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       runningNumber=excluded.runningNumber, locationId=excluded.locationId,
       locationName=excluded.locationName, status=excluded.status,
       countDate=excluded.countDate, commitDate=excluded.commitDate,
       description=excluded.description, updatedAt=excluded.updatedAt,
       syncedAt=excluded.syncedAt`,
    [
      doc.id, doc.runningNumber, doc.locationId, doc.locationName, doc.status,
      doc.countDate, doc.commitDate, doc.description, doc.createdBy, doc.createdAt,
      now, syncedAt,
    ],
  );
}

export interface CountingDocumentRepo {
  upsert(doc: CountingDocument): Promise<void>;
  markSynced(doc: CountingDocument): Promise<void>;
  list(opts?: { status?: CountingDocument['status'] }): Promise<CountingDocument[]>;
  findById(id: string): Promise<CountingDocument | null>;
}

export function createCountingDocumentRepo(db: SqlExecutor): CountingDocumentRepo {
  return {
    upsert: (doc) => writeDoc(db, doc, null),
    markSynced: (doc) => writeDoc(db, doc, new Date().toISOString()),
    async list(opts) {
      if (opts?.status) {
        const rows = await db.getAllAsync<DocRow>(
          'SELECT * FROM counting_document WHERE status = ? ORDER BY countDate DESC, createdAt DESC',
          [opts.status],
        );
        return rows.map(rowToDoc);
      }
      const rows = await db.getAllAsync<DocRow>(
        'SELECT * FROM counting_document ORDER BY countDate DESC, createdAt DESC',
      );
      return rows.map(rowToDoc);
    },
    async findById(id) {
      const row = await db.getFirstAsync<DocRow>(
        'SELECT * FROM counting_document WHERE id = ?',
        [id],
      );
      return row ? rowToDoc(row) : null;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/data/repos/__tests__/countingDocumentRepo.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/repos/countingDocumentRepo.ts src/data/repos/__tests__/countingDocumentRepo.test.ts
git commit -m "feat(data): add countingDocumentRepo"
```

---

## Task 3: countEntryRepo

**Files:**
- Create: `src/data/repos/countEntryRepo.ts`
- Test: `src/data/repos/__tests__/countEntryRepo.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
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
    expect((await repo.listByDocument('d1'))).toHaveLength(1);
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/data/repos/__tests__/countEntryRepo.test.ts`
Expected: FAIL — `Cannot find module '../countEntryRepo'`.

- [ ] **Step 3: Implement the repo**

Create `src/data/repos/countEntryRepo.ts`:

```typescript
import type { SqlExecutor } from '../db/types';
import type { CountEntry } from '../api/carmenApi';

interface EntryRow {
  id: string;
  documentId: string;
  assetId: string | null;
  unknownCode: string | null;
  countQty: number;
  location: string | null;
  observedSerialNo: string | null;
  observedSpecification: string | null;
  observedRemark: string | null;
  comment: string;
  photoIds: string;
  transferDate: string | null;
  scannedAt: string;
  updatedAt: string;
  syncedAt: string | null;
}

function rowToEntry(r: EntryRow): CountEntry {
  return {
    id: r.id,
    documentId: r.documentId,
    assetId: r.assetId,
    unknownCode: r.unknownCode,
    countQty: r.countQty,
    location: r.location,
    observedSerialNo: r.observedSerialNo,
    observedSpecification: r.observedSpecification,
    observedRemark: r.observedRemark,
    comment: r.comment,
    photoIds: JSON.parse(r.photoIds) as string[],
    transferDate: r.transferDate,
    scannedAt: r.scannedAt,
    updatedAt: r.updatedAt,
  };
}

export interface CountEntryRepo {
  upsert(entry: CountEntry): Promise<void>;
  listByDocument(documentId: string): Promise<CountEntry[]>;
  findById(id: string): Promise<CountEntry | null>;
  findByDocumentAndAsset(documentId: string, assetId: string): Promise<CountEntry | null>;
  markSynced(ids: string[]): Promise<void>;
}

export function createCountEntryRepo(db: SqlExecutor): CountEntryRepo {
  return {
    async upsert(e) {
      await db.runAsync(
        `INSERT INTO count_entry (
           id, documentId, assetId, unknownCode, countQty, location,
           observedSerialNo, observedSpecification, observedRemark, comment,
           photoIds, transferDate, scannedAt, updatedAt, syncedAt
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)
         ON CONFLICT(id) DO UPDATE SET
           assetId=excluded.assetId, unknownCode=excluded.unknownCode,
           countQty=excluded.countQty, location=excluded.location,
           observedSerialNo=excluded.observedSerialNo,
           observedSpecification=excluded.observedSpecification,
           observedRemark=excluded.observedRemark, comment=excluded.comment,
           photoIds=excluded.photoIds, transferDate=excluded.transferDate,
           updatedAt=excluded.updatedAt, syncedAt=NULL`,
        [
          e.id, e.documentId, e.assetId, e.unknownCode, e.countQty, e.location,
          e.observedSerialNo, e.observedSpecification, e.observedRemark, e.comment,
          JSON.stringify(e.photoIds), e.transferDate, e.scannedAt, e.updatedAt,
        ],
      );
    },
    async listByDocument(documentId) {
      const rows = await db.getAllAsync<EntryRow>(
        'SELECT * FROM count_entry WHERE documentId = ? ORDER BY scannedAt',
        [documentId],
      );
      return rows.map(rowToEntry);
    },
    async findById(id) {
      const row = await db.getFirstAsync<EntryRow>('SELECT * FROM count_entry WHERE id = ?', [id]);
      return row ? rowToEntry(row) : null;
    },
    async findByDocumentAndAsset(documentId, assetId) {
      const row = await db.getFirstAsync<EntryRow>(
        'SELECT * FROM count_entry WHERE documentId = ? AND assetId = ?',
        [documentId, assetId],
      );
      return row ? rowToEntry(row) : null;
    },
    async markSynced(ids) {
      if (ids.length === 0) return;
      const placeholders = ids.map(() => '?').join(',');
      await db.runAsync(
        `UPDATE count_entry SET syncedAt = ? WHERE id IN (${placeholders})`,
        [new Date().toISOString(), ...ids],
      );
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/data/repos/__tests__/countEntryRepo.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/repos/countEntryRepo.ts src/data/repos/__tests__/countEntryRepo.test.ts
git commit -m "feat(data): add countEntryRepo"
```

---

## Task 4: photoRepo

**Files:**
- Create: `src/data/repos/photoRepo.ts`
- Test: `src/data/repos/__tests__/photoRepo.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { makeMigratedTestDb, type TestDb } from '../../db/__tests__/testDb';
import { createPhotoRepo } from '../photoRepo';
import type { Photo } from '../types';

const photo: Photo = {
  id: 'p1',
  entryId: 'e1',
  localUri: 'file:///tmp/p1.jpg',
  remoteUrl: null,
  capturedAt: '2025-06-01T09:05:00Z',
  uploadStatus: 'queued',
  attempts: 0,
  lastError: null,
};

describe('photoRepo', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
  });
  afterEach(() => db.close());

  it('inserts and lists photos by entry', async () => {
    const repo = createPhotoRepo(db);
    await repo.insert(photo);
    const list = await repo.listByEntry('e1');
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 'p1', uploadStatus: 'queued', remoteUrl: null });
  });

  it('markUploaded sets remoteUrl and status done', async () => {
    const repo = createPhotoRepo(db);
    await repo.insert(photo);
    await repo.markUploaded('p1', 'https://cdn/p1.jpg');
    const found = await repo.findById('p1');
    expect(found).toMatchObject({ remoteUrl: 'https://cdn/p1.jpg', uploadStatus: 'done' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/data/repos/__tests__/photoRepo.test.ts`
Expected: FAIL — `Cannot find module '../photoRepo'`.

- [ ] **Step 3: Implement the repo**

Create `src/data/repos/photoRepo.ts`:

```typescript
import type { SqlExecutor } from '../db/types';
import type { Photo } from './types';

export interface PhotoRepo {
  insert(photo: Photo): Promise<void>;
  listByEntry(entryId: string): Promise<Photo[]>;
  findById(id: string): Promise<Photo | null>;
  markUploaded(id: string, remoteUrl: string): Promise<void>;
}

export function createPhotoRepo(db: SqlExecutor): PhotoRepo {
  return {
    async insert(p) {
      await db.runAsync(
        `INSERT INTO photo (id, entryId, localUri, remoteUrl, capturedAt, uploadStatus, attempts, lastError)
         VALUES (?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET
           remoteUrl=excluded.remoteUrl, uploadStatus=excluded.uploadStatus,
           attempts=excluded.attempts, lastError=excluded.lastError`,
        [p.id, p.entryId, p.localUri, p.remoteUrl, p.capturedAt, p.uploadStatus, p.attempts, p.lastError],
      );
    },
    async listByEntry(entryId) {
      return db.getAllAsync<Photo>(
        'SELECT * FROM photo WHERE entryId = ? ORDER BY capturedAt',
        [entryId],
      );
    },
    async findById(id) {
      return db.getFirstAsync<Photo>('SELECT * FROM photo WHERE id = ?', [id]);
    },
    async markUploaded(id, remoteUrl) {
      await db.runAsync(
        "UPDATE photo SET remoteUrl = ?, uploadStatus = 'done', lastError = NULL WHERE id = ?",
        [remoteUrl, id],
      );
    },
  };
}
```

> `Photo` has no JSON columns and its row shape matches the interface 1:1, so `getAllAsync<Photo>` maps directly with no `rowToX` needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/data/repos/__tests__/photoRepo.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/repos/photoRepo.ts src/data/repos/__tests__/photoRepo.test.ts
git commit -m "feat(data): add photoRepo"
```

---

## Task 5: Stateful MockCarmenApi for counting documents

Replaces the placeholder counting methods (current `src/data/api/mockCarmenApi.ts:86-119`) with an in-memory store that assigns the `CDYYMMNNNN` running number and supports list/get/commit/void.

**Files:**
- Modify: `src/data/api/mockCarmenApi.ts`
- Modify: `src/data/api/__tests__/mockCarmenApi.test.ts`

- [ ] **Step 1: Write the failing test** — append to `src/data/api/__tests__/mockCarmenApi.test.ts`:

```typescript
import type { CountingDocument } from '../carmenApi';

function draft(overrides: Partial<CountingDocument> = {}): CountingDocument {
  return {
    id: 'd1',
    runningNumber: null,
    locationId: 'loc1',
    locationName: 'Building A Floor 1',
    status: 'draft',
    countDate: '2025-06-15',
    commitDate: null,
    description: '',
    createdBy: 'mock-user',
    createdAt: '2025-06-15T08:00:00Z',
    ...overrides,
  };
}

describe('MockCarmenApi counting documents', () => {
  it('assigns CDYYMMNNNN running numbers per month', async () => {
    const api = new MockCarmenApi({ latencyMs: 0 });
    const a = await api.upsertCountingDocument(draft({ id: 'd1' }));
    const b = await api.upsertCountingDocument(draft({ id: 'd2' }));
    expect(a.runningNumber).toBe('CD25060001');
    expect(b.runningNumber).toBe('CD25060002');
  });

  it('keeps an already-assigned running number on re-upsert', async () => {
    const api = new MockCarmenApi({ latencyMs: 0 });
    await api.upsertCountingDocument(draft({ id: 'd1' }));
    const again = await api.upsertCountingDocument(draft({ id: 'd1', description: 'edited' }));
    expect(again.runningNumber).toBe('CD25060001');
    expect(again.description).toBe('edited');
  });

  it('lists and filters by status; commit and void transition status', async () => {
    const api = new MockCarmenApi({ latencyMs: 0 });
    await api.upsertCountingDocument(draft({ id: 'd1' }));
    await api.upsertCountingDocument(draft({ id: 'd2' }));
    const committed = await api.commitCountingDocument('d1');
    expect(committed.status).toBe('committed');
    expect(committed.commitDate).not.toBeNull();
    await api.upsertCountingDocument(draft({ id: 'd2', status: 'void' }));
    expect((await api.listCountingDocuments({ status: 'draft' })).map((d) => d.id)).toEqual([]);
    expect((await api.listCountingDocuments({ status: 'committed' })).map((d) => d.id)).toEqual(['d1']);
    expect((await api.getCountingDocument('d2'))?.status).toBe('void');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/data/api/__tests__/mockCarmenApi.test.ts`
Expected: FAIL — running number is `CNT-MOCK-001`, not `CD25060001`.

- [ ] **Step 3: Implement stateful counting in the mock**

In `src/data/api/mockCarmenApi.ts`, add fields to the class (after line 28 `private locations`):

```typescript
  private documents = new Map<string, CountingDocument>();
  private entries = new Map<string, CountEntry[]>();
  private monthSeq = new Map<string, number>();
```

Add this private helper method to the class:

```typescript
  private assignRunningNumber(countDate: string): string {
    const d = new Date(countDate);
    const yy = String(d.getUTCFullYear()).slice(-2);
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const key = `${yy}${mm}`;
    const next = (this.monthSeq.get(key) ?? 0) + 1;
    this.monthSeq.set(key, next);
    return `CD${yy}${mm}${String(next).padStart(4, '0')}`;
  }
```

Replace the placeholder methods (lines 86-119) with:

```typescript
  async listCountingDocuments(opts: {
    status?: 'draft' | 'committed' | 'void';
  }): Promise<CountingDocument[]> {
    return this.network(() => {
      const all = [...this.documents.values()];
      return (opts.status ? all.filter((d) => d.status === opts.status) : all).map((d) => ({ ...d }));
    });
  }

  async getCountingDocument(id: string): Promise<CountingDocument | null> {
    return this.network(() => {
      const d = this.documents.get(id);
      return d ? { ...d } : null;
    });
  }

  async upsertCountingDocument(doc: CountingDocument): Promise<CountingDocument> {
    return this.network(() => {
      const existing = this.documents.get(doc.id);
      const runningNumber =
        doc.runningNumber ?? existing?.runningNumber ?? this.assignRunningNumber(doc.countDate);
      const saved: CountingDocument = { ...doc, runningNumber };
      this.documents.set(saved.id, saved);
      return { ...saved };
    });
  }

  async upsertCountEntries(documentId: string, entries: CountEntry[]): Promise<void> {
    return this.network(() => {
      this.entries.set(documentId, entries.map((e) => ({ ...e })));
    });
  }

  async commitCountingDocument(id: string): Promise<CountingDocument> {
    return this.network(() => {
      const existing = this.documents.get(id);
      if (!existing) {
        throw new CarmenApiError('not_found', `document ${id} not found`);
      }
      const committed: CountingDocument = {
        ...existing,
        status: 'committed',
        commitDate: new Date().toISOString(),
      };
      this.documents.set(id, committed);
      return { ...committed };
    });
  }

  async uploadPhoto(file: PhotoUpload): Promise<{ photoId: string; remoteUrl: string }> {
    return this.network(() => ({ photoId: file.id, remoteUrl: `mock://photo/${file.id}` }));
  }
```

> `uploadPhoto` now echoes the client `file.id` as `photoId` so the reconciler in Task 6 can patch the right local row.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/data/api/__tests__/mockCarmenApi.test.ts`
Expected: PASS (existing tests + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/data/api/mockCarmenApi.ts src/data/api/__tests__/mockCarmenApi.test.ts
git commit -m "feat(api): stateful mock counting documents with CDYYMMNNNN running number"
```

---

## Task 6: Sync-worker reconciliation hook + reconciler

After a mutation syncs, write server-assigned values back into local rows.

**Files:**
- Modify: `src/data/sync/syncWorker.ts`
- Create: `src/data/sync/syncReconciler.ts`
- Modify: `src/data/sync/__tests__/syncWorker.test.ts`
- Test: `src/data/sync/__tests__/syncReconciler.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/data/sync/__tests__/syncWorker.test.ts` a test that the worker passes the API result to the reconciler:

```typescript
it('reconciles a document.upsert result after syncing', async () => {
  const repo = createPendingMutationRepo(db);
  const q = createMutationQueue(repo);
  const serverDoc = { id: 'd1', runningNumber: 'CD25060001', status: 'draft' };
  const api = fakeApi({
    upsertCountingDocument: jest.fn(async () => serverDoc),
  });
  const reconcile = {
    onDocumentUpserted: jest.fn(async () => undefined),
    onDocumentCommitted: jest.fn(async () => undefined),
    onEntriesUpserted: jest.fn(async () => undefined),
    onPhotoUploaded: jest.fn(async () => undefined),
  };
  const worker = createSyncWorker({ queue: q, api, isOnline: () => true, reconcile });
  await q.enqueue('document.upsert', { id: 'd1' });
  await worker.drainOnce();
  expect(reconcile.onDocumentUpserted).toHaveBeenCalledWith(serverDoc);
});
```

Create `src/data/sync/__tests__/syncReconciler.test.ts` (end-to-end: running number lands locally):

```typescript
import { makeMigratedTestDb, type TestDb } from '../../db/__tests__/testDb';
import { createCountingDocumentRepo } from '../../repos/countingDocumentRepo';
import { createCountEntryRepo } from '../../repos/countEntryRepo';
import { createPhotoRepo } from '../../repos/photoRepo';
import { createSyncReconciler } from '../syncReconciler';
import type { CountingDocument } from '../../api/carmenApi';

const doc: CountingDocument = {
  id: 'd1',
  runningNumber: null,
  locationId: 'loc1',
  locationName: 'Building A Floor 1',
  status: 'draft',
  countDate: '2025-06-01',
  commitDate: null,
  description: '',
  createdBy: 'u1',
  createdAt: '2025-06-01T08:00:00Z',
};

describe('syncReconciler', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
  });
  afterEach(() => db.close());

  it('writes the server running number back to the local document', async () => {
    const docRepo = createCountingDocumentRepo(db);
    await docRepo.upsert(doc);
    const reconciler = createSyncReconciler({
      countingDocumentRepo: docRepo,
      countEntryRepo: createCountEntryRepo(db),
      photoRepo: createPhotoRepo(db),
    });
    await reconciler.onDocumentUpserted({ ...doc, runningNumber: 'CD25060001' });
    expect((await docRepo.findById('d1'))?.runningNumber).toBe('CD25060001');
  });

  it('patches a photo remoteUrl on upload', async () => {
    const photoRepo = createPhotoRepo(db);
    await photoRepo.insert({
      id: 'p1', entryId: 'e1', localUri: 'file://p1', remoteUrl: null,
      capturedAt: '2025-06-01T09:00:00Z', uploadStatus: 'queued', attempts: 0, lastError: null,
    });
    const reconciler = createSyncReconciler({
      countingDocumentRepo: createCountingDocumentRepo(db),
      countEntryRepo: createCountEntryRepo(db),
      photoRepo,
    });
    await reconciler.onPhotoUploaded('p1', { photoId: 'p1', remoteUrl: 'https://cdn/p1.jpg' });
    expect((await photoRepo.findById('p1'))?.remoteUrl).toBe('https://cdn/p1.jpg');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/data/sync/__tests__/syncWorker.test.ts src/data/sync/__tests__/syncReconciler.test.ts`
Expected: FAIL — `createSyncWorker` ignores `reconcile`; `Cannot find module '../syncReconciler'`.

- [ ] **Step 3: Add the reconciler interface + hook to the worker**

Replace `src/data/sync/syncWorker.ts` lines 1-45 with:

```typescript
import { CarmenApiError } from '../api/errors';
import type { CarmenApi, CountEntry, CountingDocument, PhotoUpload } from '../api/carmenApi';
import type { MutationQueue } from './mutationQueue';
import type { PendingMutation } from '../repos/types';
import { useSyncStore } from './syncStore';

export const BACKOFF_MS = [2_000, 5_000, 15_000, 30_000, 60_000, 120_000];
const PERMANENT_ERROR_CODES = new Set([
  'unauthenticated',
  'conflict',
  'not_implemented',
  'not_found',
]);

export interface SyncReconciler {
  onDocumentUpserted(doc: CountingDocument): Promise<void>;
  onDocumentCommitted(doc: CountingDocument): Promise<void>;
  onEntriesUpserted(documentId: string, entries: CountEntry[]): Promise<void>;
  onPhotoUploaded(localPhotoId: string, result: { photoId: string; remoteUrl: string }): Promise<void>;
}

export interface SyncWorkerDeps {
  queue: MutationQueue;
  api: CarmenApi;
  isOnline: () => boolean;
  reconcile?: SyncReconciler;
}

export interface SyncWorker {
  drainOnce(): Promise<void>;
  start(): () => void;
}

async function performMutation(
  api: CarmenApi,
  m: PendingMutation,
  reconcile?: SyncReconciler,
): Promise<void> {
  switch (m.kind) {
    case 'document.upsert': {
      const result = await api.upsertCountingDocument(m.payload as never);
      await reconcile?.onDocumentUpserted(result);
      return;
    }
    case 'document.commit': {
      const { id } = m.payload as { id: string };
      const result = await api.commitCountingDocument(id);
      await reconcile?.onDocumentCommitted(result);
      return;
    }
    case 'entry.upsert': {
      const { documentId, entries } = m.payload as { documentId: string; entries: CountEntry[] };
      await api.upsertCountEntries(documentId, entries);
      await reconcile?.onEntriesUpserted(documentId, entries);
      return;
    }
    case 'photo.upload': {
      const file = m.payload as PhotoUpload;
      const result = await api.uploadPhoto(file);
      await reconcile?.onPhotoUploaded(file.id, result);
      return;
    }
  }
}
```

Then, in `createSyncWorker`, update the single `performMutation` call inside `drainOnce` (currently `await performMutation(deps.api, m);`) to:

```typescript
      await performMutation(deps.api, m, deps.reconcile);
```

- [ ] **Step 4: Implement the reconciler**

Create `src/data/sync/syncReconciler.ts`:

```typescript
import type { CountingDocumentRepo } from '../repos/countingDocumentRepo';
import type { CountEntryRepo } from '../repos/countEntryRepo';
import type { PhotoRepo } from '../repos/photoRepo';
import type { SyncReconciler } from './syncWorker';

export interface SyncReconcilerDeps {
  countingDocumentRepo: CountingDocumentRepo;
  countEntryRepo: CountEntryRepo;
  photoRepo: PhotoRepo;
}

export function createSyncReconciler(deps: SyncReconcilerDeps): SyncReconciler {
  return {
    async onDocumentUpserted(doc) {
      await deps.countingDocumentRepo.markSynced(doc);
    },
    async onDocumentCommitted(doc) {
      await deps.countingDocumentRepo.markSynced(doc);
    },
    async onEntriesUpserted(_documentId, entries) {
      await deps.countEntryRepo.markSynced(entries.map((e) => e.id));
    },
    async onPhotoUploaded(localPhotoId, result) {
      await deps.photoRepo.markUploaded(localPhotoId, result.remoteUrl);
    },
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/data/sync/__tests__/syncWorker.test.ts src/data/sync/__tests__/syncReconciler.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/sync/syncWorker.ts src/data/sync/syncReconciler.ts \
        src/data/sync/__tests__/syncWorker.test.ts src/data/sync/__tests__/syncReconciler.test.ts
git commit -m "feat(sync): reconcile server-assigned values back to local rows"
```

---

## Task 7: Wire the reconciler into SyncInfrastructure

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Add imports**

In `app/_layout.tsx`, after the existing repo imports (around lines 20-22), add:

```typescript
import { createCountingDocumentRepo } from '../src/data/repos/countingDocumentRepo';
import { createCountEntryRepo } from '../src/data/repos/countEntryRepo';
import { createPhotoRepo } from '../src/data/repos/photoRepo';
import { createSyncReconciler } from '../src/data/sync/syncReconciler';
```

- [ ] **Step 2: Build the reconciler and pass it to the worker**

In `SyncInfrastructure`, inside the `useEffect` (currently `const worker = createSyncWorker({ queue, api, isOnline: () => online });` at line 95), replace that line with:

```typescript
    const reconcile = createSyncReconciler({
      countingDocumentRepo: createCountingDocumentRepo(db),
      countEntryRepo: createCountEntryRepo(db),
      photoRepo: createPhotoRepo(db),
    });
    const worker = createSyncWorker({ queue, api, isOnline: () => online, reconcile });
```

- [ ] **Step 3: Verify typecheck, lint, and full test suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: typecheck clean, lint clean, all tests PASS (no regressions; `app/_layout.tsx` has no unit test — typecheck is the gate here).

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(sync): wire counting-document reconciler into SyncInfrastructure"
```

---

## Definition of done (Slice 1)

- `npm test`, `npm run typecheck`, `npm run lint` all green.
- Migration v2 applies: `assets.serialNo`/`specification` columns + `counting_document` / `count_entry` / `photo` tables.
- Three repos with full CRUD + sync-marking, unit-tested via in-memory SQLite.
- `MockCarmenApi` is stateful and issues `CDYYMMNNNN` running numbers; commit/void transitions work.
- Sync worker calls a reconciler that writes `runningNumber`/`commitDate`/`syncedAt`/photo `remoteUrl` back to local rows; wired in `SyncInfrastructure`.
- No UI yet — that begins in Slice 2 (Create + View-All), which gets its own plan written just-in-time.

## Self-review notes (spec coverage for this slice)

- Spec §3.1 asset fields → Task 1. §3.2/§3.3/§3.4 tables + types → Task 1; repos → Tasks 2-4.
- Spec §4 mock + `void` via `upsertCountingDocument(status:'void')` + running number → Task 5.
- Spec §5 reconciliation write-back → Tasks 6-7.
- Deferred to later slices (correctly out of this slice): all screens (§6-§9), i18n (§10), photo capture UI (§8), HTTP endpoints (§4, Slice 6). No spec requirement assigned to Slice 1 is left unimplemented.
