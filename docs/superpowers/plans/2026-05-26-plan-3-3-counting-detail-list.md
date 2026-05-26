# Counting Documents — Slice 3: Detail List — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open a counting document at `/documents/[id]` and count the assets in its location — a read-only header plus an asset-to-count list with inline Counted-Qty steppers (persisted immediately + queued), All/Counted/Uncounted filter chips, local search, category filter, and sort — reachable from the View-All eye button and from the create flow.

**Architecture:** New `/documents/[id]` route (a pushed Stack screen) composes: feature read hooks (`useCountingDocument`, `useAssetCountList`) that merge catalog assets-in-location with this document's count entries; a mutation hook (`useSetCountedQty`) that upserts a `count_entry` and enqueues `entry.upsert` on every qty change; a pure `filterSortAssetCounts` util the screen applies in-memory; and presentational components (`QtyStepper`, `AssetCountListItem`, `CountingDocumentHeader`, `CountFilterChips`, `AssetCountToolbar`). Slice 2's create flow + View-All row are rewired to navigate into the detail screen.

**Tech Stack:** Expo Router (`useLocalSearchParams`), React 19, `@tanstack/react-query` v5, `expo-sqlite` via `SqlExecutor`, `react-i18next`. Tests: Jest (`jest-expo`) + `@testing-library/react-native` (`render`, `renderHook`, `waitFor`, `act`, `fireEvent`) + `better-sqlite3` in-memory via `testDb.ts` + the Slice-2 `renderCountingHook.tsx` harness.

**Spec:** `docs/superpowers/specs/2026-05-26-counting-documents-design.md` — §7 (detail behavior), §12.3 (build sequence), §2 (Counted/Uncounted definition).

---

## Locked scope decisions (from brainstorming)

- **Read-only header.** Slice 3 shows running#, status, location, count date, commit date, description — all read-only. Count-date/description **editing + "Save as Draft" are deferred** (later slice; count-date editing needs a date-picker dependency we are not adding now).
- **Inline Counted Qty persists immediately** per change: each +/- tap or typed value upserts the `count_entry` to SQLite and enqueues `entry.upsert`. No buffering.

## Deferred to later slices (state, don't build)

- **Per-row "view → Asset Information" button** on each asset → **Slice 4** (that screen doesn't exist yet). Slice-3 asset rows have the stepper only.
- **Scan button** on the detail → **Slice 5**.
- **Commit Count** floating action + header editing + Save as Draft → later slice (Commit is **Slice 6**).
- **Location-override-hides-from-list** rule (§8) → **Slice 4** (inline qty here never sets a location override, so all location assets remain visible).
- **Buddhist-calendar date formatting** (§10) — still rendered as raw `YYYY-MM-DD`, consistent with Slice 2.

---

## File Structure

**New files**
- `src/features/counting/filterSortAssetCounts.ts` — pure util + shared types (`AssetCountRow`, `CountFilter`, `AssetSort`). Owns the row type so components/hooks depend on the util, not on a hook module.
- `src/features/counting/__tests__/filterSortAssetCounts.test.ts`
- `src/features/counting/useCountingDocument.ts` — load one document by id.
- `src/features/counting/__tests__/useCountingDocument.test.tsx`
- `src/features/counting/useAssetCountList.ts` — merge assets-in-location + document entries → `AssetCountRow[]`.
- `src/features/counting/__tests__/useAssetCountList.test.tsx`
- `src/features/counting/useSetCountedQty.ts` — upsert a `count_entry` + enqueue `entry.upsert`.
- `src/features/counting/__tests__/useSetCountedQty.test.tsx`
- `src/features/counting/QtyStepper.tsx` — generic −/value/+ stepper (lives in `features/` because `features/` may not import `ui/`).
- `src/features/counting/__tests__/QtyStepper.test.tsx`
- `src/features/counting/CountingDocumentHeader.tsx` — read-only header.
- `src/features/counting/__tests__/CountingDocumentHeader.test.tsx`
- `src/features/counting/CountFilterChips.tsx` — All/Counted/Uncounted chips.
- `src/features/counting/__tests__/CountFilterChips.test.tsx`
- `src/features/counting/AssetCountListItem.tsx` — asset row + embedded `QtyStepper`.
- `src/features/counting/__tests__/AssetCountListItem.test.tsx`
- `src/features/counting/AssetCountToolbar.tsx` — search input + sort selector + category chips.
- `src/features/counting/__tests__/AssetCountToolbar.test.tsx`
- `app/documents/[id].tsx` — the detail screen (glue).

**Modified files**
- `src/data/repos/assetRepo.ts` — add `listByLocation(locationId)`.
- `src/data/repos/__tests__/assetRepo.test.ts` — add a test.
- `src/platform/i18n/locales/en.json` + `th.json` — add `documents.field.{countDate,commitDate}`, `documents.countFilter.*`, `documents.sort.*`, `documents.category.all`, `documents.detail.*`, `documents.view`.
- `src/platform/i18n/__tests__/i18n.test.ts` — assert a new key.
- `app/_layout.tsx` — register `documents/[id]` Stack screen.
- `app/documents/new.tsx` — route to `/documents/<id>` on create instead of `/documents`.
- `src/features/counting/CountingDocumentListItem.tsx` — add optional `onView` + eye button.
- `src/features/counting/__tests__/CountingDocumentListItem.test.tsx` — cover the eye button.
- `app/(tabs)/documents.tsx` — pass `onView` that pushes to the detail route.

No DB migration (Slice 1 created all tables).

---

## Task 1: `assetRepo.listByLocation`

**Files:**
- Modify: `src/data/repos/assetRepo.ts`
- Test: `src/data/repos/__tests__/assetRepo.test.ts`

- [ ] **Step 1: Write the failing test** — add this block inside the existing `describe('assetRepo', …)` in `src/data/repos/__tests__/assetRepo.test.ts`, after the last `it(...)`. It builds assets with `makeMigratedTestDb` + `createAssetRepo` (already imported in that file) and a local asset factory:

```ts
  it('listByLocation returns only that location, ordered by code', async () => {
    const repo = createAssetRepo(db);
    const mk = (id: string, code: string, locationId: string | null) => ({
      id,
      code,
      name: code,
      category: null,
      department: null,
      locationId,
      locationName: null,
      quantity: 1,
      remainQty: 1,
      price: null,
      currency: null,
      totalAmount: null,
      inputDate: null,
      acquireDate: null,
      assetLife: null,
      remark: null,
      imageUrl: null,
      serialNo: null,
      specification: null,
      updatedAt: '2026-05-22T10:00:00Z',
    });
    await repo.upsertMany([
      mk('a2', 'AST002', 'loc1'),
      mk('a1', 'AST001', 'loc1'),
      mk('a3', 'AST003', 'loc2'),
    ]);
    const inLoc1 = await repo.listByLocation('loc1');
    expect(inLoc1.map((a) => a.code)).toEqual(['AST001', 'AST002']);
  });
```

(If that test file does not already declare `db`/`createAssetRepo`, check the top of the file and reuse its existing setup; the Slice-1 file does `import { createAssetRepo } from '../assetRepo';` and builds `db` via `makeMigratedTestDb()` in `beforeEach`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/data/repos/__tests__/assetRepo.test.ts`
Expected: FAIL — `repo.listByLocation is not a function`.

- [ ] **Step 3: Add to the `AssetRepo` interface** in `src/data/repos/assetRepo.ts`, after `findByCode(code: string): Promise<Asset | null>;`:

```ts
  findByCode(code: string): Promise<Asset | null>;
  listByLocation(locationId: string): Promise<Asset[]>;
```

- [ ] **Step 4: Add the implementation** in the returned object, after the `findByCode` impl:

```ts
    async listByLocation(locationId) {
      const rows = await db.getAllAsync<AssetRow>(
        'SELECT * FROM assets WHERE locationId = ? ORDER BY code',
        [locationId],
      );
      return rows.map(rowToAsset);
    },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/data/repos/__tests__/assetRepo.test.ts`
Expected: PASS (all prior tests + the new one).

- [ ] **Step 6: Commit**

```bash
git add src/data/repos/assetRepo.ts src/data/repos/__tests__/assetRepo.test.ts
git commit -m "feat(data): add assetRepo.listByLocation"
```

---

## Task 2: `filterSortAssetCounts` util + shared types

**Files:**
- Create: `src/features/counting/filterSortAssetCounts.ts`
- Test: `src/features/counting/__tests__/filterSortAssetCounts.test.ts`

- [ ] **Step 1: Write the failing test** `src/features/counting/__tests__/filterSortAssetCounts.test.ts`:

```ts
import { filterSortAssetCounts, type AssetCountRow } from '../filterSortAssetCounts';
import type { Asset } from '../../../data/repos/types';

function asset(over: Partial<Asset>): Asset {
  return {
    id: over.id ?? 'a',
    code: over.code ?? 'AST',
    name: over.name ?? 'Name',
    category: over.category ?? null,
    department: over.department ?? null,
    locationId: 'loc1',
    locationName: 'Loc 1',
    quantity: 1,
    remainQty: 1,
    price: null,
    currency: null,
    totalAmount: null,
    inputDate: null,
    acquireDate: null,
    assetLife: null,
    remark: null,
    imageUrl: null,
    serialNo: null,
    specification: null,
    updatedAt: '2026-05-22T10:00:00Z',
  };
}

const rows: AssetCountRow[] = [
  { asset: asset({ id: 'a1', code: 'AST002', name: 'Chair', category: 'Furniture', department: 'HR' }), countedQty: 0 },
  { asset: asset({ id: 'a2', code: 'AST001', name: 'Desktop', category: 'IT', department: 'Finance' }), countedQty: 3 },
  { asset: asset({ id: 'a3', code: 'AST003', name: 'Switch', category: 'IT', department: 'IT' }), countedQty: 0 },
];
const base = { search: '', filter: 'all' as const, category: null, sort: 'code' as const };

describe('filterSortAssetCounts', () => {
  it('sorts by code by default', () => {
    expect(filterSortAssetCounts(rows, base).map((r) => r.asset.code)).toEqual([
      'AST001',
      'AST002',
      'AST003',
    ]);
  });

  it('sorts by name and by department', () => {
    expect(filterSortAssetCounts(rows, { ...base, sort: 'name' }).map((r) => r.asset.name)).toEqual([
      'Chair',
      'Desktop',
      'Switch',
    ]);
    expect(
      filterSortAssetCounts(rows, { ...base, sort: 'department' }).map((r) => r.asset.department),
    ).toEqual(['Finance', 'HR', 'IT']);
  });

  it('filters counted vs uncounted by countedQty', () => {
    expect(filterSortAssetCounts(rows, { ...base, filter: 'counted' }).map((r) => r.asset.id)).toEqual([
      'a2',
    ]);
    expect(
      filterSortAssetCounts(rows, { ...base, filter: 'uncounted' }).map((r) => r.asset.id),
    ).toEqual(['a1', 'a3']);
  });

  it('filters by category', () => {
    expect(filterSortAssetCounts(rows, { ...base, category: 'IT' }).map((r) => r.asset.id)).toEqual([
      'a2',
      'a3',
    ]);
  });

  it('searches code/name/category/department case-insensitively', () => {
    expect(filterSortAssetCounts(rows, { ...base, search: 'finance' }).map((r) => r.asset.id)).toEqual([
      'a2',
    ]);
    expect(filterSortAssetCounts(rows, { ...base, search: 'switch' }).map((r) => r.asset.id)).toEqual([
      'a3',
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/counting/__tests__/filterSortAssetCounts.test.ts`
Expected: FAIL — `Cannot find module '../filterSortAssetCounts'`.

- [ ] **Step 3: Implement** `src/features/counting/filterSortAssetCounts.ts`:

```ts
import type { Asset } from '../../data/repos/types';

export interface AssetCountRow {
  asset: Asset;
  countedQty: number;
}

export type CountFilter = 'all' | 'counted' | 'uncounted';
export type AssetSort = 'code' | 'name' | 'department';

export interface AssetCountFilterOptions {
  search: string;
  filter: CountFilter;
  category: string | null;
  sort: AssetSort;
}

function sortValue(row: AssetCountRow, sort: AssetSort): string {
  if (sort === 'code') return row.asset.code;
  if (sort === 'name') return row.asset.name;
  return row.asset.department ?? '';
}

export function filterSortAssetCounts(
  rows: AssetCountRow[],
  opts: AssetCountFilterOptions,
): AssetCountRow[] {
  const q = opts.search.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (opts.filter === 'counted' && r.countedQty <= 0) return false;
    if (opts.filter === 'uncounted' && r.countedQty > 0) return false;
    if (opts.category && r.asset.category !== opts.category) return false;
    if (q) {
      const hay = [r.asset.code, r.asset.name, r.asset.category, r.asset.department]
        .filter((v): v is string => typeof v === 'string')
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  return [...filtered].sort((a, b) =>
    sortValue(a, opts.sort).localeCompare(sortValue(b, opts.sort)),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/counting/__tests__/filterSortAssetCounts.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/counting/filterSortAssetCounts.ts src/features/counting/__tests__/filterSortAssetCounts.test.ts
git commit -m "feat(counting): add filterSortAssetCounts util + row types"
```

---

## Task 3: `useCountingDocument` hook

**Files:**
- Create: `src/features/counting/useCountingDocument.ts`
- Test: `src/features/counting/__tests__/useCountingDocument.test.tsx`

- [ ] **Step 1: Write the failing test** `src/features/counting/__tests__/useCountingDocument.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react-native';
import { makeMigratedTestDb, type TestDb } from '../../../data/db/__tests__/testDb';
import { createCountingDocumentRepo } from '../../../data/repos/countingDocumentRepo';
import { makeWrapper } from './renderCountingHook';
import { useCountingDocument } from '../useCountingDocument';
import type { CountingDocument } from '../../../data/api/carmenApi';

const doc: CountingDocument = {
  id: 'd1',
  runningNumber: null,
  locationId: 'loc1',
  locationName: 'Building A Floor 1',
  status: 'draft',
  countDate: '2026-05-26',
  commitDate: null,
  description: '',
  createdBy: 'u-1',
  createdAt: '2026-05-26T08:00:00Z',
};

describe('useCountingDocument', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
    await createCountingDocumentRepo(db).upsert(doc);
  });
  afterEach(() => db.close());

  it('loads a document by id', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useCountingDocument('d1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ id: 'd1', locationId: 'loc1', status: 'draft' });
  });

  it('returns null for a missing id', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useCountingDocument('nope'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/counting/__tests__/useCountingDocument.test.tsx`
Expected: FAIL — `Cannot find module '../useCountingDocument'`.

- [ ] **Step 3: Implement** `src/features/counting/useCountingDocument.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { useDb } from '../../data/db/dbContext';
import { createCountingDocumentRepo } from '../../data/repos/countingDocumentRepo';

export function useCountingDocument(id: string) {
  const db = useDb();
  return useQuery({
    queryKey: ['countingDocument', id],
    queryFn: () => createCountingDocumentRepo(db).findById(id),
    enabled: !!id,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/counting/__tests__/useCountingDocument.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/counting/useCountingDocument.ts src/features/counting/__tests__/useCountingDocument.test.tsx
git commit -m "feat(counting): add useCountingDocument hook"
```

---

## Task 4: `useAssetCountList` hook

**Files:**
- Create: `src/features/counting/useAssetCountList.ts`
- Test: `src/features/counting/__tests__/useAssetCountList.test.tsx`

- [ ] **Step 1: Write the failing test** `src/features/counting/__tests__/useAssetCountList.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react-native';
import { makeMigratedTestDb, type TestDb } from '../../../data/db/__tests__/testDb';
import { createAssetRepo } from '../../../data/repos/assetRepo';
import { createCountEntryRepo } from '../../../data/repos/countEntryRepo';
import { makeWrapper } from './renderCountingHook';
import { useAssetCountList } from '../useAssetCountList';
import type { Asset } from '../../../data/repos/types';
import type { CountEntry } from '../../../data/api/carmenApi';

function asset(id: string, code: string, locationId: string): Asset {
  return {
    id,
    code,
    name: code,
    category: null,
    department: null,
    locationId,
    locationName: 'L',
    quantity: 1,
    remainQty: 1,
    price: null,
    currency: null,
    totalAmount: null,
    inputDate: null,
    acquireDate: null,
    assetLife: null,
    remark: null,
    imageUrl: null,
    serialNo: null,
    specification: null,
    updatedAt: '2026-05-22T10:00:00Z',
  };
}
function entry(id: string, documentId: string, assetId: string, countQty: number): CountEntry {
  return {
    id,
    documentId,
    assetId,
    unknownCode: null,
    countQty,
    location: null,
    observedSerialNo: null,
    observedSpecification: null,
    observedRemark: null,
    comment: '',
    photoIds: [],
    transferDate: null,
    scannedAt: '2026-05-26T08:05:00Z',
    updatedAt: '2026-05-26T08:05:00Z',
  };
}

describe('useAssetCountList', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
    await createAssetRepo(db).upsertMany([
      asset('a1', 'AST001', 'loc1'),
      asset('a2', 'AST002', 'loc1'),
      asset('a3', 'AST003', 'loc2'),
    ]);
    await createCountEntryRepo(db).upsert(entry('e1', 'd1', 'a1', 3));
  });
  afterEach(() => db.close());

  it('returns location assets left-joined with this document entries', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useAssetCountList('d1', 'loc1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      { asset: expect.objectContaining({ id: 'a1' }), countedQty: 3 },
      { asset: expect.objectContaining({ id: 'a2' }), countedQty: 0 },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/counting/__tests__/useAssetCountList.test.tsx`
Expected: FAIL — `Cannot find module '../useAssetCountList'`.

- [ ] **Step 3: Implement** `src/features/counting/useAssetCountList.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { useDb } from '../../data/db/dbContext';
import { createAssetRepo } from '../../data/repos/assetRepo';
import { createCountEntryRepo } from '../../data/repos/countEntryRepo';
import type { AssetCountRow } from './filterSortAssetCounts';

export function useAssetCountList(documentId: string, locationId: string) {
  const db = useDb();
  return useQuery({
    queryKey: ['assetCountList', documentId],
    queryFn: async (): Promise<AssetCountRow[]> => {
      const assets = await createAssetRepo(db).listByLocation(locationId);
      const entries = await createCountEntryRepo(db).listByDocument(documentId);
      const qtyByAsset = new Map<string, number>();
      for (const e of entries) if (e.assetId) qtyByAsset.set(e.assetId, e.countQty);
      return assets.map((asset) => ({ asset, countedQty: qtyByAsset.get(asset.id) ?? 0 }));
    },
    enabled: !!documentId && !!locationId,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/counting/__tests__/useAssetCountList.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/counting/useAssetCountList.ts src/features/counting/__tests__/useAssetCountList.test.tsx
git commit -m "feat(counting): add useAssetCountList hook"
```

---

## Task 5: `useSetCountedQty` mutation hook

**Files:**
- Create: `src/features/counting/useSetCountedQty.ts`
- Test: `src/features/counting/__tests__/useSetCountedQty.test.tsx`

- [ ] **Step 1: Write the failing test** `src/features/counting/__tests__/useSetCountedQty.test.tsx`:

```tsx
import { renderHook, act } from '@testing-library/react-native';
import { makeMigratedTestDb, type TestDb } from '../../../data/db/__tests__/testDb';
import { createCountEntryRepo } from '../../../data/repos/countEntryRepo';
import { createPendingMutationRepo } from '../../../data/repos/pendingMutationRepo';
import { makeWrapper } from './renderCountingHook';
import { useSetCountedQty } from '../useSetCountedQty';
import type { CountEntry } from '../../../data/api/carmenApi';

describe('useSetCountedQty', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
  });
  afterEach(() => db.close());

  it('creates an entry and enqueues entry.upsert on first set', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useSetCountedQty('d1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ assetId: 'a1', qty: 2 });
    });

    const entry = await createCountEntryRepo(db).findByDocumentAndAsset('d1', 'a1');
    expect(entry?.countQty).toBe(2);

    const pending = await createPendingMutationRepo(db).listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].kind).toBe('entry.upsert');
    const payload = pending[0].payload as { documentId: string; entries: CountEntry[] };
    expect(payload.documentId).toBe('d1');
    expect(payload.entries[0].assetId).toBe('a1');
    expect(payload.entries[0].countQty).toBe(2);
  });

  it('updates the same entry row on a second set', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useSetCountedQty('d1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ assetId: 'a1', qty: 2 });
    });
    await act(async () => {
      await result.current.mutateAsync({ assetId: 'a1', qty: 0 });
    });

    expect(await createCountEntryRepo(db).listByDocument('d1')).toHaveLength(1);
    const entry = await createCountEntryRepo(db).findByDocumentAndAsset('d1', 'a1');
    expect(entry?.countQty).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/counting/__tests__/useSetCountedQty.test.tsx`
Expected: FAIL — `Cannot find module '../useSetCountedQty'`.

- [ ] **Step 3: Implement** `src/features/counting/useSetCountedQty.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDb } from '../../data/db/dbContext';
import { useMutationQueue } from '../../data/sync/mutationQueueContext';
import { createCountEntryRepo } from '../../data/repos/countEntryRepo';
import { uuid } from '../../platform/id';
import type { CountEntry } from '../../data/api/carmenApi';

export function useSetCountedQty(documentId: string) {
  const db = useDb();
  const queue = useMutationQueue();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ assetId, qty }: { assetId: string; qty: number }): Promise<void> => {
      const repo = createCountEntryRepo(db);
      const existing = await repo.findByDocumentAndAsset(documentId, assetId);
      const now = new Date().toISOString();
      const entry: CountEntry = existing
        ? { ...existing, countQty: qty, updatedAt: now }
        : {
            id: uuid(),
            documentId,
            assetId,
            unknownCode: null,
            countQty: qty,
            location: null,
            observedSerialNo: null,
            observedSpecification: null,
            observedRemark: null,
            comment: '',
            photoIds: [],
            transferDate: null,
            scannedAt: now,
            updatedAt: now,
          };
      await repo.upsert(entry);
      await queue.enqueue('entry.upsert', { documentId, entries: [entry] });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['assetCountList', documentId] });
      void qc.invalidateQueries({ queryKey: ['countingDocuments'] });
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/counting/__tests__/useSetCountedQty.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/counting/useSetCountedQty.ts src/features/counting/__tests__/useSetCountedQty.test.tsx
git commit -m "feat(counting): add useSetCountedQty mutation hook"
```

---

## Task 6: i18n keys for the detail UI

**Files:**
- Modify: `src/platform/i18n/locales/en.json`, `src/platform/i18n/locales/th.json`
- Modify: `src/platform/i18n/__tests__/i18n.test.ts`

- [ ] **Step 1: Write the failing test** — add to `src/platform/i18n/__tests__/i18n.test.ts` (a new `it` inside the existing `describe`, matching the file's existing pattern of asserting `t(...)` under the `en` locale):

```ts
  it('resolves the detail-list keys', () => {
    expect(t('documents.countFilter.uncounted')).toBe('Uncounted');
    expect(t('documents.sort.name')).toBe('Name');
    expect(t('documents.view')).toBe('View');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/platform/i18n/__tests__/i18n.test.ts`
Expected: FAIL — receives raw key `'documents.countFilter.uncounted'`.

- [ ] **Step 3: Extend the `documents` object in `en.json`.** Add these keys **inside** the existing `"documents": { … }` object (e.g. after the existing `"new": { … }` block — add a comma after `new`'s closing brace):

```json
    "field": {
      "countDate": "Count Date",
      "commitDate": "Commit Date"
    },
    "countFilter": {
      "all": "All",
      "counted": "Counted",
      "uncounted": "Uncounted"
    },
    "sort": {
      "label": "Sort",
      "code": "Code",
      "name": "Name",
      "department": "Dept"
    },
    "category": {
      "all": "All categories"
    },
    "detail": {
      "search": "Search assets…",
      "empty": "No assets in this location."
    },
    "view": "View"
```

- [ ] **Step 4: Extend the `documents` object in `th.json`** at the matching position (comma after `new`):

```json
    "field": {
      "countDate": "วันที่ตรวจนับ",
      "commitDate": "วันที่ยืนยัน"
    },
    "countFilter": {
      "all": "ทั้งหมด",
      "counted": "นับแล้ว",
      "uncounted": "ยังไม่นับ"
    },
    "sort": {
      "label": "เรียง",
      "code": "รหัส",
      "name": "ชื่อ",
      "department": "แผนก"
    },
    "category": {
      "all": "ทุกหมวดหมู่"
    },
    "detail": {
      "search": "ค้นหาสินทรัพย์…",
      "empty": "ไม่มีสินทรัพย์ในสถานที่นี้"
    },
    "view": "ดู"
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/platform/i18n/__tests__/i18n.test.ts`
Expected: PASS.

- [ ] **Step 6: Verify JSON validity**

Run: `npx tsc --noEmit`
Expected: no errors (catches a malformed comma).

- [ ] **Step 7: Commit**

```bash
git add src/platform/i18n/locales/en.json src/platform/i18n/locales/th.json src/platform/i18n/__tests__/i18n.test.ts
git commit -m "feat(i18n): add counting detail-list keys"
```

---

## Task 7: `QtyStepper` component

**Files:**
- Create: `src/features/counting/QtyStepper.tsx`
- Test: `src/features/counting/__tests__/QtyStepper.test.tsx`

Note: lives in `features/counting/` (not `ui/`) because `features/` may not import `ui/`, and `AssetCountListItem` (a feature component) embeds it. Generic a11y labels (`increment`/`decrement`/`counted quantity`) so the widget stays i18n-free.

- [ ] **Step 1: Write the failing test** `src/features/counting/__tests__/QtyStepper.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { QtyStepper } from '../QtyStepper';

describe('QtyStepper', () => {
  it('increments and decrements', () => {
    const onChange = jest.fn();
    render(<QtyStepper value={2} onChange={onChange} />);
    fireEvent.press(screen.getByLabelText('increment'));
    expect(onChange).toHaveBeenCalledWith(3);
    fireEvent.press(screen.getByLabelText('decrement'));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('does not decrement below zero', () => {
    const onChange = jest.fn();
    render(<QtyStepper value={0} onChange={onChange} />);
    fireEvent.press(screen.getByLabelText('decrement'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('accepts direct numeric input', () => {
    const onChange = jest.fn();
    render(<QtyStepper value={1} onChange={onChange} />);
    fireEvent.changeText(screen.getByLabelText('counted quantity'), '7');
    expect(onChange).toHaveBeenCalledWith(7);
  });

  it('does not fire when disabled', () => {
    const onChange = jest.fn();
    render(<QtyStepper value={3} onChange={onChange} disabled />);
    fireEvent.press(screen.getByLabelText('increment'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/counting/__tests__/QtyStepper.test.tsx`
Expected: FAIL — `Cannot find module '../QtyStepper'`.

- [ ] **Step 3: Implement** `src/features/counting/QtyStepper.tsx`:

```tsx
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

interface Props {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}

export function QtyStepper({ value, onChange, disabled }: Props) {
  const minusDisabled = disabled || value <= 0;
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="decrement"
        disabled={minusDisabled}
        style={[styles.btn, minusDisabled && styles.btnDisabled]}
        onPress={() => onChange(Math.max(0, value - 1))}
      >
        <Text style={styles.btnText}>–</Text>
      </Pressable>
      <TextInput
        style={styles.input}
        editable={!disabled}
        keyboardType="number-pad"
        value={String(value)}
        accessibilityLabel="counted quantity"
        onChangeText={(txt) => {
          const n = parseInt(txt.replace(/[^0-9]/g, ''), 10);
          onChange(Number.isNaN(n) ? 0 : n);
        }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="increment"
        disabled={disabled}
        style={[styles.btn, disabled && styles.btnDisabled]}
        onPress={() => onChange(value + 1)}
      >
        <Text style={styles.btnText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { backgroundColor: '#cbd5e1' },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  input: {
    minWidth: 44,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 15,
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/counting/__tests__/QtyStepper.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/counting/QtyStepper.tsx src/features/counting/__tests__/QtyStepper.test.tsx
git commit -m "feat(counting): add QtyStepper"
```

---

## Task 8: `CountingDocumentHeader` component

**Files:**
- Create: `src/features/counting/CountingDocumentHeader.tsx`
- Test: `src/features/counting/__tests__/CountingDocumentHeader.test.tsx`

- [ ] **Step 1: Write the failing test** `src/features/counting/__tests__/CountingDocumentHeader.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { initI18n, setLocale } from '../../../platform/i18n';
import { CountingDocumentHeader } from '../CountingDocumentHeader';
import type { CountingDocument } from '../../../data/api/carmenApi';

const base: CountingDocument = {
  id: 'd1',
  runningNumber: null,
  locationId: 'loc1',
  locationName: 'Building A Floor 1',
  status: 'draft',
  countDate: '2026-05-26',
  commitDate: null,
  description: 'Monthly count',
  createdBy: 'u-1',
  createdAt: '2026-05-26T08:00:00Z',
};

describe('CountingDocumentHeader', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
    await setLocale('en');
  });

  it('shows Pending, status, location, count date, description for a draft', () => {
    render(<CountingDocumentHeader document={base} />);
    expect(screen.getByText('Pending')).toBeOnTheScreen();
    expect(screen.getByText('Draft')).toBeOnTheScreen();
    expect(screen.getByText('Building A Floor 1')).toBeOnTheScreen();
    expect(screen.getByText('2026-05-26')).toBeOnTheScreen();
    expect(screen.getByText('Monthly count')).toBeOnTheScreen();
  });

  it('shows running number and commit date for a committed document', () => {
    const committed: CountingDocument = {
      ...base,
      status: 'committed',
      runningNumber: 'CD26050001',
      commitDate: '2026-05-27',
    };
    render(<CountingDocumentHeader document={committed} />);
    expect(screen.getByText('CD26050001')).toBeOnTheScreen();
    expect(screen.getByText('Committed')).toBeOnTheScreen();
    expect(screen.getByText('2026-05-27')).toBeOnTheScreen();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/counting/__tests__/CountingDocumentHeader.test.tsx`
Expected: FAIL — `Cannot find module '../CountingDocumentHeader'`.

- [ ] **Step 3: Implement** `src/features/counting/CountingDocumentHeader.tsx`:

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { useT } from '../../platform/i18n';
import type { CountingDocument } from '../../data/api/carmenApi';

const STATUS_STYLE: Record<CountingDocument['status'], { backgroundColor: string; color: string }> = {
  draft: { backgroundColor: '#e5e7eb', color: '#475569' },
  committed: { backgroundColor: '#dcfce7', color: '#166534' },
  void: { backgroundColor: '#fee2e2', color: '#991b1b' },
};

export function CountingDocumentHeader({ document }: { document: CountingDocument }) {
  const t = useT();
  const badge = STATUS_STYLE[document.status];
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.running}>{document.runningNumber ?? t('documents.pending')}</Text>
        <View style={[styles.badge, { backgroundColor: badge.backgroundColor }]}>
          <Text style={[styles.badgeText, { color: badge.color }]}>
            {t(`documents.status.${document.status}`)}
          </Text>
        </View>
      </View>
      <Text style={styles.location}>{document.locationName}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>{t('documents.field.countDate')}</Text>
        <Text style={styles.metaValue}>{document.countDate}</Text>
      </View>
      {document.commitDate ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>{t('documents.field.commitDate')}</Text>
          <Text style={styles.metaValue}>{document.commitDate}</Text>
        </View>
      ) : null}
      {document.description ? <Text style={styles.description}>{document.description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: 16,
    gap: 4,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  running: { fontFamily: 'monospace', fontSize: 16, fontWeight: '700', color: '#0f172a' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  location: { fontSize: 15, color: '#0f172a', marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: 8 },
  metaLabel: { fontSize: 12, color: '#94a3b8' },
  metaValue: { fontSize: 12, color: '#475569' },
  description: { fontSize: 13, color: '#475569', marginTop: 4 },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/counting/__tests__/CountingDocumentHeader.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/counting/CountingDocumentHeader.tsx src/features/counting/__tests__/CountingDocumentHeader.test.tsx
git commit -m "feat(counting): add read-only CountingDocumentHeader"
```

---

## Task 9: `CountFilterChips` component

**Files:**
- Create: `src/features/counting/CountFilterChips.tsx`
- Test: `src/features/counting/__tests__/CountFilterChips.test.tsx`

- [ ] **Step 1: Write the failing test** `src/features/counting/__tests__/CountFilterChips.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { initI18n, setLocale } from '../../../platform/i18n';
import { CountFilterChips } from '../CountFilterChips';

describe('CountFilterChips', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
    await setLocale('en');
  });

  it('renders All / Counted / Uncounted', () => {
    render(<CountFilterChips value="all" onChange={() => {}} />);
    expect(screen.getByText('All')).toBeOnTheScreen();
    expect(screen.getByText('Counted')).toBeOnTheScreen();
    expect(screen.getByText('Uncounted')).toBeOnTheScreen();
  });

  it('calls onChange with the chosen filter', () => {
    const onChange = jest.fn();
    render(<CountFilterChips value="all" onChange={onChange} />);
    fireEvent.press(screen.getByText('Uncounted'));
    expect(onChange).toHaveBeenCalledWith('uncounted');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/counting/__tests__/CountFilterChips.test.tsx`
Expected: FAIL — `Cannot find module '../CountFilterChips'`.

- [ ] **Step 3: Implement** `src/features/counting/CountFilterChips.tsx`:

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../../platform/i18n';
import type { CountFilter } from './filterSortAssetCounts';

const ORDER: CountFilter[] = ['all', 'counted', 'uncounted'];

interface Props {
  value: CountFilter;
  onChange: (filter: CountFilter) => void;
}

export function CountFilterChips({ value, onChange }: Props) {
  const t = useT();
  return (
    <View style={styles.row}>
      {ORDER.map((filter) => {
        const active = filter === value;
        const label = t(`documents.countFilter.${filter}`);
        return (
          <Pressable
            key={filter}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(filter)}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  chip: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#e5e7eb' },
  chipActive: { backgroundColor: '#2563eb' },
  chipText: { fontSize: 13, color: '#475569', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/counting/__tests__/CountFilterChips.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/counting/CountFilterChips.tsx src/features/counting/__tests__/CountFilterChips.test.tsx
git commit -m "feat(counting): add CountFilterChips (All/Counted/Uncounted)"
```

---

## Task 10: `AssetCountListItem` component

**Files:**
- Create: `src/features/counting/AssetCountListItem.tsx`
- Test: `src/features/counting/__tests__/AssetCountListItem.test.tsx`

- [ ] **Step 1: Write the failing test** `src/features/counting/__tests__/AssetCountListItem.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { initI18n, setLocale } from '../../../platform/i18n';
import { AssetCountListItem } from '../AssetCountListItem';
import type { AssetCountRow } from '../filterSortAssetCounts';
import type { Asset } from '../../../data/repos/types';

const asset: Asset = {
  id: 'a1',
  code: 'AST001',
  name: 'Desktop Computer',
  category: 'IT Equipment',
  department: 'Finance',
  locationId: 'loc1',
  locationName: 'Building A Floor 1',
  quantity: 1,
  remainQty: 9,
  price: null,
  currency: null,
  totalAmount: null,
  inputDate: '2024-01-15',
  acquireDate: '2024-01-10',
  assetLife: '2y 4m',
  remark: null,
  imageUrl: null,
  serialNo: null,
  specification: null,
  updatedAt: '2026-05-22T10:00:00Z',
};
const row: AssetCountRow = { asset, countedQty: 2 };

describe('AssetCountListItem', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
    await setLocale('en');
  });

  it('renders asset fields, catalog metadata, and the current counted qty', () => {
    render(<AssetCountListItem row={row} onChangeQty={() => {}} />);
    expect(screen.getByText('AST001')).toBeOnTheScreen();
    expect(screen.getByText('Desktop Computer')).toBeOnTheScreen();
    expect(screen.getByText('IT Equipment')).toBeOnTheScreen();
    expect(screen.getByText('Finance')).toBeOnTheScreen();
    expect(screen.getByText(/Remain Qty: 9/)).toBeOnTheScreen();
    expect(screen.getByText(/Input Date: 2024-01-15/)).toBeOnTheScreen();
    expect(screen.getByLabelText('counted quantity').props.value).toBe('2');
  });

  it('reports the asset id and new qty when incremented', () => {
    const onChangeQty = jest.fn();
    render(<AssetCountListItem row={row} onChangeQty={onChangeQty} />);
    fireEvent.press(screen.getByLabelText('increment'));
    expect(onChangeQty).toHaveBeenCalledWith('a1', 3);
  });

  it('disables the stepper when locked', () => {
    const onChangeQty = jest.fn();
    render(<AssetCountListItem row={row} onChangeQty={onChangeQty} disabled />);
    fireEvent.press(screen.getByLabelText('increment'));
    expect(onChangeQty).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/counting/__tests__/AssetCountListItem.test.tsx`
Expected: FAIL — `Cannot find module '../AssetCountListItem'`.

- [ ] **Step 3: Implement** `src/features/counting/AssetCountListItem.tsx`:

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { useT } from '../../platform/i18n';
import { QtyStepper } from './QtyStepper';
import type { AssetCountRow } from './filterSortAssetCounts';

interface Props {
  row: AssetCountRow;
  onChangeQty: (assetId: string, qty: number) => void;
  disabled?: boolean;
}

export function AssetCountListItem({ row, onChangeQty, disabled }: Props) {
  const t = useT();
  const { asset, countedQty } = row;
  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.code}>{asset.code}</Text>
        <Text style={styles.name}>{asset.name}</Text>
        <View style={styles.meta}>
          {asset.category ? <Text style={styles.metaText}>{asset.category}</Text> : null}
          {asset.department ? <Text style={styles.metaText}>{asset.department}</Text> : null}
        </View>
        <Text style={styles.metaText}>
          {t('assets.field.remainQty')}: {asset.remainQty ?? '-'}
          {asset.assetLife ? ` · ${asset.assetLife}` : ''}
        </Text>
        {asset.inputDate || asset.acquireDate ? (
          <Text style={styles.metaText}>
            {asset.inputDate ? `${t('assets.field.inputDate')}: ${asset.inputDate}` : ''}
            {asset.inputDate && asset.acquireDate ? '   ' : ''}
            {asset.acquireDate ? `${t('assets.field.acquireDate')}: ${asset.acquireDate}` : ''}
          </Text>
        ) : null}
      </View>
      <QtyStepper value={countedQty} disabled={disabled} onChange={(n) => onChangeQty(asset.id, n)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  info: { flex: 1, gap: 2 },
  code: { fontFamily: 'monospace', fontSize: 12, color: '#475569' },
  name: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  meta: { flexDirection: 'row', gap: 8 },
  metaText: { fontSize: 12, color: '#64748b' },
});
```

Note: this reuses the existing `assets.field.*` i18n keys (added in Plan 2), so no new keys are needed for the row. The component now uses `useT()`, which is why the test initializes i18n in `beforeAll`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/counting/__tests__/AssetCountListItem.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/counting/AssetCountListItem.tsx src/features/counting/__tests__/AssetCountListItem.test.tsx
git commit -m "feat(counting): add AssetCountListItem row with inline stepper"
```

---

## Task 11: `AssetCountToolbar` component

**Files:**
- Create: `src/features/counting/AssetCountToolbar.tsx`
- Test: `src/features/counting/__tests__/AssetCountToolbar.test.tsx`

- [ ] **Step 1: Write the failing test** `src/features/counting/__tests__/AssetCountToolbar.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { initI18n, setLocale } from '../../../platform/i18n';
import { AssetCountToolbar } from '../AssetCountToolbar';

function setup(over: Partial<React.ComponentProps<typeof AssetCountToolbar>> = {}) {
  const props = {
    search: '',
    onSearchChange: jest.fn(),
    sort: 'code' as const,
    onSortChange: jest.fn(),
    category: null as string | null,
    onCategoryChange: jest.fn(),
    categories: ['IT Equipment'],
    ...over,
  };
  render(<AssetCountToolbar {...props} />);
  return props;
}

describe('AssetCountToolbar', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
    await setLocale('en');
  });

  it('reports typed search text', () => {
    const props = setup();
    fireEvent.changeText(screen.getByPlaceholderText('Search assets…'), 'desk');
    expect(props.onSearchChange).toHaveBeenCalledWith('desk');
  });

  it('reports a chosen sort key', () => {
    const props = setup();
    fireEvent.press(screen.getByText('Name'));
    expect(props.onSortChange).toHaveBeenCalledWith('name');
  });

  it('reports a chosen category and the All-categories reset', () => {
    const props = setup({ category: 'IT Equipment' });
    fireEvent.press(screen.getByText('All categories'));
    expect(props.onCategoryChange).toHaveBeenCalledWith(null);
    fireEvent.press(screen.getByText('IT Equipment'));
    expect(props.onCategoryChange).toHaveBeenCalledWith('IT Equipment');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/counting/__tests__/AssetCountToolbar.test.tsx`
Expected: FAIL — `Cannot find module '../AssetCountToolbar'`.

- [ ] **Step 3: Implement** `src/features/counting/AssetCountToolbar.tsx`:

```tsx
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useT } from '../../platform/i18n';
import type { AssetSort } from './filterSortAssetCounts';

const SORTS: AssetSort[] = ['code', 'name', 'department'];

interface Props {
  search: string;
  onSearchChange: (s: string) => void;
  sort: AssetSort;
  onSortChange: (s: AssetSort) => void;
  category: string | null;
  onCategoryChange: (c: string | null) => void;
  categories: string[];
}

export function AssetCountToolbar({
  search,
  onSearchChange,
  sort,
  onSortChange,
  category,
  onCategoryChange,
  categories,
}: Props) {
  const t = useT();
  return (
    <View style={styles.wrap}>
      <TextInput
        style={styles.search}
        value={search}
        onChangeText={onSearchChange}
        placeholder={t('documents.detail.search')}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.sortRow}>
        <Text style={styles.label}>{t('documents.sort.label')}</Text>
        {SORTS.map((s) => {
          const active = s === sort;
          const label = t(`documents.sort.${s}`);
          return (
            <Pressable
              key={s}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
              style={[styles.sortBtn, active && styles.sortBtnActive]}
              onPress={() => onSortChange(s)}
            >
              <Text style={[styles.sortText, active && styles.sortTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      {categories.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRow}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: category === null }}
            style={[styles.cat, category === null && styles.catActive]}
            onPress={() => onCategoryChange(null)}
          >
            <Text style={[styles.catText, category === null && styles.catTextActive]}>
              {t('documents.category.all')}
            </Text>
          </Pressable>
          {categories.map((c) => {
            const active = c === category;
            return (
              <Pressable
                key={c}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.cat, active && styles.catActive]}
                onPress={() => onCategoryChange(c)}
              >
                <Text style={[styles.catText, active && styles.catTextActive]}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  search: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 12, color: '#94a3b8' },
  sortBtn: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: '#e5e7eb' },
  sortBtnActive: { backgroundColor: '#2563eb' },
  sortText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  sortTextActive: { color: '#fff' },
  catRow: { gap: 8, paddingRight: 12 },
  cat: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#f1f5f9' },
  catActive: { backgroundColor: '#0f172a' },
  catText: { fontSize: 12, color: '#475569' },
  catTextActive: { color: '#fff' },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/counting/__tests__/AssetCountToolbar.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/counting/AssetCountToolbar.tsx src/features/counting/__tests__/AssetCountToolbar.test.tsx
git commit -m "feat(counting): add AssetCountToolbar (search/sort/category)"
```

---

## Task 12: Detail screen + route registration

**Files:**
- Create: `app/documents/[id].tsx`
- Modify: `app/_layout.tsx`

Glue screen — verified by typecheck + the manual QA in Task 14. Composes the tested hooks/components; applies `filterSortAssetCounts` in-memory; locks the stepper when the document is not a draft.

- [ ] **Step 1: Create `app/documents/[id].tsx`:**

```tsx
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useT } from '../../src/platform/i18n';
import { useCountingDocument } from '../../src/features/counting/useCountingDocument';
import { useAssetCountList } from '../../src/features/counting/useAssetCountList';
import { useSetCountedQty } from '../../src/features/counting/useSetCountedQty';
import { CountingDocumentHeader } from '../../src/features/counting/CountingDocumentHeader';
import { CountFilterChips } from '../../src/features/counting/CountFilterChips';
import { AssetCountToolbar } from '../../src/features/counting/AssetCountToolbar';
import { AssetCountListItem } from '../../src/features/counting/AssetCountListItem';
import {
  filterSortAssetCounts,
  type CountFilter,
  type AssetSort,
} from '../../src/features/counting/filterSortAssetCounts';

export default function CountingDocumentDetailScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const documentId = id ?? '';
  const { data: document, isLoading: docLoading } = useCountingDocument(documentId);
  const { data: rows, isLoading: listLoading } = useAssetCountList(
    documentId,
    document?.locationId ?? '',
  );
  const setQty = useSetCountedQty(documentId);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CountFilter>('all');
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<AssetSort>('code');

  const locked = document ? document.status !== 'draft' : false;

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows ?? []) if (r.asset.category) set.add(r.asset.category);
    return [...set].sort();
  }, [rows]);

  const visible = useMemo(
    () => filterSortAssetCounts(rows ?? [], { search, filter, category, sort }),
    [rows, search, filter, category, sort],
  );

  if (docLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: t('documents.title') }} />
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }
  if (!document) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: t('documents.title') }} />
        <View style={styles.center}>
          <Text style={styles.empty}>{t('documents.empty')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: document.runningNumber ?? t('documents.pending') }} />
      <FlatList
        data={visible}
        keyExtractor={(r) => r.asset.id}
        ListHeaderComponent={
          <View>
            <CountingDocumentHeader document={document} />
            <CountFilterChips value={filter} onChange={setFilter} />
            <AssetCountToolbar
              search={search}
              onSearchChange={setSearch}
              sort={sort}
              onSortChange={setSort}
              category={category}
              onCategoryChange={setCategory}
              categories={categories}
            />
          </View>
        }
        renderItem={({ item }) => (
          <AssetCountListItem
            row={item}
            disabled={locked}
            onChangeQty={(assetId, qty) => setQty.mutate({ assetId, qty })}
          />
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.empty}>
              {listLoading ? t('documents.loading') : t('documents.detail.empty')}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  center: { padding: 32, alignItems: 'center' },
  empty: { color: '#94a3b8' },
});
```

- [ ] **Step 2: Register the route in `app/_layout.tsx`.** Inside the `RouteGate`'s `<Stack ...>`, add this line after the `documents/new` line:

```tsx
        <Stack.Screen name="documents/[id]" />
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/documents/[id].tsx" app/_layout.tsx
git commit -m "feat(documents): add counting-document detail screen"
```

---

## Task 13: Wire create flow + View-All eye button into the detail screen

**Files:**
- Modify: `src/features/counting/CountingDocumentListItem.tsx`
- Modify: `src/features/counting/__tests__/CountingDocumentListItem.test.tsx`
- Modify: `app/(tabs)/documents.tsx`
- Modify: `app/documents/new.tsx`

- [ ] **Step 1: Add the eye-button test** — append this `it` inside the existing `describe('CountingDocumentListItem', …)` in `src/features/counting/__tests__/CountingDocumentListItem.test.tsx`:

```tsx
  it('renders a view button that fires onView for any status', () => {
    const onView = jest.fn();
    const committed: CountingDocument = { ...base, status: 'committed', runningNumber: 'CD26050001' };
    render(<CountingDocumentListItem document={committed} countedTotal={0} onView={onView} />);
    fireEvent.press(screen.getByLabelText('View'));
    expect(onView).toHaveBeenCalledWith(committed);
  });
```

(The file already imports `render`, `screen`, `fireEvent`, `CountingDocument`, and defines `base`. Confirm `fireEvent` is imported — Slice 2's file imports `{ render, screen, fireEvent }`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/counting/__tests__/CountingDocumentListItem.test.tsx`
Expected: FAIL — unable to find an element with label "View".

- [ ] **Step 3: Add `onView` + the eye button to `src/features/counting/CountingDocumentListItem.tsx`.**

First, add `onView` to the `Props` interface (it currently has `document`, `countedTotal`, `onVoid?`):

```ts
interface Props {
  document: CountingDocument;
  countedTotal: number;
  /** When provided (drafts only), renders a void/trash action. */
  onVoid?: (doc: CountingDocument) => void;
  /** When provided, renders a view (eye) action for any status. */
  onView?: (doc: CountingDocument) => void;
}
```

Add `onView` to the destructured params: `export function CountingDocumentListItem({ document, countedTotal, onVoid, onView }: Props) {`.

Then replace the trailing void-button block (currently the `{onVoid && status === 'draft' ? ( <Pressable …🗑…/> ) : null}` at the end of the row) with an actions group containing both the eye and trash buttons:

```tsx
      <View style={styles.actions}>
        {onView ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('documents.view')}
            style={styles.actionBtn}
            onPress={() => onView(document)}
          >
            <Text style={styles.actionIcon}>👁</Text>
          </Pressable>
        ) : null}
        {onVoid && status === 'draft' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('documents.void.action')}
            style={styles.actionBtn}
            onPress={() => onVoid(document)}
          >
            <Text style={styles.actionIcon}>🗑</Text>
          </Pressable>
        ) : null}
      </View>
```

Then update the stylesheet: replace the existing `voidBtn` / `voidIcon` style entries with:

```tsx
  actions: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  actionBtn: { paddingHorizontal: 8, paddingVertical: 8 },
  actionIcon: { fontSize: 18 },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/counting/__tests__/CountingDocumentListItem.test.tsx`
Expected: PASS (all prior tests — "Pending"+void, committed no-void — plus the new view-button test).

- [ ] **Step 5: Wire `onView` in `app/(tabs)/documents.tsx`.** Add the router import and pass `onView`. Change the import line for expo-router (add `useRouter`) — the file currently does not import it, so add:

```tsx
import { useRouter } from 'expo-router';
```

Inside `DocumentsScreen`, add `const router = useRouter();` near the other hooks, and update the `renderItem` `CountingDocumentListItem` to add the `onView` prop:

```tsx
          <CountingDocumentListItem
            document={item.document}
            countedTotal={item.countedTotal}
            onVoid={item.document.status === 'draft' ? setPendingVoid : undefined}
            onView={(doc) => router.push(`/documents/${doc.id}`)}
          />
```

- [ ] **Step 6: Route the create flow to detail in `app/documents/new.tsx`.** Change the create call's `onSuccess` from routing to the list to routing to the new document's detail. Replace:

```tsx
                create.mutate(item, { onSuccess: () => router.replace('/documents') });
```

with:

```tsx
                create.mutate(item, {
                  onSuccess: (doc) => router.replace(`/documents/${doc.id}`),
                });
```

(`useCreateCountingDocument`'s `mutationFn` returns the created `CountingDocument`, so `onSuccess` receives it as `doc`.)

- [ ] **Step 7: Verify typecheck + the affected suite**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx jest src/features/counting/__tests__/CountingDocumentListItem.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/counting/CountingDocumentListItem.tsx src/features/counting/__tests__/CountingDocumentListItem.test.tsx "app/(tabs)/documents.tsx" app/documents/new.tsx
git commit -m "feat(documents): open detail from View-All eye button and after create"
```

---

## Task 14: Slice verification (full suite, lint, format, manual QA)

**Files:** none (verification + final commit if formatting changes).

- [ ] **Step 1: Typecheck** — Run: `npx tsc --noEmit` — Expected: no errors.

- [ ] **Step 2: Lint** — Run: `npm run lint` — Expected: no errors. (`npm run lint:fix` if autofixable, then re-run.)

- [ ] **Step 3: Format** — Run: `npm run format:check`. If it lists Slice-3 files (under `src/features/counting`, `src/data/repos`, `src/platform/i18n`, `app/documents`), run `npx prettier --write` on those specific files (do NOT reformat unrelated files such as `CLAUDE.md`), then re-check.

- [ ] **Step 4: Full test suite** — Run: `CI=true npx jest 2>&1 | tail -15` — Expected: all suites PASS, including Slice 1 + Slice 2 (proves no regression — especially the Slice-2 `CountingDocumentListItem` and `documents`/`new` flows).

- [ ] **Step 5: Manual QA (mock backend)** — Run `npm start`, press `i`/`a`, sign in, then verify:
  1. **Documents** tab (Draft chip) → a draft row now shows an **👁 view** button. Tap it → the **detail screen** opens: header shows running#/Pending, **Draft** badge, location, count date; below it the **All/Counted/Uncounted** chips, a search box, **Sort** Code/Name/Dept, and category chips; then the asset rows for that location (e.g. Building A Floor 1 → AST001, AST002), each with a −/qty/+ stepper at 0.
  2. Tap **+** on AST001 → qty becomes 1. Switch the chip to **Counted** → AST001 shows; **Uncounted** → it's hidden. Type a number directly; **−** decrements; it can't go below 0.
  3. Back to **Documents** → the row's **Counted** total reflects the change (the View-All `countedTotals` invalidation).
  4. **Search** filters the rows; **category** chips filter; **Sort** reorders.
  5. From **Home → Create New Counting Document** → pick a location → you now land directly on the **detail screen** for the new draft (not the list).
  6. **Void** a draft from the list, then open it via 👁 → the steppers are **disabled** (locked), header still readable.

- [ ] **Step 6: Final commit (only if Steps 2–3 changed files)**

```bash
git add -A
git commit -m "chore(counting): lint/format pass for Slice 3"
```

---

## Self-Review (run by the plan author)

**1. Spec coverage (Slice 3 = §12.3 "Detail list: asset-to-count list, All/Counted/Uncounted, search, filter/sort, inline Counted Qty"; §7 detail behavior):**
- `/documents/[id]` detail route — Task 12. ✓
- Read-only header (running#/Pending, status, location, count date, commit date, description) — Task 8 (`CountingDocumentHeader`); editing deliberately deferred (locked scope decision). ✓
- Asset-to-Count list = location assets left-joined with this doc's entries — Tasks 1 (`listByLocation`) + 4 (`useAssetCountList`). ✓
- Row fields (code, name, category, department, remain qty, input date, acquire date, asset life) + inline Counted Qty stepper — Tasks 7 (`QtyStepper`) + 10 (`AssetCountListItem`, which renders all §7-listed catalog fields via the reused `assets.field.*` keys). ✓
- Inline qty persists immediately + enqueues `entry.upsert` — Task 5 (`useSetCountedQty`). ✓
- All/Counted/Uncounted chips (`countQty > 0` ⇒ Counted) — Tasks 2 (filter logic) + 9 (`CountFilterChips`). ✓
- Local search (code/name/category/department) — Tasks 2 + 11. ✓
- Filter by category; sort by code/name/department — Tasks 2 + 11. ✓
- Locked state when committed/void disables inline qty — Task 12 (`locked` → `disabled`) + Task 7 (stepper honors `disabled`). ✓
- View-All eye button → detail; create flow → detail — Task 13. ✓
- i18n en+th for all new labels — Task 6. ✓

**Deliberately deferred (documented, not gaps):** per-row view→Asset Information (Slice 4), Scan button (Slice 5), Commit + header editing + Save as Draft (Slice 6/later), location-override-hides rule (Slice 4), Buddhist-calendar dates (§10).

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N". Every code step has complete code. ✓

**3. Type consistency:**
- `AssetCountRow { asset: Asset; countedQty: number }`, `CountFilter`, `AssetSort`, `AssetCountFilterOptions` defined in `filterSortAssetCounts.ts` (Task 2) and imported identically by `useAssetCountList` (Task 4), `CountFilterChips` (Task 9), `AssetCountListItem` (Task 10), `AssetCountToolbar` (Task 11), and the screen (Task 12). ✓
- `useSetCountedQty(documentId).mutate({ assetId, qty })` — same shape in the hook (Task 5), the screen's `onChangeQty` (Task 12), and the test (Task 5). ✓
- `entry.upsert` payload `{ documentId, entries: CountEntry[] }` matches the existing `syncWorker` destructuring (`const { documentId, entries } = m.payload`). ✓
- `assetRepo.listByLocation(locationId)` signature identical in interface + impl (Task 1) and caller (Task 4). ✓
- `QtyStepper { value, onChange, disabled? }` identical in component (Task 7), `AssetCountListItem` (Task 10), and tests. ✓
- `CountingDocumentListItem` gains `onView?: (doc) => void` (Task 13) — used by `documents.tsx` (Task 13); existing `onVoid` behavior unchanged. ✓
- i18n keys referenced by components (`documents.field.countDate/commitDate`, `documents.countFilter.*`, `documents.sort.*`, `documents.category.all`, `documents.detail.*`, `documents.view`) are all added in Task 6. ✓
- Query keys: list `['assetCountList', documentId]` + `['countingDocument', id]`; `useSetCountedQty` invalidates `['assetCountList', documentId]` and `['countingDocuments']` (Slice-2 list prefix) — consistent. ✓
