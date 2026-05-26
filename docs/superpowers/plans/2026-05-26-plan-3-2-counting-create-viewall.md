# Counting Documents — Slice 2: Create + View-All — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff create a draft Counting Document by picking a Location from the Home screen, then see, filter (Draft/Committed/Void), and void those documents in a View-All list — all offline-first, with writes queued through the existing sync worker.

**Architecture:** New `features/counting/` module (React Query read hooks + mutation hooks + presentational components) reading from the Slice 1 SQLite repos and writing through a **shared** `MutationQueue` exposed via a new React context (`MutationQueueProvider`) so enqueued mutations immediately wake the sync worker. New routes: three Home actions, a `/documents/new` location-pick modal, and a rewritten `/documents` tab list. One reusable `ui/ConfirmDialog`. No schema migration (Slice 1 created the tables); one additive repo method for per-document counted totals.

**Tech Stack:** Expo Router, React 19, `@tanstack/react-query` v5, Zustand, `expo-sqlite` (via `SqlExecutor`), `react-i18next`. Tests: Jest (`jest-expo`) + `@testing-library/react-native` (`render`, `renderHook`, `waitFor`, `act`) + `better-sqlite3` in-memory via `testDb.ts`.

**Spec:** `docs/superpowers/specs/2026-05-26-counting-documents-design.md` — Slice 2 in §12, plus §1 (Home actions), §6 (navigation), §7 floating-action context, decisions 3 & 4.

---

## File Structure

**New files**
- `src/platform/id.ts` — shared `uuid()` helper (platform layer, no deps). Used for on-device document ids.
- `src/platform/__tests__/id.test.ts` — test.
- `src/data/sync/mutationQueueContext.tsx` — `MutationQueueProvider` + `useMutationQueue()` (mirrors `dbContext`/`carmenApiContext`).
- `src/features/counting/newCountingDocument.ts` — pure factory building a draft `CountingDocument` from a `Location` + `createdBy`.
- `src/features/counting/__tests__/newCountingDocument.test.ts` — test.
- `src/features/counting/useLocations.ts` — React Query hook listing catalog locations.
- `src/features/counting/useCountingDocuments.ts` — React Query hook listing documents by status, each with a counted total.
- `src/features/counting/useCreateCountingDocument.ts` — mutation hook: persist draft + enqueue `document.upsert`.
- `src/features/counting/useVoidCountingDocument.ts` — mutation hook: set status `void` + enqueue `document.upsert`.
- `src/features/counting/StatusFilterChips.tsx` — Draft/Committed/Void filter chips.
- `src/features/counting/CountingDocumentListItem.tsx` — one document row.
- `src/features/counting/__tests__/renderCountingHook.tsx` — shared test harness (providers + testDb-backed queue).
- `src/features/counting/__tests__/useLocations.test.tsx` — test.
- `src/features/counting/__tests__/useCountingDocuments.test.tsx` — test.
- `src/features/counting/__tests__/useCreateCountingDocument.test.tsx` — test.
- `src/features/counting/__tests__/useVoidCountingDocument.test.tsx` — test.
- `src/features/counting/__tests__/StatusFilterChips.test.tsx` — test.
- `src/features/counting/__tests__/CountingDocumentListItem.test.tsx` — test.
- `src/ui/ConfirmDialog.tsx` — reusable confirm modal (reused by Slices 4 & 6).
- `src/ui/__tests__/ConfirmDialog.test.tsx` — test.
- `app/documents/new.tsx` — location-pick create modal.

**Modified files**
- `src/data/repos/countEntryRepo.ts` — add `countedTotalsByDocument(documentIds)` to the interface + impl.
- `src/data/repos/__tests__/countEntryRepo.test.ts` — add a test block.
- `app/_layout.tsx` — create the queue once from `db`, wrap children in `MutationQueueProvider`, and have `SyncInfrastructure` consume the shared queue; register the `documents/new` modal route.
- `app/(tabs)/index.tsx` — replace the single button with the three customer Home actions (+ keep Browse assets as a secondary link).
- `app/(tabs)/__tests__/tabs.test.tsx` — assert the three Home action labels render.
- `app/(tabs)/documents.tsx` — rewrite the placeholder into the View-All list (chips + rows + void confirm).
- `src/platform/i18n/locales/en.json` — add `documents.*` keys.
- `src/platform/i18n/locales/th.json` — add `documents.*` keys.
- `src/platform/i18n/__tests__/i18n.test.ts` — assert a new key resolves.

**Out of slice (deferred), to avoid scope creep — see end of plan:**
- The row **view (eye) → `/documents/[id]` detail** and the detail screen itself land in **Slice 3**; Slice 2 rows show info + the void trash only, and create routes to the list.
- Intl/Buddhist-calendar **date formatting** (spec §10) is cross-cutting and not assigned to a numbered slice; Slice 2 renders `countDate` as the raw `YYYY-MM-DD` string. Flagged below.

---

## Task 1: Shared `uuid()` helper

**Files:**
- Create: `src/platform/id.ts`
- Test: `src/platform/__tests__/id.test.ts`

Rationale: the document id is "generated on-device" (spec §3.2). `pendingMutationRepo.ts` and `mutationQueue.ts` each have a private `uuid()`; rather than add a third copy, add one shared helper for new code (existing copies are left untouched — refactoring them is out of this slice's scope).

- [ ] **Step 1: Write the failing test**

`src/platform/__tests__/id.test.ts`:
```ts
import { uuid } from '../id';

describe('uuid', () => {
  it('returns a non-empty string', () => {
    expect(typeof uuid()).toBe('string');
    expect(uuid().length).toBeGreaterThan(0);
  });

  it('returns distinct values across calls', () => {
    expect(uuid()).not.toBe(uuid());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/platform/__tests__/id.test.ts`
Expected: FAIL — `Cannot find module '../id'`.

- [ ] **Step 3: Write the implementation**

`src/platform/id.ts`:
```ts
/** App-side unique id (matches the existing repo/queue id format; not RFC-4122). */
export function uuid(): string {
  return (
    Date.now().toString(16) +
    '-' +
    Math.random().toString(16).slice(2, 10) +
    '-' +
    Math.random().toString(16).slice(2, 10)
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/platform/__tests__/id.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/platform/id.ts src/platform/__tests__/id.test.ts
git commit -m "feat(platform): add shared uuid helper"
```

---

## Task 2: `newCountingDocument` factory

**Files:**
- Create: `src/features/counting/newCountingDocument.ts`
- Test: `src/features/counting/__tests__/newCountingDocument.test.ts`

- [ ] **Step 1: Write the failing test**

`src/features/counting/__tests__/newCountingDocument.test.ts`:
```ts
import { newCountingDocument } from '../newCountingDocument';
import type { Location } from '../../../data/repos/types';

const location: Location = { id: 'loc1', name: 'Building A Floor 1', updatedAt: '2026-05-22T10:00:00Z' };

describe('newCountingDocument', () => {
  it('builds a draft document scoped to the location', () => {
    const now = new Date('2026-05-26T08:30:00Z');
    const doc = newCountingDocument({ location, createdBy: 'u-1', now });

    expect(doc.status).toBe('draft');
    expect(doc.runningNumber).toBeNull();
    expect(doc.commitDate).toBeNull();
    expect(doc.description).toBe('');
    expect(doc.locationId).toBe('loc1');
    expect(doc.locationName).toBe('Building A Floor 1');
    expect(doc.createdBy).toBe('u-1');
    expect(doc.countDate).toBe('2026-05-26');
    expect(doc.createdAt).toBe('2026-05-26T08:30:00.000Z');
    expect(doc.id).toMatch(/.+/);
  });

  it('generates a distinct id per call', () => {
    const a = newCountingDocument({ location, createdBy: 'u-1' });
    const b = newCountingDocument({ location, createdBy: 'u-1' });
    expect(a.id).not.toBe(b.id);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/features/counting/__tests__/newCountingDocument.test.ts`
Expected: FAIL — `Cannot find module '../newCountingDocument'`.

- [ ] **Step 3: Write the implementation**

`src/features/counting/newCountingDocument.ts`:
```ts
import { uuid } from '../../platform/id';
import type { Location } from '../../data/repos/types';
import type { CountingDocument } from '../../data/api/carmenApi';

export function newCountingDocument(input: {
  location: Location;
  createdBy: string;
  now?: Date;
}): CountingDocument {
  const now = input.now ?? new Date();
  return {
    id: uuid(),
    runningNumber: null, // assigned server-side on sync (spec §3.2)
    locationId: input.location.id,
    locationName: input.location.name,
    status: 'draft',
    countDate: now.toISOString().slice(0, 10), // YYYY-MM-DD
    commitDate: null,
    description: '',
    createdBy: input.createdBy,
    createdAt: now.toISOString(),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/features/counting/__tests__/newCountingDocument.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/counting/newCountingDocument.ts src/features/counting/__tests__/newCountingDocument.test.ts
git commit -m "feat(counting): add newCountingDocument draft factory"
```

---

## Task 3: `countEntryRepo.countedTotalsByDocument`

**Files:**
- Modify: `src/data/repos/countEntryRepo.ts`
- Test: `src/data/repos/__tests__/countEntryRepo.test.ts`

The View-All row shows "total assets counted" (spec §6). Compute it with one grouped query (counting entries with `countQty > 0`) rather than N per-row queries. No entries exist until Slice 4, so totals are `0` today, but the query is correct for later slices.

- [ ] **Step 1: Write the failing test** — append this block inside the existing `describe('countEntryRepo', …)` in `src/data/repos/__tests__/countEntryRepo.test.ts`, after the last `it(...)`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/data/repos/__tests__/countEntryRepo.test.ts`
Expected: FAIL — `repo.countedTotalsByDocument is not a function`.

- [ ] **Step 3: Add the method to the interface** in `src/data/repos/countEntryRepo.ts`, in the `CountEntryRepo` interface (after `markSynced`):

```ts
  markSynced(ids: string[]): Promise<void>;
  /** Map of documentId -> number of entries with countQty > 0. Documents with none are omitted. */
  countedTotalsByDocument(documentIds: string[]): Promise<Record<string, number>>;
```

- [ ] **Step 4: Add the implementation** in the returned object in `src/data/repos/countEntryRepo.ts`, after the `markSynced` impl:

```ts
    async countedTotalsByDocument(documentIds) {
      if (documentIds.length === 0) return {};
      const placeholders = documentIds.map(() => '?').join(',');
      const rows = await db.getAllAsync<{ documentId: string; n: number }>(
        `SELECT documentId, COUNT(*) AS n FROM count_entry
         WHERE documentId IN (${placeholders}) AND countQty > 0
         GROUP BY documentId`,
        documentIds,
      );
      const out: Record<string, number> = {};
      for (const r of rows) out[r.documentId] = r.n;
      return out;
    },
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest src/data/repos/__tests__/countEntryRepo.test.ts`
Expected: PASS (all prior tests + 2 new).

- [ ] **Step 6: Commit**

```bash
git add src/data/repos/countEntryRepo.ts src/data/repos/__tests__/countEntryRepo.test.ts
git commit -m "feat(data): add countEntryRepo.countedTotalsByDocument"
```

---

## Task 4: Shared `MutationQueueProvider` + wire into the root layout

**Files:**
- Create: `src/data/sync/mutationQueueContext.tsx`
- Modify: `app/_layout.tsx`

Why: feature mutation hooks (Tasks 8–9) must enqueue through the **same** `MutationQueue` instance the running `syncWorker` subscribed to — otherwise the persisted mutation never triggers `drainOnce()` and the running number stays "pending" until an unrelated netinfo event. This is an infra/wiring task verified by typecheck + the full suite + the hook tests that consume it (Tasks 8–9); it has no standalone unit test (consistent with the untested `dbContext`/`carmenApiContext`).

- [ ] **Step 1: Create the context**

`src/data/sync/mutationQueueContext.tsx`:
```tsx
import { createContext, useContext, type ReactNode } from 'react';
import type { MutationQueue } from './mutationQueue';

const MutationQueueCtx = createContext<MutationQueue | null>(null);

export function MutationQueueProvider({
  value,
  children,
}: {
  value: MutationQueue;
  children: ReactNode;
}) {
  return <MutationQueueCtx.Provider value={value}>{children}</MutationQueueCtx.Provider>;
}

export function useMutationQueue(): MutationQueue {
  const v = useContext(MutationQueueCtx);
  if (!v) throw new Error('useMutationQueue used outside MutationQueueProvider');
  return v;
}
```

- [ ] **Step 2: Add imports to `app/_layout.tsx`**

Add these two imports near the other `src/data/sync` imports (e.g., after the `createMutationQueue` import on line 16):
```ts
import { MutationQueueProvider, useMutationQueue } from '../src/data/sync/mutationQueueContext';
import { useMemo } from 'react';
```
(If `useMemo` is not already imported — the file currently imports `{ useEffect, useState }` from `'react'`; change that line to `import { useEffect, useMemo, useState } from 'react';` and do **not** add a second `react` import.)

- [ ] **Step 3: Provide the queue from `RootLayout`**

In `app/_layout.tsx`, replace the returned provider tree (the `return ( <SafeAreaProvider> … </SafeAreaProvider> )` block in `RootLayout`) with a version that creates the queue once from the bootstrapped db and provides it. Replace this exact block:

```tsx
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
```

with:

```tsx
  return <AppProviders bootstrap={bootstrap} />;
}

function AppProviders({ bootstrap }: { bootstrap: BootstrapResult }) {
  const queue = useMemo(
    () => createMutationQueue(createPendingMutationRepo(bootstrap.db)),
    [bootstrap.db],
  );
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <QueryClientProvider client={queryClient}>
        <DbProvider value={bootstrap.db}>
          <CarmenApiProvider value={bootstrap.auth.api}>
            <MutationQueueProvider value={queue}>
              <AuthBundleProvider value={bootstrap.auth}>
                <SyncInfrastructure />
                <RouteGate />
              </AuthBundleProvider>
            </MutationQueueProvider>
          </CarmenApiProvider>
        </DbProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
```

(`createMutationQueue` and `createPendingMutationRepo` are already imported in this file.)

- [ ] **Step 4: Make `SyncInfrastructure` consume the shared queue**

In `app/_layout.tsx`, in `SyncInfrastructure`, add the queue from context and delete the two lines that built a private repo + queue. Change the top of the function from:

```tsx
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
```

to:

```tsx
function SyncInfrastructure() {
  const session = useAuthStore((s) => s.session);
  const { api } = useAuthBundle();
  const db = useDb();
  const queue = useMutationQueue();

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    let online = true;
```

Then update the effect's dependency array at the end of that `useEffect` from `[session, api, db]` to `[session, api, db, queue]`.

- [ ] **Step 5: Verify typecheck + full suite (no regressions)**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm test`
Expected: all existing tests still PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/sync/mutationQueueContext.tsx app/_layout.tsx
git commit -m "feat(sync): share one MutationQueue via context so UI writes wake the worker"
```

---

## Task 5: i18n keys for the documents UI

**Files:**
- Modify: `src/platform/i18n/locales/en.json`
- Modify: `src/platform/i18n/locales/th.json`
- Modify: `src/platform/i18n/__tests__/i18n.test.ts`

Add the keys first so the component tests (Tasks 10–12) can assert rendered English text.

- [ ] **Step 1: Write the failing test** — add to `src/platform/i18n/__tests__/i18n.test.ts` (inside the existing top-level `describe`, add a new `it`; the file already calls `initI18n`/`setLocale` — match its existing setup):

```ts
  it('resolves the new documents keys', () => {
    expect(t('documents.title')).toBe('Counting Documents');
    expect(t('documents.status.draft')).toBe('Draft');
    expect(t('documents.void.confirm')).toBe('Void');
  });
```

(If the test file imports `t` from `'../index'` and switches locale, ensure this assertion runs under the `en` locale like the surrounding tests. If the file only imports `useT`, add `import { t, setLocale } from '../index';` and `await setLocale('en');` at the start of the `it`.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/platform/i18n/__tests__/i18n.test.ts`
Expected: FAIL — received the key string `'documents.title'` instead of `'Counting Documents'`.

- [ ] **Step 3: Add the `en` block** — insert this `"documents"` object into `src/platform/i18n/locales/en.json` (e.g., immediately after the `"assets": { … }` block; remember to add the comma after the preceding block):

```json
  "documents": {
    "title": "Counting Documents",
    "empty": "No counting documents yet.",
    "loading": "Loading…",
    "pending": "Pending",
    "counted": "Counted",
    "status": {
      "draft": "Draft",
      "committed": "Committed",
      "void": "Void"
    },
    "void": {
      "action": "Void",
      "title": "Void this document?",
      "message": "This counting document will be voided. This can’t be undone.",
      "confirm": "Void"
    },
    "new": {
      "title": "New Counting Document",
      "subtitle": "Select a location to count",
      "empty": "No locations available."
    }
  },
```

- [ ] **Step 4: Add the `th` block** — insert this `"documents"` object into `src/platform/i18n/locales/th.json` at the matching position (add the comma after the preceding block):

```json
  "documents": {
    "title": "ใบตรวจนับ",
    "empty": "ยังไม่มีใบตรวจนับ",
    "loading": "กำลังโหลด…",
    "pending": "รอดำเนินการ",
    "counted": "นับแล้ว",
    "status": {
      "draft": "ฉบับร่าง",
      "committed": "ยืนยันแล้ว",
      "void": "ยกเลิก"
    },
    "void": {
      "action": "ยกเลิกเอกสาร",
      "title": "ยกเลิกใบตรวจนับนี้?",
      "message": "ใบตรวจนับนี้จะถูกยกเลิกและไม่สามารถกู้คืนได้",
      "confirm": "ยกเลิกเอกสาร"
    },
    "new": {
      "title": "สร้างใบตรวจนับใหม่",
      "subtitle": "เลือกสถานที่ที่จะตรวจนับ",
      "empty": "ไม่มีสถานที่ให้เลือก"
    }
  },
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest src/platform/i18n/__tests__/i18n.test.ts`
Expected: PASS.

- [ ] **Step 6: Verify JSON validity**

Run: `npm run typecheck`
Expected: no errors (catches a trailing/missing comma if the JSON imports break).

- [ ] **Step 7: Commit**

```bash
git add src/platform/i18n/locales/en.json src/platform/i18n/locales/th.json src/platform/i18n/__tests__/i18n.test.ts
git commit -m "feat(i18n): add documents (counting list/create/void) keys"
```

---

## Task 6: `useLocations` + shared hook test harness

**Files:**
- Create: `src/features/counting/__tests__/renderCountingHook.tsx`
- Create: `src/features/counting/useLocations.ts`
- Test: `src/features/counting/__tests__/useLocations.test.tsx`

- [ ] **Step 1: Create the shared test harness**

`src/features/counting/__tests__/renderCountingHook.tsx`:
```tsx
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DbProvider } from '../../../data/db/dbContext';
import { MutationQueueProvider } from '../../../data/sync/mutationQueueContext';
import { createMutationQueue, type MutationQueue } from '../../../data/sync/mutationQueue';
import { createPendingMutationRepo } from '../../../data/repos/pendingMutationRepo';
import type { SqlExecutor } from '../../../data/db/types';

/** Wraps a hook under test with the providers it needs, backed by a real testDb-backed queue. */
export function makeWrapper(db: SqlExecutor): {
  wrapper: (props: { children: ReactNode }) => ReactNode;
  queue: MutationQueue;
} {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const queue = createMutationQueue(createPendingMutationRepo(db));
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <DbProvider value={db}>
          <MutationQueueProvider value={queue}>{children}</MutationQueueProvider>
        </DbProvider>
      </QueryClientProvider>
    );
  }
  return { wrapper, queue };
}
```

- [ ] **Step 2: Write the failing test**

`src/features/counting/__tests__/useLocations.test.tsx`:
```tsx
import { renderHook, waitFor } from '@testing-library/react-native';
import { makeMigratedTestDb, type TestDb } from '../../../data/db/__tests__/testDb';
import { createLocationRepo } from '../../../data/repos/locationRepo';
import { makeWrapper } from './renderCountingHook';
import { useLocations } from '../useLocations';

describe('useLocations', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
    await createLocationRepo(db).upsertMany([
      { id: 'loc1', name: 'Building A Floor 1', updatedAt: '2026-05-22T10:00:00Z' },
      { id: 'loc2', name: 'Building A Floor 2', updatedAt: '2026-05-22T10:00:00Z' },
    ]);
  });
  afterEach(() => db.close());

  it('returns locations from the repo', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useLocations(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((l) => l.id)).toEqual(['loc1', 'loc2']);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest src/features/counting/__tests__/useLocations.test.tsx`
Expected: FAIL — `Cannot find module '../useLocations'`.

- [ ] **Step 4: Write the implementation**

`src/features/counting/useLocations.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { useDb } from '../../data/db/dbContext';
import { createLocationRepo } from '../../data/repos/locationRepo';

export function useLocations() {
  const db = useDb();
  return useQuery({
    queryKey: ['locations'],
    queryFn: () => createLocationRepo(db).list(),
  });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest src/features/counting/__tests__/useLocations.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/counting/useLocations.ts src/features/counting/__tests__/renderCountingHook.tsx src/features/counting/__tests__/useLocations.test.tsx
git commit -m "feat(counting): add useLocations hook + test harness"
```

---

## Task 7: `useCountingDocuments`

**Files:**
- Create: `src/features/counting/useCountingDocuments.ts`
- Test: `src/features/counting/__tests__/useCountingDocuments.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/features/counting/__tests__/useCountingDocuments.test.tsx`:
```tsx
import { renderHook, waitFor } from '@testing-library/react-native';
import { makeMigratedTestDb, type TestDb } from '../../../data/db/__tests__/testDb';
import { createCountingDocumentRepo } from '../../../data/repos/countingDocumentRepo';
import { createCountEntryRepo } from '../../../data/repos/countEntryRepo';
import { makeWrapper } from './renderCountingHook';
import { useCountingDocuments } from '../useCountingDocuments';
import type { CountingDocument, CountEntry } from '../../../data/api/carmenApi';

function doc(id: string, status: CountingDocument['status']): CountingDocument {
  return {
    id,
    runningNumber: null,
    locationId: 'loc1',
    locationName: 'Building A Floor 1',
    status,
    countDate: '2026-05-26',
    commitDate: null,
    description: '',
    createdBy: 'u-1',
    createdAt: '2026-05-26T08:00:00Z',
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

describe('useCountingDocuments', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
    const docs = createCountingDocumentRepo(db);
    await docs.upsert(doc('d1', 'draft'));
    await docs.upsert(doc('d2', 'committed'));
    const entries = createCountEntryRepo(db);
    await entries.upsert(entry('e1', 'd1', 'a1', 2));
    await entries.upsert(entry('e2', 'd1', 'a2', 0)); // not counted
  });
  afterEach(() => db.close());

  it('returns only documents of the requested status, with counted totals', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useCountingDocuments('draft'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      { document: expect.objectContaining({ id: 'd1', status: 'draft' }), countedTotal: 1 },
    ]);
  });

  it('returns committed documents with a zero counted total', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useCountingDocuments('committed'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      { document: expect.objectContaining({ id: 'd2', status: 'committed' }), countedTotal: 0 },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/features/counting/__tests__/useCountingDocuments.test.tsx`
Expected: FAIL — `Cannot find module '../useCountingDocuments'`.

- [ ] **Step 3: Write the implementation**

`src/features/counting/useCountingDocuments.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { useDb } from '../../data/db/dbContext';
import { createCountingDocumentRepo } from '../../data/repos/countingDocumentRepo';
import { createCountEntryRepo } from '../../data/repos/countEntryRepo';
import type { CountingDocument } from '../../data/api/carmenApi';

export interface CountingDocumentListEntry {
  document: CountingDocument;
  countedTotal: number;
}

export function useCountingDocuments(status: CountingDocument['status']) {
  const db = useDb();
  return useQuery({
    queryKey: ['countingDocuments', status],
    queryFn: async (): Promise<CountingDocumentListEntry[]> => {
      const docs = await createCountingDocumentRepo(db).list({ status });
      const totals = await createCountEntryRepo(db).countedTotalsByDocument(docs.map((d) => d.id));
      return docs.map((document) => ({ document, countedTotal: totals[document.id] ?? 0 }));
    },
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/features/counting/__tests__/useCountingDocuments.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/counting/useCountingDocuments.ts src/features/counting/__tests__/useCountingDocuments.test.tsx
git commit -m "feat(counting): add useCountingDocuments hook with counted totals"
```

---

## Task 8: `useCreateCountingDocument`

**Files:**
- Create: `src/features/counting/useCreateCountingDocument.ts`
- Test: `src/features/counting/__tests__/useCreateCountingDocument.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/features/counting/__tests__/useCreateCountingDocument.test.tsx`:
```tsx
import { renderHook, act } from '@testing-library/react-native';
import { makeMigratedTestDb, type TestDb } from '../../../data/db/__tests__/testDb';
import { createCountingDocumentRepo } from '../../../data/repos/countingDocumentRepo';
import { createPendingMutationRepo } from '../../../data/repos/pendingMutationRepo';
import { useAuthStore } from '../../auth/authStore';
import { makeWrapper } from './renderCountingHook';
import { useCreateCountingDocument } from '../useCreateCountingDocument';
import type { Session } from '../../../data/api/carmenApi';
import type { CountingDocument } from '../../../data/api/carmenApi';

const location = { id: 'loc1', name: 'Building A Floor 1', updatedAt: '2026-05-22T10:00:00Z' };
const session: Session = {
  token: 't',
  refreshToken: 'r',
  expiresAt: '2030-01-01T00:00:00Z',
  user: { id: 'u-1', displayName: 'Tester', email: null, roles: [] },
};

describe('useCreateCountingDocument', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
    useAuthStore.setState({ session, status: 'signedIn' });
  });
  afterEach(() => {
    db.close();
    useAuthStore.setState({ session: null, status: 'loading' });
  });

  it('persists a draft document and enqueues a document.upsert mutation', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useCreateCountingDocument(), { wrapper });

    let created: CountingDocument | undefined;
    await act(async () => {
      created = await result.current.mutateAsync(location);
    });

    const stored = await createCountingDocumentRepo(db).list({ status: 'draft' });
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      id: created!.id,
      status: 'draft',
      locationId: 'loc1',
      locationName: 'Building A Floor 1',
      createdBy: 'u-1',
      runningNumber: null,
    });

    const pending = await createPendingMutationRepo(db).listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].kind).toBe('document.upsert');
    expect((pending[0].payload as CountingDocument).id).toBe(created!.id);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/features/counting/__tests__/useCreateCountingDocument.test.tsx`
Expected: FAIL — `Cannot find module '../useCreateCountingDocument'`.

- [ ] **Step 3: Write the implementation**

`src/features/counting/useCreateCountingDocument.ts`:
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDb } from '../../data/db/dbContext';
import { useMutationQueue } from '../../data/sync/mutationQueueContext';
import { createCountingDocumentRepo } from '../../data/repos/countingDocumentRepo';
import { useAuthStore } from '../auth/authStore';
import { newCountingDocument } from './newCountingDocument';
import type { Location } from '../../data/repos/types';
import type { CountingDocument } from '../../data/api/carmenApi';

export function useCreateCountingDocument() {
  const db = useDb();
  const queue = useMutationQueue();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (location: Location): Promise<CountingDocument> => {
      const createdBy = useAuthStore.getState().session?.user.id ?? 'unknown';
      const doc = newCountingDocument({ location, createdBy });
      await createCountingDocumentRepo(db).upsert(doc);
      await queue.enqueue('document.upsert', doc);
      return doc;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['countingDocuments'] });
    },
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/features/counting/__tests__/useCreateCountingDocument.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/counting/useCreateCountingDocument.ts src/features/counting/__tests__/useCreateCountingDocument.test.tsx
git commit -m "feat(counting): add useCreateCountingDocument mutation hook"
```

---

## Task 9: `useVoidCountingDocument`

**Files:**
- Create: `src/features/counting/useVoidCountingDocument.ts`
- Test: `src/features/counting/__tests__/useVoidCountingDocument.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/features/counting/__tests__/useVoidCountingDocument.test.tsx`:
```tsx
import { renderHook, act } from '@testing-library/react-native';
import { makeMigratedTestDb, type TestDb } from '../../../data/db/__tests__/testDb';
import { createCountingDocumentRepo } from '../../../data/repos/countingDocumentRepo';
import { createPendingMutationRepo } from '../../../data/repos/pendingMutationRepo';
import { makeWrapper } from './renderCountingHook';
import { useVoidCountingDocument } from '../useVoidCountingDocument';
import type { CountingDocument } from '../../../data/api/carmenApi';

const draft: CountingDocument = {
  id: 'd1',
  runningNumber: 'CD26050001',
  locationId: 'loc1',
  locationName: 'Building A Floor 1',
  status: 'draft',
  countDate: '2026-05-26',
  commitDate: null,
  description: '',
  createdBy: 'u-1',
  createdAt: '2026-05-26T08:00:00Z',
};

describe('useVoidCountingDocument', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
    await createCountingDocumentRepo(db).upsert(draft);
  });
  afterEach(() => db.close());

  it('sets status to void locally and enqueues a document.upsert mutation', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useVoidCountingDocument(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(draft);
    });

    const stored = await createCountingDocumentRepo(db).findById('d1');
    expect(stored?.status).toBe('void');

    const pending = await createPendingMutationRepo(db).listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].kind).toBe('document.upsert');
    expect((pending[0].payload as CountingDocument).status).toBe('void');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/features/counting/__tests__/useVoidCountingDocument.test.tsx`
Expected: FAIL — `Cannot find module '../useVoidCountingDocument'`.

- [ ] **Step 3: Write the implementation**

`src/features/counting/useVoidCountingDocument.ts`:
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDb } from '../../data/db/dbContext';
import { useMutationQueue } from '../../data/sync/mutationQueueContext';
import { createCountingDocumentRepo } from '../../data/repos/countingDocumentRepo';
import type { CountingDocument } from '../../data/api/carmenApi';

export function useVoidCountingDocument() {
  const db = useDb();
  const queue = useMutationQueue();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: CountingDocument): Promise<void> => {
      const voided: CountingDocument = { ...doc, status: 'void' };
      await createCountingDocumentRepo(db).upsert(voided);
      await queue.enqueue('document.upsert', voided);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['countingDocuments'] });
    },
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/features/counting/__tests__/useVoidCountingDocument.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/counting/useVoidCountingDocument.ts src/features/counting/__tests__/useVoidCountingDocument.test.tsx
git commit -m "feat(counting): add useVoidCountingDocument mutation hook"
```

---

## Task 10: `ConfirmDialog` (ui)

**Files:**
- Create: `src/ui/ConfirmDialog.tsx`
- Test: `src/ui/__tests__/ConfirmDialog.test.tsx`

Reusable controlled confirm modal (reused by Slice 4 "Discard Change?" and Slice 6 commit confirm). Returns `null` when not visible so visibility is deterministic in tests.

- [ ] **Step 1: Write the failing test**

`src/ui/__tests__/ConfirmDialog.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ConfirmDialog } from '../ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders nothing when not visible', () => {
    render(
      <ConfirmDialog
        visible={false}
        title="Void this document?"
        confirmLabel="Void"
        cancelLabel="Cancel"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.queryByText('Void this document?')).toBeNull();
  });

  it('shows title/message and fires the right callbacks', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    render(
      <ConfirmDialog
        visible
        title="Void this document?"
        message="This cannot be undone."
        confirmLabel="Void"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText('Void this document?')).toBeOnTheScreen();
    expect(screen.getByText('This cannot be undone.')).toBeOnTheScreen();

    fireEvent.press(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByText('Void'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/ui/__tests__/ConfirmDialog.test.tsx`
Expected: FAIL — `Cannot find module '../ConfirmDialog'`.

- [ ] **Step 3: Write the implementation**

`src/ui/ConfirmDialog.tsx`:
```tsx
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={[styles.confirmBtn, destructive && styles.destructiveBtn]}
              onPress={onConfirm}
            >
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 20, gap: 8 },
  title: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  message: { fontSize: 14, color: '#475569' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  cancelText: { fontSize: 15, color: '#475569', fontWeight: '600' },
  confirmBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#2563eb' },
  destructiveBtn: { backgroundColor: '#dc2626' },
  confirmText: { fontSize: 15, color: '#fff', fontWeight: '600' },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/ui/__tests__/ConfirmDialog.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/ConfirmDialog.tsx src/ui/__tests__/ConfirmDialog.test.tsx
git commit -m "feat(ui): add reusable ConfirmDialog"
```

---

## Task 11: `StatusFilterChips`

**Files:**
- Create: `src/features/counting/StatusFilterChips.tsx`
- Test: `src/features/counting/__tests__/StatusFilterChips.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/features/counting/__tests__/StatusFilterChips.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { initI18n, setLocale } from '../../../platform/i18n';
import { StatusFilterChips } from '../StatusFilterChips';

describe('StatusFilterChips', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
    await setLocale('en');
  });

  it('renders all three status chips', () => {
    render(<StatusFilterChips value="draft" onChange={() => {}} />);
    expect(screen.getByText('Draft')).toBeOnTheScreen();
    expect(screen.getByText('Committed')).toBeOnTheScreen();
    expect(screen.getByText('Void')).toBeOnTheScreen();
  });

  it('calls onChange with the chosen status', () => {
    const onChange = jest.fn();
    render(<StatusFilterChips value="draft" onChange={onChange} />);
    fireEvent.press(screen.getByText('Committed'));
    expect(onChange).toHaveBeenCalledWith('committed');
  });

  it('marks the active chip as selected', () => {
    render(<StatusFilterChips value="void" onChange={() => {}} />);
    expect(screen.getByLabelText('Void').props.accessibilityState).toEqual({ selected: true });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/features/counting/__tests__/StatusFilterChips.test.tsx`
Expected: FAIL — `Cannot find module '../StatusFilterChips'`.

- [ ] **Step 3: Write the implementation**

`src/features/counting/StatusFilterChips.tsx`:
```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../../platform/i18n';
import type { CountingDocument } from '../../data/api/carmenApi';

type Status = CountingDocument['status'];
const ORDER: Status[] = ['draft', 'committed', 'void'];

interface Props {
  value: Status;
  onChange: (status: Status) => void;
}

export function StatusFilterChips({ value, onChange }: Props) {
  const t = useT();
  return (
    <View style={styles.row}>
      {ORDER.map((status) => {
        const active = status === value;
        const label = t(`documents.status.${status}`);
        return (
          <Pressable
            key={status}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(status)}
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

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/features/counting/__tests__/StatusFilterChips.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/counting/StatusFilterChips.tsx src/features/counting/__tests__/StatusFilterChips.test.tsx
git commit -m "feat(counting): add StatusFilterChips"
```

---

## Task 12: `CountingDocumentListItem`

**Files:**
- Create: `src/features/counting/CountingDocumentListItem.tsx`
- Test: `src/features/counting/__tests__/CountingDocumentListItem.test.tsx`

Row shows running number (or "Pending"), status label, location, count date (raw `YYYY-MM-DD`), counted total, and a void trash button **only** when the document is a draft and `onVoid` is provided. (The view/eye → detail button is added in Slice 3.)

- [ ] **Step 1: Write the failing test**

`src/features/counting/__tests__/CountingDocumentListItem.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { initI18n, setLocale } from '../../../platform/i18n';
import { CountingDocumentListItem } from '../CountingDocumentListItem';
import type { CountingDocument } from '../../../data/api/carmenApi';

const base: CountingDocument = {
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

describe('CountingDocumentListItem', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
    await setLocale('en');
  });

  it('shows "Pending" + a void button for a draft without a running number', () => {
    const onVoid = jest.fn();
    render(<CountingDocumentListItem document={base} countedTotal={3} onVoid={onVoid} />);
    expect(screen.getByText('Pending')).toBeOnTheScreen();
    expect(screen.getByText('Building A Floor 1')).toBeOnTheScreen();
    expect(screen.getByText('2026-05-26')).toBeOnTheScreen();
    expect(screen.getByText('Draft')).toBeOnTheScreen();
    expect(screen.getByText('3')).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('Void'));
    expect(onVoid).toHaveBeenCalledWith(base);
  });

  it('shows the running number and no void button for a committed document', () => {
    const committed: CountingDocument = { ...base, status: 'committed', runningNumber: 'CD26050001' };
    render(<CountingDocumentListItem document={committed} countedTotal={0} />);
    expect(screen.getByText('CD26050001')).toBeOnTheScreen();
    expect(screen.getByText('Committed')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Void')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/features/counting/__tests__/CountingDocumentListItem.test.tsx`
Expected: FAIL — `Cannot find module '../CountingDocumentListItem'`.

- [ ] **Step 3: Write the implementation**

`src/features/counting/CountingDocumentListItem.tsx`:
```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../../platform/i18n';
import type { CountingDocument } from '../../data/api/carmenApi';

interface Props {
  document: CountingDocument;
  countedTotal: number;
  /** When provided (drafts only), renders a void/trash action. */
  onVoid?: (doc: CountingDocument) => void;
}

const STATUS_STYLE: Record<CountingDocument['status'], object> = {
  draft: { backgroundColor: '#e5e7eb', color: '#475569' },
  committed: { backgroundColor: '#dcfce7', color: '#166534' },
  void: { backgroundColor: '#fee2e2', color: '#991b1b' },
};

export function CountingDocumentListItem({ document, countedTotal, onVoid }: Props) {
  const t = useT();
  const status = document.status;
  const badge = STATUS_STYLE[status] as { backgroundColor: string; color: string };
  return (
    <View style={styles.row}>
      <View style={styles.main}>
        <View style={styles.headRow}>
          <Text style={styles.running}>{document.runningNumber ?? t('documents.pending')}</Text>
          <View style={[styles.badge, { backgroundColor: badge.backgroundColor }]}>
            <Text style={[styles.badgeText, { color: badge.color }]}>
              {t(`documents.status.${status}`)}
            </Text>
          </View>
        </View>
        <Text style={styles.location}>{document.locationName}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{document.countDate}</Text>
          <Text style={styles.meta}>
            {t('documents.counted')}: {countedTotal}
          </Text>
        </View>
      </View>
      {onVoid && status === 'draft' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('documents.void.action')}
          style={styles.voidBtn}
          onPress={() => onVoid(document)}
        >
          <Text style={styles.voidIcon}>🗑</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  main: { flex: 1, gap: 2 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  running: { fontFamily: 'monospace', fontSize: 14, color: '#0f172a', fontWeight: '600' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  location: { fontSize: 15, color: '#0f172a' },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 2 },
  meta: { fontSize: 12, color: '#64748b' },
  voidBtn: { paddingHorizontal: 8, paddingVertical: 8, marginLeft: 8 },
  voidIcon: { fontSize: 18 },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/features/counting/__tests__/CountingDocumentListItem.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/counting/CountingDocumentListItem.tsx src/features/counting/__tests__/CountingDocumentListItem.test.tsx
git commit -m "feat(counting): add CountingDocumentListItem row"
```

---

## Task 13: Home actions screen

**Files:**
- Modify: `app/(tabs)/index.tsx`
- Test: `app/(tabs)/__tests__/tabs.test.tsx`

Surface the three customer actions (decision 3) plus keep Browse assets as a secondary link so the Plan-2 assets list stays reachable.

- [ ] **Step 1: Update the failing test** — replace the body of `app/(tabs)/__tests__/tabs.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react-native';
import { initI18n, setLocale } from '../../../src/platform/i18n';
import HomeScreen from '../index';

describe('Home tab', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
    await setLocale('en');
  });

  it('renders the localized title', () => {
    render(<HomeScreen />);
    expect(screen.getByText('Asset Checker')).toBeOnTheScreen();
  });

  it('renders the three counting actions', () => {
    render(<HomeScreen />);
    expect(screen.getByText('Scan QR Code')).toBeOnTheScreen();
    expect(screen.getByText('Create New Counting Document')).toBeOnTheScreen();
    expect(screen.getByText('View All Counting Documents')).toBeOnTheScreen();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest app/(tabs)/__tests__/tabs.test.tsx`
Expected: FAIL — "Create New Counting Document" not found (current Home only has Browse assets).

- [ ] **Step 3: Rewrite the Home screen** — replace the full contents of `app/(tabs)/index.tsx` with:

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
          onPress={() => router.push('/scan')}
        >
          <Text style={styles.primaryText}>{t('home.scanQr')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={styles.primary}
          onPress={() => router.push('/documents/new')}
        >
          <Text style={styles.primaryText}>{t('home.newDocument')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={styles.primary}
          onPress={() => router.push('/documents')}
        >
          <Text style={styles.primaryText}>{t('home.viewDocuments')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={styles.secondary}
          onPress={() => router.push('/assets')}
        >
          <Text style={styles.secondaryText}>{t('home.browseAssets')}</Text>
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
  secondary: {
    backgroundColor: '#fff',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  secondaryText: { color: '#2563eb', fontSize: 15, fontWeight: '600' },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest app/(tabs)/__tests__/tabs.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/(tabs)/index.tsx app/(tabs)/__tests__/tabs.test.tsx
git commit -m "feat(home): surface the three counting actions"
```

---

## Task 14: Location-pick create screen + route registration

**Files:**
- Create: `app/documents/new.tsx`
- Modify: `app/_layout.tsx` (register the modal route)

Glue screen — verified by typecheck + the manual QA in Task 16 (the hooks/components it composes are already unit-tested). After create it routes to the View-All list (the detail screen is Slice 3).

- [ ] **Step 1: Create the screen**

`app/documents/new.tsx`:
```tsx
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useT } from '../../src/platform/i18n';
import { useLocations } from '../../src/features/counting/useLocations';
import { useCreateCountingDocument } from '../../src/features/counting/useCreateCountingDocument';

export default function NewCountingDocumentScreen() {
  const t = useT();
  const router = useRouter();
  const { data: locations, isLoading } = useLocations();
  const create = useCreateCountingDocument();

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: t('documents.new.title') }} />
      <Text style={styles.subtitle}>{t('documents.new.subtitle')}</Text>
      {create.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={locations ?? []}
          keyExtractor={(l) => l.id}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              style={styles.row}
              onPress={() => {
                create.mutate(item, { onSuccess: () => router.replace('/documents') });
              }}
            >
              <Text style={styles.rowText}>{item.name}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.empty}>
                {isLoading ? t('documents.loading') : t('documents.new.empty')}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  subtitle: { fontSize: 14, color: '#64748b', padding: 16, paddingBottom: 8 },
  row: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  rowText: { fontSize: 16, color: '#0f172a' },
  center: { padding: 32, alignItems: 'center' },
  empty: { color: '#94a3b8' },
});
```

- [ ] **Step 2: Register the modal route** — in `app/_layout.tsx`, inside the `RouteGate` `<Stack>` element, add this screen alongside the others (e.g., after the `sync` modal line):

```tsx
        <Stack.Screen name="documents/new" options={{ presentation: 'modal' }} />
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/documents/new.tsx app/_layout.tsx
git commit -m "feat(documents): add location-pick create modal"
```

---

## Task 15: View-All documents list screen

**Files:**
- Modify: `app/(tabs)/documents.tsx`

Glue screen — verified by typecheck + Task 16 manual QA.

- [ ] **Step 1: Rewrite the documents tab** — replace the full contents of `app/(tabs)/documents.tsx` with:

```tsx
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useT } from '../../src/platform/i18n';
import { Header } from '../../src/ui/Header';
import { StatusFilterChips } from '../../src/features/counting/StatusFilterChips';
import { CountingDocumentListItem } from '../../src/features/counting/CountingDocumentListItem';
import { useCountingDocuments } from '../../src/features/counting/useCountingDocuments';
import { useVoidCountingDocument } from '../../src/features/counting/useVoidCountingDocument';
import { ConfirmDialog } from '../../src/ui/ConfirmDialog';
import type { CountingDocument } from '../../src/data/api/carmenApi';

export default function DocumentsScreen() {
  const t = useT();
  const [status, setStatus] = useState<CountingDocument['status']>('draft');
  const { data, isLoading } = useCountingDocuments(status);
  const voidDoc = useVoidCountingDocument();
  const [pendingVoid, setPendingVoid] = useState<CountingDocument | null>(null);

  return (
    <SafeAreaView style={styles.container}>
      <Header title={t('documents.title')} />
      <StatusFilterChips value={status} onChange={setStatus} />
      <FlatList
        data={data ?? []}
        keyExtractor={(e) => e.document.id}
        renderItem={({ item }) => (
          <CountingDocumentListItem
            document={item.document}
            countedTotal={item.countedTotal}
            onVoid={item.document.status === 'draft' ? setPendingVoid : undefined}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {isLoading ? t('documents.loading') : t('documents.empty')}
            </Text>
          </View>
        }
      />
      <ConfirmDialog
        visible={pendingVoid !== null}
        title={t('documents.void.title')}
        message={t('documents.void.message')}
        confirmLabel={t('documents.void.confirm')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => {
          if (pendingVoid) voidDoc.mutate(pendingVoid);
          setPendingVoid(null);
        }}
        onCancel={() => setPendingVoid(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { color: '#94a3b8' },
});
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/documents.tsx
git commit -m "feat(documents): build View-All list with status chips + void"
```

---

## Task 16: Slice verification (full suite, lint, format, manual QA)

**Files:** none (verification + final commit if formatting changes).

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors. (If autofixable: `npm run lint:fix`, then re-run.)

- [ ] **Step 3: Format check**

Run: `npm run format:check`
Expected: pass. (If it reports files: `npm run format`, then commit the formatting.)

- [ ] **Step 4: Full test suite**

Run: `npm test`
Expected: all suites PASS, including the prior Plan 1/2 + Slice 1 tests (proves the `_layout` queue refactor caused no regression).

- [ ] **Step 5: Manual QA (mock backend)**

Run: `npm start` then press `i` (or `a`). Sign in, then verify:
1. **Home** shows three actions — *Scan QR Code*, *Create New Counting Document*, *View All Counting Documents* — plus *Browse assets*.
2. Tap **Create New Counting Document** → location list appears (Building A Floor 1/2, Warehouse A) → tap one → you land on the **Documents** list with a new row: running number shows **Pending**, status badge **Draft**, the chosen location, today's date, and *Counted: 0*.
3. After ~1–2s (mock latency) pull is not needed — the sync worker drains the queued `document.upsert`; reopen the list (toggle a chip and back) and confirm the running number becomes **CD2605xxxx** (server-assigned, reconciled by the Slice 1 reconciler). Open the **/sync** modal to confirm the queued count returned to 0.
4. Toggle chips **Draft / Committed / Void** — Draft is selected by default; only matching documents show.
5. On a **Draft** row, tap the **🗑 (Void)** button → confirm dialog *"Void this document?"* → tap **Void** → the row leaves the Draft list and appears under the **Void** chip. Tap the trash then **Cancel** on another draft → nothing changes.
6. Tap **View All Counting Documents** from Home → same list.

- [ ] **Step 6: Final commit (only if Steps 2–3 changed files)**

```bash
git add -A
git commit -m "chore(counting): lint/format pass for Slice 2"
```

---

## Self-Review (run by the plan author)

**1. Spec coverage (Slice 2 scope = §12.2 "Create + View-All: Home actions, location-pick create, document list with status chips + void"):**
- Home actions (Scan / Create / View All) — Task 13 (+ §1, decision 3). ✓
- Location-pick create draft — Tasks 2, 8, 14. ✓
- Document list with status chips (Draft default — decision 4) — Tasks 7, 11, 15. ✓
- Void from draft (= `upsert` with `status:'void'`, trash only on drafts — spec §4) — Tasks 9, 10, 12, 15. ✓
- Running number shows "pending" until sync (§3.2) — Task 12 renders `runningNumber ?? "Pending"`; Task 16 QA confirms the Slice 1 reconciler fills it. ✓
- Writes flow through `mutationQueue` (§5) — Task 4 shared queue + Tasks 8/9 enqueue `document.upsert`. ✓
- i18n en+th for every new label/chip/button/popup (§10) — Task 5. ✓
- Row "total assets counted" (§6) — Task 3 repo method + Task 7 wiring + Task 12 render. ✓

**Deliberately deferred (documented, not gaps):**
- Row **view (eye) → detail** + the `/documents/[id]` screen → **Slice 3** (§12.3). Slice 2 create routes to the list instead of detail.
- Intl/**Buddhist-calendar** date formatting (§10) is cross-cutting and unassigned to a numbered slice; Slice 2 shows raw `YYYY-MM-DD`. To add later: a `platform/formatDate` helper used by both this row and the asset dates.
- Count date / description **editing** and **Commit** live on the detail screen → Slices 3/6 (§7). Not in "Create + View-All".
- Pulling **other users'** server documents into the list is not in Slice 2 (the list is local-SQLite; documents are created on-device and synced up). Matches §5 "reads come from SQLite."

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N". Every code step shows complete code. ✓

**3. Type consistency:**
- `CountingDocument` / `CountEntry` / `Location` / `Session` types match `src/data/api/carmenApi.ts` and `src/data/repos/types.ts` (verified against the files). ✓
- `countedTotalsByDocument(documentIds: string[]): Promise<Record<string, number>>` — same signature in the interface (Task 3), the hook (Task 7), and the test (Task 3). ✓
- `useMutationQueue()` / `MutationQueueProvider` names identical across context (Task 4), harness (Task 6), and hooks (Tasks 8–9). ✓
- `CountingDocumentListEntry { document, countedTotal }` — shape identical in the hook (Task 7) and the list screen `keyExtractor`/`renderItem` (Task 15). ✓
- `ConfirmDialog` prop names (`visible/title/message/confirmLabel/cancelLabel/destructive/onConfirm/onCancel`) identical in component (Task 10), its test (Task 10), and the documents screen (Task 15). ✓
- `StatusFilterChips { value, onChange }` and `CountingDocumentListItem { document, countedTotal, onVoid }` identical across component, test, and screen. ✓
- i18n keys used in components (`documents.status.*`, `documents.pending`, `documents.counted`, `documents.void.*`, `documents.new.*`, `documents.title/empty/loading`) all defined in Task 5. ✓
