# Counting Documents — Slice 4: Asset Information — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From a counting-document detail row, open an Asset Information screen to record per-count observations (Location, Serial No, Specification, Remark, Comment) and the Counted Qty, buffer edits, guard against accidental discard, and persist via **Save Asset Count** (writes the count entry + enqueues `entry.upsert`, stamps `transferDate`). An entry whose observed Location differs from the document's location drops out of the detail list.

**Architecture:** New nested route `/documents/[id]/assets/[assetId]` (routed by assetId — list rows are asset-centric and an asset may have no entry yet). A self-contained `CountEntryForm` (in `features/`, owning buffered state + an inline discard-confirm Modal, since `features/` may not import `ui/`) composes a `LocationSelect` dropdown, text inputs, and the existing `QtyStepper`. New hooks `useCountEntryForAsset` (load) and `useSaveCountEntry` (persist + queue). `useAssetCountList` gains the location-override hide rule. The Slice-3 detail screen moves to `app/documents/[id]/index.tsx` and gains a per-row view button.

**Tech Stack:** Expo Router (nested dynamic routes, `useLocalSearchParams`), React 19, `@tanstack/react-query` v5, `expo-sqlite` via `SqlExecutor`, `react-i18next`. Tests: Jest (`jest-expo`) + `@testing-library/react-native` + `better-sqlite3` in-memory via `testDb.ts` + the `renderCountingHook.tsx` harness.

**Spec:** `docs/superpowers/specs/2026-05-26-counting-documents-design.md` — §8 (Asset Information behavior), §3.1/§3.3 (observation fields), §12.4 (build sequence).

---

## Locked scope decisions (from brainstorming)

- **Full §8 Location:** editable Location dropdown recorded as the entry's `location` observation, AND `useAssetCountList` excludes assets whose entry `location` differs from the document's location.
- **Discard guard:** an in-screen Back button checks dirty state → discard confirm. The OS swipe/hardware back is NOT intercepted (out of scope this slice).

## Deferred to later slices (state, don't build)

- **Take Photo** → **Slice 6** (Photos). The §8 layout's Take-Photo control is omitted this slice; no placeholder.
- **Repeat-scan accumulation** ("rescanning increments on top") → **Slice 5** (Scan). Slice 4's stepper sets the qty directly; a new entry defaults the editable Counted Qty to **1** (§8).
- **Asset image** (§8 lists it first) — seed assets have `imageUrl: null`; render the image only when present, no placeholder UI work.
- **Buddhist-calendar date formatting** (§10) — dates render as raw `YYYY-MM-DD`, consistent with Slices 2–3.

---

## File Structure

**New files**
- `src/features/counting/useCountEntryForAsset.ts` + test — load the existing entry for `(documentId, assetId)` (or null).
- `src/features/counting/useSaveCountEntry.ts` + test — persist the full entry (observations + qty + `transferDate`) and enqueue `entry.upsert`.
- `src/features/counting/LocationSelect.tsx` + test — controlled location dropdown (modal list).
- `src/features/counting/CountEntryForm.tsx` + test — the §8 form: read-only asset info, editable observation fields, `QtyStepper`, Save, Back + inline discard-confirm.
- `app/documents/[id]/assets/[assetId].tsx` — the Asset Information screen (glue).

**Moved file**
- `app/documents/[id].tsx` → `app/documents/[id]/index.tsx` (so `[id]` can be a directory for the nested entry route). Import paths change from `../../src/…` to `../../../src/…`; gains a per-row view-button wiring.

**Modified files**
- `src/features/counting/useAssetCountList.ts` — add `locationName` arg + the location-override hide rule.
- `src/features/counting/__tests__/useAssetCountList.test.tsx` — update calls + add a hide-rule test.
- `src/features/counting/AssetCountListItem.tsx` — add optional `onView` + a view button.
- `src/features/counting/__tests__/AssetCountListItem.test.tsx` — cover the view button.
- `src/platform/i18n/locales/en.json` + `th.json` — add `documents.entry.*` keys.
- `src/platform/i18n/__tests__/i18n.test.ts` — assert a new key.
- `app/_layout.tsx` — update the detail route name + register the entry route.

No DB migration (all tables exist).

---

## Task 1: i18n keys for the Asset Information screen

**Files:** Modify `src/platform/i18n/locales/en.json`, `th.json`, `src/platform/i18n/__tests__/i18n.test.ts`.

- [ ] **Step 1: Failing test** — add an `it` inside the existing `describe` in `src/platform/i18n/__tests__/i18n.test.ts` (match its existing `t`/`en`-locale setup):
```ts
  it('resolves the asset-information entry keys', () => {
    expect(t('documents.entry.save')).toBe('Save Asset Count');
    expect(t('documents.entry.discard')).toBe('Discard');
    expect(t('documents.entry.serialNo')).toBe('Serial No');
  });
```

- [ ] **Step 2: Run** `npx jest src/platform/i18n/__tests__/i18n.test.ts` — confirm FAIL (raw keys).

- [ ] **Step 3:** Add this `"entry"` object INSIDE the existing `"documents": { … }` object in `src/platform/i18n/locales/en.json` (e.g. after the `"detail": { … }` block — add a comma after it):
```json
    "entry": {
      "save": "Save Asset Count",
      "back": "Back",
      "location": "Location",
      "selectLocation": "Select location",
      "transferDate": "Transfer Date",
      "serialNo": "Serial No",
      "specification": "Specification",
      "remark": "Remark",
      "comment": "Comment",
      "discardTitle": "Discard changes?",
      "discardMessage": "Your edits to this count will be lost.",
      "discard": "Discard"
    }
```

- [ ] **Step 4:** Add the matching block INSIDE `"documents"` in `src/platform/i18n/locales/th.json`:
```json
    "entry": {
      "save": "บันทึกการตรวจนับ",
      "back": "กลับ",
      "location": "สถานที่",
      "selectLocation": "เลือกสถานที่",
      "transferDate": "วันที่โอนย้าย",
      "serialNo": "หมายเลขเครื่อง",
      "specification": "รายละเอียด",
      "remark": "หมายเหตุ",
      "comment": "ความคิดเห็น",
      "discardTitle": "ยกเลิกการแก้ไข?",
      "discardMessage": "การแก้ไขการตรวจนับนี้จะหายไป",
      "discard": "ยกเลิกการแก้ไข"
    }
```

- [ ] **Step 5: Run** `npx jest src/platform/i18n/__tests__/i18n.test.ts` — confirm PASS.
- [ ] **Step 6: Run** `npx tsc --noEmit` — confirm clean (catches malformed JSON).
- [ ] **Step 7: Commit**
```bash
git add src/platform/i18n/locales/en.json src/platform/i18n/locales/th.json src/platform/i18n/__tests__/i18n.test.ts
git commit -m "feat(i18n): add Asset Information entry keys"
```

---

## Task 2: `useCountEntryForAsset` hook

**Files:** Create `src/features/counting/useCountEntryForAsset.ts`; Test `src/features/counting/__tests__/useCountEntryForAsset.test.tsx`.

- [ ] **Step 1: Failing test** `src/features/counting/__tests__/useCountEntryForAsset.test.tsx`:
```tsx
import { renderHook, waitFor } from '@testing-library/react-native';
import { makeMigratedTestDb, type TestDb } from '../../../data/db/__tests__/testDb';
import { createCountEntryRepo } from '../../../data/repos/countEntryRepo';
import { makeWrapper } from './renderCountingHook';
import { useCountEntryForAsset } from '../useCountEntryForAsset';
import type { CountEntry } from '../../../data/api/carmenApi';

const entry: CountEntry = {
  id: 'e1',
  documentId: 'd1',
  assetId: 'a1',
  unknownCode: null,
  countQty: 4,
  location: null,
  observedSerialNo: 'SN-1',
  observedSpecification: null,
  observedRemark: null,
  comment: 'hi',
  photoIds: [],
  transferDate: null,
  scannedAt: '2026-05-26T08:00:00Z',
  updatedAt: '2026-05-26T08:00:00Z',
};

describe('useCountEntryForAsset', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
    await createCountEntryRepo(db).upsert(entry);
  });
  afterEach(() => db.close());

  it('loads an existing entry', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useCountEntryForAsset('d1', 'a1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ id: 'e1', countQty: 4, observedSerialNo: 'SN-1' });
  });

  it('returns null when no entry exists', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useCountEntryForAsset('d1', 'zzz'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});
```

- [ ] **Step 2: Run** the test — confirm FAIL (cannot find module).

- [ ] **Step 3: Implement** `src/features/counting/useCountEntryForAsset.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { useDb } from '../../data/db/dbContext';
import { createCountEntryRepo } from '../../data/repos/countEntryRepo';

export function useCountEntryForAsset(documentId: string, assetId: string) {
  const db = useDb();
  return useQuery({
    queryKey: ['countEntry', documentId, assetId],
    queryFn: () => createCountEntryRepo(db).findByDocumentAndAsset(documentId, assetId),
    enabled: !!documentId && !!assetId,
  });
}
```

- [ ] **Step 4: Run** the test — confirm PASS (2 tests).
- [ ] **Step 5: Commit**
```bash
git add src/features/counting/useCountEntryForAsset.ts src/features/counting/__tests__/useCountEntryForAsset.test.tsx
git commit -m "feat(counting): add useCountEntryForAsset hook"
```

---

## Task 3: `useSaveCountEntry` mutation hook

**Files:** Create `src/features/counting/useSaveCountEntry.ts`; Test `src/features/counting/__tests__/useSaveCountEntry.test.tsx`.

- [ ] **Step 1: Failing test** `src/features/counting/__tests__/useSaveCountEntry.test.tsx`:
```tsx
import { renderHook, act } from '@testing-library/react-native';
import { makeMigratedTestDb, type TestDb } from '../../../data/db/__tests__/testDb';
import { createCountEntryRepo } from '../../../data/repos/countEntryRepo';
import { createPendingMutationRepo } from '../../../data/repos/pendingMutationRepo';
import { makeWrapper } from './renderCountingHook';
import { useSaveCountEntry } from '../useSaveCountEntry';
import type { CountEntry } from '../../../data/api/carmenApi';

describe('useSaveCountEntry', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
  });
  afterEach(() => db.close());

  it('persists observations + qty, stamps transferDate, enqueues entry.upsert', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useSaveCountEntry('d1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        assetId: 'a1',
        countQty: 3,
        location: 'Warehouse A',
        observedSerialNo: 'SN-9',
        observedSpecification: 'spec',
        observedRemark: 'looks fine',
        comment: 'ok',
      });
    });

    const saved = await createCountEntryRepo(db).findByDocumentAndAsset('d1', 'a1');
    expect(saved).toMatchObject({
      countQty: 3,
      location: 'Warehouse A',
      observedSerialNo: 'SN-9',
      observedSpecification: 'spec',
      observedRemark: 'looks fine',
      comment: 'ok',
    });
    expect(saved?.transferDate).not.toBeNull();

    const pending = await createPendingMutationRepo(db).listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].kind).toBe('entry.upsert');
    const payload = pending[0].payload as { documentId: string; entries: CountEntry[] };
    expect(payload.documentId).toBe('d1');
    expect(payload.entries[0].assetId).toBe('a1');
    expect(payload.entries[0].location).toBe('Warehouse A');
  });

  it('reuses the existing entry row (no duplicate) on re-save', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useSaveCountEntry('d1'), { wrapper });
    const input = {
      assetId: 'a1',
      countQty: 1,
      location: 'L',
      observedSerialNo: '',
      observedSpecification: '',
      observedRemark: '',
      comment: '',
    };
    await act(async () => {
      await result.current.mutateAsync(input);
    });
    await act(async () => {
      await result.current.mutateAsync({ ...input, countQty: 5 });
    });
    expect(await createCountEntryRepo(db).listByDocument('d1')).toHaveLength(1);
    expect((await createCountEntryRepo(db).findByDocumentAndAsset('d1', 'a1'))?.countQty).toBe(5);
  });
});
```

- [ ] **Step 2: Run** the test — confirm FAIL (cannot find module).

- [ ] **Step 3: Implement** `src/features/counting/useSaveCountEntry.ts`:
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDb } from '../../data/db/dbContext';
import { useMutationQueue } from '../../data/sync/mutationQueueContext';
import { createCountEntryRepo } from '../../data/repos/countEntryRepo';
import { uuid } from '../../platform/id';
import type { CountEntry } from '../../data/api/carmenApi';

export interface SaveCountEntryInput {
  assetId: string;
  countQty: number;
  location: string;
  observedSerialNo: string;
  observedSpecification: string;
  observedRemark: string;
  comment: string;
}

export function useSaveCountEntry(documentId: string) {
  const db = useDb();
  const queue = useMutationQueue();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveCountEntryInput): Promise<void> => {
      const repo = createCountEntryRepo(db);
      const existing = await repo.findByDocumentAndAsset(documentId, input.assetId);
      const now = new Date().toISOString();
      const entry: CountEntry = {
        id: existing?.id ?? uuid(),
        documentId,
        assetId: input.assetId,
        unknownCode: null,
        countQty: input.countQty,
        location: input.location || null,
        observedSerialNo: input.observedSerialNo || null,
        observedSpecification: input.observedSpecification || null,
        observedRemark: input.observedRemark || null,
        comment: input.comment,
        photoIds: existing?.photoIds ?? [],
        transferDate: now,
        scannedAt: existing?.scannedAt ?? now,
        updatedAt: now,
      };
      await repo.upsert(entry);
      await queue.enqueue('entry.upsert', { documentId, entries: [entry] });
    },
    onSuccess: (_data, input) => {
      void qc.invalidateQueries({ queryKey: ['assetCountList', documentId] });
      void qc.invalidateQueries({ queryKey: ['countEntry', documentId, input.assetId] });
      void qc.invalidateQueries({ queryKey: ['countingDocuments'] });
    },
  });
}
```

- [ ] **Step 4: Run** the test — confirm PASS (2 tests).
- [ ] **Step 5: Run** `npx tsc --noEmit` — confirm clean.
- [ ] **Step 6: Commit**
```bash
git add src/features/counting/useSaveCountEntry.ts src/features/counting/__tests__/useSaveCountEntry.test.tsx
git commit -m "feat(counting): add useSaveCountEntry mutation hook"
```

---

## Task 4: `useAssetCountList` location-override hide rule

**Files:** Modify `src/features/counting/useAssetCountList.ts`; `src/features/counting/__tests__/useAssetCountList.test.tsx`.

The hook gains a `locationName` argument. An asset is excluded when it has an entry whose `location` is set and differs from the document's `locationName` (it was observed elsewhere — §8).

- [ ] **Step 1: Update the test** `src/features/counting/__tests__/useAssetCountList.test.tsx`. The existing test calls `useAssetCountList('d1', 'loc1')` — it must now pass the location name (the seeded assets use `locationName: 'L'`). Update that call to `useAssetCountList('d1', 'loc1', 'L')`. Then add this new test inside the `describe`:
```ts
  it('excludes an asset whose entry location differs from the document location', async () => {
    await createCountEntryRepo(db).upsert({
      id: 'e2',
      documentId: 'd1',
      assetId: 'a2',
      unknownCode: null,
      countQty: 1,
      location: 'Somewhere Else',
      observedSerialNo: null,
      observedSpecification: null,
      observedRemark: null,
      comment: '',
      photoIds: [],
      transferDate: null,
      scannedAt: '2026-05-26T08:05:00Z',
      updatedAt: '2026-05-26T08:05:00Z',
    });
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useAssetCountList('d1', 'loc1', 'L'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // a1 stays (entry location null); a2 is hidden (observed at 'Somewhere Else')
    expect(result.current.data?.map((r) => r.asset.id)).toEqual(['a1']);
  });
```
(`createCountEntryRepo` is already imported in this test file.)

- [ ] **Step 2: Run** `npx jest src/features/counting/__tests__/useAssetCountList.test.tsx` — the updated existing test compiles (3-arg call) but the new test FAILS (a2 still present, since the hook ignores `locationName`). Also TypeScript will flag the 3rd arg until Step 3.

- [ ] **Step 3: Implement** — replace the body of `src/features/counting/useAssetCountList.ts` with:
```ts
import { useQuery } from '@tanstack/react-query';
import { useDb } from '../../data/db/dbContext';
import { createAssetRepo } from '../../data/repos/assetRepo';
import { createCountEntryRepo } from '../../data/repos/countEntryRepo';
import type { AssetCountRow } from './filterSortAssetCounts';

export function useAssetCountList(documentId: string, locationId: string, locationName: string) {
  const db = useDb();
  return useQuery({
    queryKey: ['assetCountList', documentId],
    queryFn: async (): Promise<AssetCountRow[]> => {
      const assets = await createAssetRepo(db).listByLocation(locationId);
      const entries = await createCountEntryRepo(db).listByDocument(documentId);
      const entryByAsset = new Map<string, { countQty: number; location: string | null }>();
      for (const e of entries) {
        if (e.assetId) entryByAsset.set(e.assetId, { countQty: e.countQty, location: e.location });
      }
      return assets
        .filter((asset) => {
          const e = entryByAsset.get(asset.id);
          // Hidden when observed at a different location (§8 location override).
          return !(e && e.location && e.location !== locationName);
        })
        .map((asset) => ({ asset, countedQty: entryByAsset.get(asset.id)?.countQty ?? 0 }));
    },
    enabled: !!documentId && !!locationId,
  });
}
```

- [ ] **Step 4: Run** the test — confirm PASS (2 tests: original + hide-rule).
- [ ] **Step 5: Commit**
```bash
git add src/features/counting/useAssetCountList.ts src/features/counting/__tests__/useAssetCountList.test.tsx
git commit -m "feat(counting): hide assets observed at a different location"
```

---

## Task 5: `LocationSelect` component

**Files:** Create `src/features/counting/LocationSelect.tsx`; Test `src/features/counting/__tests__/LocationSelect.test.tsx`.

A controlled dropdown: shows the current value (or a placeholder), opens a modal list of locations on press, and reports the chosen location's **name** via `onChange`.

- [ ] **Step 1: Failing test** `src/features/counting/__tests__/LocationSelect.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { initI18n, setLocale } from '../../../platform/i18n';
import { LocationSelect } from '../LocationSelect';
import type { Location } from '../../../data/repos/types';

const locations: Location[] = [
  { id: 'loc1', name: 'Building A Floor 1', updatedAt: '2026-05-22T10:00:00Z' },
  { id: 'wh-a', name: 'Warehouse A', updatedAt: '2026-05-22T10:00:00Z' },
];

describe('LocationSelect', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
    await setLocale('en');
  });

  it('shows the current value and reports a new selection', () => {
    const onChange = jest.fn();
    render(<LocationSelect value="Building A Floor 1" options={locations} onChange={onChange} />);
    // current value visible on the trigger
    expect(screen.getByText('Building A Floor 1')).toBeOnTheScreen();
    // open the list and pick another
    fireEvent.press(screen.getByLabelText('Location'));
    fireEvent.press(screen.getByText('Warehouse A'));
    expect(onChange).toHaveBeenCalledWith('Warehouse A');
  });

  it('does not open when disabled', () => {
    const onChange = jest.fn();
    render(<LocationSelect value="Building A Floor 1" options={locations} onChange={onChange} disabled />);
    fireEvent.press(screen.getByLabelText('Location'));
    expect(screen.queryByText('Warehouse A')).toBeNull();
  });
});
```

- [ ] **Step 2: Run** the test — confirm FAIL (cannot find module).

- [ ] **Step 3: Implement** `src/features/counting/LocationSelect.tsx`:
```tsx
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../../platform/i18n';
import type { Location } from '../../data/repos/types';

interface Props {
  value: string;
  options: Location[];
  onChange: (name: string) => void;
  disabled?: boolean;
}

export function LocationSelect({ value, options, onChange, disabled }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('documents.entry.location')}
        disabled={disabled}
        style={[styles.trigger, disabled && styles.triggerDisabled]}
        onPress={() => setOpen(true)}
      >
        <Text style={styles.value}>{value || t('documents.entry.selectLocation')}</Text>
      </Pressable>
      {open ? (
        <Modal transparent animationType="fade" visible onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <View style={styles.sheet}>
              {options.map((loc) => (
                <Pressable
                  key={loc.id}
                  accessibilityRole="button"
                  style={styles.option}
                  onPress={() => {
                    onChange(loc.name);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.optionText}>{loc.name}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  triggerDisabled: { backgroundColor: '#f1f5f9' },
  value: { fontSize: 15, color: '#0f172a' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 8 },
  option: { paddingVertical: 14, paddingHorizontal: 16 },
  optionText: { fontSize: 16, color: '#0f172a' },
});
```

- [ ] **Step 4: Run** the test — confirm PASS (2 tests).
- [ ] **Step 5: Commit**
```bash
git add src/features/counting/LocationSelect.tsx src/features/counting/__tests__/LocationSelect.test.tsx
git commit -m "feat(counting): add LocationSelect dropdown"
```

---

## Task 6: `CountEntryForm` component

**Files:** Create `src/features/counting/CountEntryForm.tsx`; Test `src/features/counting/__tests__/CountEntryForm.test.tsx`.

The §8 form. Self-contained: owns buffered values, renders read-only asset info + editable fields (`LocationSelect`, text inputs) + `QtyStepper`, a Save button, a Back button, and an inline discard-confirm Modal (the form lives in `features/`, which may not import `ui/ConfirmDialog`). When `locked`, fields are read-only and Save is hidden.

- [ ] **Step 1: Failing test** `src/features/counting/__tests__/CountEntryForm.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { initI18n, setLocale } from '../../../platform/i18n';
import { CountEntryForm, type CountEntryFormValues } from '../CountEntryForm';
import type { Asset } from '../../../data/repos/types';
import type { Location } from '../../../data/repos/types';

const asset: Asset = {
  id: 'a1',
  code: 'AST001',
  name: 'Desktop Computer',
  category: 'IT Equipment',
  department: 'Finance',
  locationId: 'loc1',
  locationName: 'Building A Floor 1',
  quantity: 1,
  remainQty: 1,
  price: null,
  currency: null,
  totalAmount: null,
  inputDate: '2024-01-15',
  acquireDate: '2024-01-10',
  assetLife: '2y',
  remark: null,
  imageUrl: null,
  serialNo: 'SN-DC-1',
  specification: 'i5',
  updatedAt: '2026-05-22T10:00:00Z',
};
const locations: Location[] = [
  { id: 'loc1', name: 'Building A Floor 1', updatedAt: '2026-05-22T10:00:00Z' },
  { id: 'wh-a', name: 'Warehouse A', updatedAt: '2026-05-22T10:00:00Z' },
];
const initial: CountEntryFormValues = {
  countQty: 1,
  location: 'Building A Floor 1',
  observedSerialNo: 'SN-DC-1',
  observedSpecification: 'i5',
  observedRemark: '',
  comment: '',
};

function setup(over: Partial<React.ComponentProps<typeof CountEntryForm>> = {}) {
  const props = {
    asset,
    transferDate: null as string | null,
    initial,
    locations,
    locked: false,
    onSave: jest.fn(),
    onBack: jest.fn(),
    ...over,
  };
  render(<CountEntryForm {...props} />);
  return props;
}

describe('CountEntryForm', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
    await setLocale('en');
  });

  it('renders asset info and prefilled editable values', () => {
    setup();
    expect(screen.getByText('AST001')).toBeOnTheScreen();
    expect(screen.getByText('Desktop Computer')).toBeOnTheScreen();
    expect(screen.getByLabelText('Serial No').props.value).toBe('SN-DC-1');
    expect(screen.getByLabelText('counted quantity').props.value).toBe('1');
  });

  it('saves the edited values', () => {
    const props = setup();
    fireEvent.changeText(screen.getByLabelText('Comment'), 'all good');
    fireEvent.press(screen.getByLabelText('increment'));
    fireEvent.press(screen.getByText('Save Asset Count'));
    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ comment: 'all good', countQty: 2 }),
    );
  });

  it('goes back directly when there are no edits', () => {
    const props = setup();
    fireEvent.press(screen.getByText('Back'));
    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Discard changes?')).toBeNull();
  });

  it('shows a discard confirm when leaving with unsaved edits', () => {
    const props = setup();
    fireEvent.changeText(screen.getByLabelText('Comment'), 'dirty');
    fireEvent.press(screen.getByText('Back'));
    expect(props.onBack).not.toHaveBeenCalled();
    expect(screen.getByText('Discard changes?')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Discard'));
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  it('hides Save and disables editing when locked', () => {
    const props = setup({ locked: true });
    expect(screen.queryByText('Save Asset Count')).toBeNull();
    fireEvent.press(screen.getByLabelText('increment'));
    // qty stepper disabled → value unchanged on a later save path is irrelevant; just assert no Save button
    expect(props.onSave).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run** the test — confirm FAIL (cannot find module).

- [ ] **Step 3: Implement** `src/features/counting/CountEntryForm.tsx`:
```tsx
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useT } from '../../platform/i18n';
import { QtyStepper } from './QtyStepper';
import { LocationSelect } from './LocationSelect';
import type { Asset, Location } from '../../data/repos/types';

export interface CountEntryFormValues {
  countQty: number;
  location: string;
  observedSerialNo: string;
  observedSpecification: string;
  observedRemark: string;
  comment: string;
}

interface Props {
  asset: Asset;
  transferDate: string | null;
  initial: CountEntryFormValues;
  locations: Location[];
  locked?: boolean;
  onSave: (values: CountEntryFormValues) => void;
  onBack: () => void;
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export function CountEntryForm({
  asset,
  transferDate,
  initial,
  locations,
  locked,
  onSave,
  onBack,
}: Props) {
  const t = useT();
  const [values, setValues] = useState<CountEntryFormValues>(initial);
  const [showDiscard, setShowDiscard] = useState(false);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  const set = (patch: Partial<CountEntryFormValues>) => setValues((v) => ({ ...v, ...patch }));

  const handleBack = () => {
    if (dirty && !locked) setShowDiscard(true);
    else onBack();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.code}>{asset.code}</Text>
        <Text style={styles.name}>{asset.name}</Text>
        <View style={styles.infoCard}>
          <InfoRow label={t('assets.field.category')} value={asset.category} />
          <InfoRow label={t('assets.field.inputDate')} value={asset.inputDate} />
          <InfoRow label={t('assets.field.acquireDate')} value={asset.acquireDate} />
          <InfoRow
            label={t('assets.field.remainQty')}
            value={asset.remainQty != null ? String(asset.remainQty) : null}
          />
          <InfoRow label={t('documents.entry.transferDate')} value={transferDate} />
        </View>

        <Text style={styles.fieldLabel}>{t('documents.entry.location')}</Text>
        <LocationSelect
          value={values.location}
          options={locations}
          disabled={locked}
          onChange={(name) => set({ location: name })}
        />

        <Text style={styles.fieldLabel}>{t('documents.entry.serialNo')}</Text>
        <TextInput
          style={styles.input}
          accessibilityLabel={t('documents.entry.serialNo')}
          editable={!locked}
          value={values.observedSerialNo}
          onChangeText={(text) => set({ observedSerialNo: text })}
        />

        <Text style={styles.fieldLabel}>{t('documents.entry.specification')}</Text>
        <TextInput
          style={styles.input}
          accessibilityLabel={t('documents.entry.specification')}
          editable={!locked}
          value={values.observedSpecification}
          onChangeText={(text) => set({ observedSpecification: text })}
        />

        <Text style={styles.fieldLabel}>{t('documents.entry.remark')}</Text>
        <TextInput
          style={styles.input}
          accessibilityLabel={t('documents.entry.remark')}
          editable={!locked}
          value={values.observedRemark}
          onChangeText={(text) => set({ observedRemark: text })}
        />

        <Text style={styles.fieldLabel}>{t('documents.entry.comment')}</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          accessibilityLabel={t('documents.entry.comment')}
          editable={!locked}
          multiline
          value={values.comment}
          onChangeText={(text) => set({ comment: text })}
        />

        <Text style={styles.fieldLabel}>{t('documents.counted')}</Text>
        <QtyStepper
          value={values.countQty}
          disabled={locked}
          onChange={(n) => set({ countQty: n })}
        />
      </ScrollView>

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" style={styles.backBtn} onPress={handleBack}>
          <Text style={styles.backText}>{t('documents.entry.back')}</Text>
        </Pressable>
        {!locked ? (
          <Pressable
            accessibilityRole="button"
            style={styles.saveBtn}
            onPress={() => onSave(values)}
          >
            <Text style={styles.saveText}>{t('documents.entry.save')}</Text>
          </Pressable>
        ) : null}
      </View>

      {showDiscard ? (
        <Modal transparent animationType="fade" visible onRequestClose={() => setShowDiscard(false)}>
          <View style={styles.backdrop}>
            <View style={styles.dialog}>
              <Text style={styles.dialogTitle}>{t('documents.entry.discardTitle')}</Text>
              <Text style={styles.dialogMessage}>{t('documents.entry.discardMessage')}</Text>
              <View style={styles.dialogActions}>
                <Pressable
                  accessibilityRole="button"
                  style={styles.dialogCancel}
                  onPress={() => setShowDiscard(false)}
                >
                  <Text style={styles.dialogCancelText}>{t('common.cancel')}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  style={styles.dialogConfirm}
                  onPress={() => {
                    setShowDiscard(false);
                    onBack();
                  }}
                >
                  <Text style={styles.dialogConfirmText}>{t('documents.entry.discard')}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 16, gap: 6 },
  code: { fontFamily: 'monospace', fontSize: 13, color: '#475569' },
  name: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  infoCard: { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  infoLabel: { color: '#64748b', fontSize: 13 },
  infoValue: { color: '#0f172a', fontSize: 13, fontWeight: '500' },
  fieldLabel: { fontSize: 12, color: '#94a3b8', marginTop: 6 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0f172a',
  },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  backBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
  },
  backText: { color: '#475569', fontSize: 15, fontWeight: '600' },
  saveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: '#fff', borderRadius: 12, padding: 20, gap: 8 },
  dialogTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  dialogMessage: { fontSize: 14, color: '#475569' },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  dialogCancel: { paddingVertical: 10, paddingHorizontal: 16 },
  dialogCancelText: { color: '#475569', fontSize: 15, fontWeight: '600' },
  dialogConfirm: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#dc2626',
  },
  dialogConfirmText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
```

- [ ] **Step 4: Run** the test — confirm PASS (5 tests). (`getByLabelText('counted quantity')` and `'increment'` come from the embedded `QtyStepper`.)
- [ ] **Step 5: Run** `npx tsc --noEmit` — confirm clean.
- [ ] **Step 6: Commit**
```bash
git add src/features/counting/CountEntryForm.tsx src/features/counting/__tests__/CountEntryForm.test.tsx
git commit -m "feat(counting): add CountEntryForm with discard guard"
```

---

## Task 7: `AssetCountListItem` view button

**Files:** Modify `src/features/counting/AssetCountListItem.tsx`; `src/features/counting/__tests__/AssetCountListItem.test.tsx`.

Add an optional `onView` and a view (›) button so a row can open Asset Information. The inline `QtyStepper` stays.

- [ ] **Step 1: Add the test** — append this `it` inside the existing `describe('AssetCountListItem', …)` (the file already imports `render`, `screen`, `fireEvent`, `initI18n`, `setLocale` and defines `row`):
```ts
  it('fires onView with the asset id when the view button is pressed', () => {
    const onView = jest.fn();
    render(<AssetCountListItem row={row} onChangeQty={() => {}} onView={onView} />);
    fireEvent.press(screen.getByLabelText('View'));
    expect(onView).toHaveBeenCalledWith('a1');
  });
```

- [ ] **Step 2: Run** `npx jest src/features/counting/__tests__/AssetCountListItem.test.tsx` — confirm the new test FAILS (no element labeled "View").

- [ ] **Step 3: Edit** `src/features/counting/AssetCountListItem.tsx`:
(a) Add `onView` to `Props`:
```ts
  onChangeQty: (assetId: string, qty: number) => void;
  disabled?: boolean;
  /** When provided, renders a view button that opens Asset Information for this asset. */
  onView?: (assetId: string) => void;
```
(b) Destructure it: `export function AssetCountListItem({ row, onChangeQty, disabled, onView }: Props) {` and pull `useT`: the component already imports `useT` and calls `const t = useT();` — keep it.
(c) In the returned JSX, wrap the trailing controls so the view button sits next to the stepper. Replace the final `<QtyStepper … />` element with:
```tsx
      <View style={styles.trailing}>
        {onView ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('documents.view')}
            style={styles.viewBtn}
            onPress={() => onView(asset.id)}
          >
            <Text style={styles.viewIcon}>›</Text>
          </Pressable>
        ) : null}
        <QtyStepper value={countedQty} disabled={disabled} onChange={(n) => onChangeQty(asset.id, n)} />
      </View>
```
(d) Add `Pressable` to the `react-native` import (currently `import { StyleSheet, Text, View } from 'react-native';` → add `Pressable`). Add these style entries:
```tsx
  trailing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewBtn: { paddingHorizontal: 6, paddingVertical: 6 },
  viewIcon: { fontSize: 22, color: '#2563eb' },
```

- [ ] **Step 4: Run** the test — confirm ALL pass (the 3 prior tests + the new view-button test). `documents.view` ("View") already exists in i18n.
- [ ] **Step 5: Run** `npx tsc --noEmit` — confirm clean.
- [ ] **Step 6: Commit**
```bash
git add src/features/counting/AssetCountListItem.tsx src/features/counting/__tests__/AssetCountListItem.test.tsx
git commit -m "feat(counting): add view button to AssetCountListItem"
```

---

## Task 8: Move the detail screen to `[id]/index.tsx` + wire the view button

**Files:** Move `app/documents/[id].tsx` → `app/documents/[id]/index.tsx`; Modify `app/_layout.tsx`.

The detail screen must become `index.tsx` so `[id]` can also be a directory for the entry route. The import depth increases by one (`../../src/…` → `../../../src/…`), and it now passes `onView` + the document's `locationName` (for the Slice-4 hide rule).

- [ ] **Step 1: Remove the old file and create the new one.**
```bash
git rm "app/documents/[id].tsx"
```
Create `app/documents/[id]/index.tsx` with this full content:
```tsx
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useT } from '../../../src/platform/i18n';
import { useCountingDocument } from '../../../src/features/counting/useCountingDocument';
import { useAssetCountList } from '../../../src/features/counting/useAssetCountList';
import { useSetCountedQty } from '../../../src/features/counting/useSetCountedQty';
import { CountingDocumentHeader } from '../../../src/features/counting/CountingDocumentHeader';
import { CountFilterChips } from '../../../src/features/counting/CountFilterChips';
import { AssetCountToolbar } from '../../../src/features/counting/AssetCountToolbar';
import { AssetCountListItem } from '../../../src/features/counting/AssetCountListItem';
import {
  filterSortAssetCounts,
  type CountFilter,
  type AssetSort,
} from '../../../src/features/counting/filterSortAssetCounts';

export default function CountingDocumentDetailScreen() {
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const documentId = id ?? '';
  const { data: document, isLoading: docLoading } = useCountingDocument(documentId);
  const { data: rows, isLoading: listLoading } = useAssetCountList(
    documentId,
    document?.locationId ?? '',
    document?.locationName ?? '',
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
            onView={(assetId) => router.push(`/documents/${documentId}/assets/${assetId}`)}
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

- [ ] **Step 2: Update the route registration in `app/_layout.tsx`.** Change the existing line:
```tsx
        <Stack.Screen name="documents/[id]" />
```
to:
```tsx
        <Stack.Screen name="documents/[id]/index" />
```

- [ ] **Step 3: Run** `npx tsc --noEmit` — confirm clean (verifies the deeper import paths resolve).

- [ ] **Step 4: Run** the full suite to confirm no regression: `CI=true npx jest 2>&1 | tail -8`. All suites pass.

- [ ] **Step 5: Commit**
```bash
git add "app/documents/[id]/index.tsx" app/_layout.tsx
git commit -m "refactor(documents): move detail to [id]/index + wire row view button"
```

---

## Task 9: Asset Information screen + route registration

**Files:** Create `app/documents/[id]/assets/[assetId].tsx`; Modify `app/_layout.tsx`.

Glue screen — verified by typecheck + the manual QA in Task 10. It loads the document, asset, existing entry, and locations; computes the initial form values (prefilling Serial No / Specification from the catalog asset, defaulting Counted Qty to 1 and Location to the document's location for a new entry); and wires `CountEntryForm` to `useSaveCountEntry` + `router.back()`.

- [ ] **Step 1: Create `app/documents/[id]/assets/[assetId].tsx`:**
```tsx
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useT } from '../../../../src/platform/i18n';
import { useAsset } from '../../../../src/features/asset/useAsset';
import { useCountingDocument } from '../../../../src/features/counting/useCountingDocument';
import { useCountEntryForAsset } from '../../../../src/features/counting/useCountEntryForAsset';
import { useSaveCountEntry } from '../../../../src/features/counting/useSaveCountEntry';
import { useLocations } from '../../../../src/features/counting/useLocations';
import {
  CountEntryForm,
  type CountEntryFormValues,
} from '../../../../src/features/counting/CountEntryForm';

export default function AssetInformationScreen() {
  const t = useT();
  const router = useRouter();
  const { id, assetId } = useLocalSearchParams<{ id: string; assetId: string }>();
  const documentId = id ?? '';
  const assetKey = assetId ?? '';

  const { data: document, isLoading: docLoading } = useCountingDocument(documentId);
  const { data: asset, isLoading: assetLoading } = useAsset(assetKey);
  const { data: entry, isLoading: entryLoading } = useCountEntryForAsset(documentId, assetKey);
  const { data: locations } = useLocations();
  const save = useSaveCountEntry(documentId);

  const loading = docLoading || assetLoading || entryLoading;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: t('assets.title') }} />
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }
  if (!asset || !document) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: t('assets.title') }} />
        <View style={styles.center}>
          <Text style={styles.empty}>{t('assets.empty')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const initial: CountEntryFormValues = {
    countQty: entry?.countQty ?? 1,
    location: entry?.location ?? document.locationName,
    observedSerialNo: entry?.observedSerialNo ?? asset.serialNo ?? '',
    observedSpecification: entry?.observedSpecification ?? asset.specification ?? '',
    observedRemark: entry?.observedRemark ?? '',
    comment: entry?.comment ?? '',
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: asset.code }} />
      <CountEntryForm
        asset={asset}
        transferDate={entry?.transferDate ?? null}
        initial={initial}
        locations={locations ?? []}
        locked={document.status !== 'draft'}
        onSave={(values) =>
          save.mutate({ assetId: assetKey, ...values }, { onSuccess: () => router.back() })
        }
        onBack={() => router.back()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: '#94a3b8' },
});
```

- [ ] **Step 2: Register the route in `app/_layout.tsx`.** Inside the `RouteGate` `<Stack>`, add after the `documents/[id]/index` line:
```tsx
        <Stack.Screen name="documents/[id]/assets/[assetId]" />
```

- [ ] **Step 3: Run** `npx tsc --noEmit` — confirm clean.
- [ ] **Step 4: Run** the full suite: `CI=true npx jest 2>&1 | tail -8`. All suites pass.
- [ ] **Step 5: Commit**
```bash
git add "app/documents/[id]/assets/[assetId].tsx" app/_layout.tsx
git commit -m "feat(documents): add Asset Information count-entry screen"
```

---

## Task 10: Slice verification (full suite, lint, format, manual QA)

**Files:** none (verification + final commit if formatting changes).

- [ ] **Step 1: Typecheck** — `npx tsc --noEmit` — no errors.
- [ ] **Step 2: Lint** — `npm run lint` — no errors. (`npm run lint:fix` if autofixable, then re-run.)
- [ ] **Step 3: Format** — `npm run format:check`. If it lists Slice-4 files (`src/features/counting/*`, `src/platform/i18n/*`, `app/documents/*`), run `npx prettier --write` on those specific paths (do NOT touch unrelated files such as `CLAUDE.md`), then re-check.
- [ ] **Step 4: Full suite** — `CI=true npx jest 2>&1 | tail -15` — all suites PASS (including Slice 1–3; especially the moved detail screen's consumers and the updated `useAssetCountList`/`AssetCountListItem`).
- [ ] **Step 5: Manual QA (mock backend)** — `npm start`, sign in, then:
  1. Open a **draft** document (Documents tab → 👁). Each asset row now has a **›** view button next to its stepper. Tap it → the **Asset Information** screen opens (title = asset code).
  2. Header/info shows code, name, category, input/acquire date, remain qty; editable **Location** (dropdown), **Serial No**/**Specification** prefilled from the catalog, blank **Remark**/**Comment**, and **Counted Qty** defaulting to **1** (new entry).
  3. Edit Comment + bump Counted Qty → **Save Asset Count** → returns to the detail list; the row reflects the new counted qty and the View-All counted total updates.
  4. Re-open the same asset → your saved values are shown (Serial No, Comment, qty), and **Transfer Date** now has a value.
  5. Change the **Location** to a different one → Save → the asset **drops out** of this document's detail list (observed elsewhere). Switch the chip filters to confirm it's gone from All/Counted.
  6. Edit a field, press **Back** → **"Discard changes?"** popup → **Cancel** keeps you on the screen; **Discard** returns without saving. Back with no edits → returns immediately (no popup).
  7. Open an asset on a **void** document (void one from the list first) → fields read-only, **no Save button**, stepper disabled.

- [ ] **Step 6: Final commit (only if Steps 2–3 changed files)**
```bash
git add -A
git commit -m "chore(counting): lint/format pass for Slice 4"
```

---

## Self-Review (run by the plan author)

**1. Spec coverage (§8 Asset Information / §12.4 "count-entry screen, observation edits, qty stepper, discard guard, Save Asset Count"):**
- Count-entry screen reachable from the detail row view button — Tasks 7 + 8 + 9. ✓
- Single-column layout: asset code/name/category/input/acquire/remain qty (read-only), Location (editable dropdown), transfer date (read-only), Serial No/Specification/Remark/Comment (editable), Counted Qty (default 1) — Task 6 (`CountEntryForm`) + Task 9 (initial values). ✓ (Asset **image** + **Take Photo** consciously deferred — see below.)
- Edits buffered; **Save Asset Count** persists entry + sets `transferDate = now` + enqueues `entry.upsert`; editable fields write to entry observations, catalog untouched — Task 3 (`useSaveCountEntry`). ✓
- Editable fields write to observations (`observedSerialNo/Specification/Remark`, `location`, `comment`) — Task 3 + Task 6. ✓
- **Location override** hides the asset from the document's list — Task 4. ✓
- **Discard guard** ("Discard Change?" on Back with unsaved edits, Yes/No) — Task 6 (in-screen Back button; OS-back interception consciously out of scope). ✓
- Counted Qty default 1 for a new entry — Task 9. ✓
- i18n en + th — Task 1. ✓

**Deliberately deferred (documented, not gaps):** Take Photo → Slice 6; repeat-scan accumulation → Slice 5; asset image rendering (seed has none); OS/gesture-back interception (locked scope decision); Buddhist-calendar dates.

**2. Placeholder scan:** No TBD/TODO/"handle edge cases". Every code step has complete code. ✓

**3. Type consistency:**
- `CountEntryFormValues { countQty, location, observedSerialNo, observedSpecification, observedRemark, comment }` defined in `CountEntryForm.tsx` (Task 6), imported by the screen (Task 9). ✓
- `SaveCountEntryInput` = `{ assetId } & CountEntryFormValues` shape; the screen calls `save.mutate({ assetId: assetKey, ...values })` (Task 9) matching `useSaveCountEntry`'s `mutationFn` param (Task 3). ✓
- `useAssetCountList(documentId, locationId, locationName)` — 3-arg signature consistent in the hook (Task 4), its test (Task 4), and the detail screen (Task 8). All other callers updated (only the detail screen + tests call it). ✓
- `useCountEntryForAsset(documentId, assetId)` → key `['countEntry', documentId, assetId]`; `useSaveCountEntry` invalidates the same key (Task 3). ✓
- `entry.upsert` payload `{ documentId, entries: CountEntry[] }` matches the sync worker + Slice 3's `useSetCountedQty`. ✓
- `AssetCountListItem` gains `onView?: (assetId: string) => void` (Task 7); the detail screen passes `onView={(assetId) => router.push(...)}` (Task 8). ✓
- `LocationSelect { value: string; options: Location[]; onChange: (name: string) => void; disabled? }` consistent in component (Task 5), `CountEntryForm` usage (Task 6), and test (Task 5). ✓
- i18n keys referenced (`documents.entry.*`, reused `assets.field.*`, `documents.counted`, `documents.view`, `common.cancel`) all exist (Task 1 adds `documents.entry.*`; the rest predate this slice). ✓
- Route: detail at `documents/[id]/index`, entry at `documents/[id]/assets/[assetId]`; both registered in `_layout.tsx` (Tasks 8–9); the create flow + View-All eye button from Slice 3 still target `/documents/<id>` which resolves to the index. ✓
