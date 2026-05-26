# Counting Documents — Slice 6a: Photos + Commit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the Asset Information screen, capture entry photos (camera → local URI) that buffer with the form and persist + queue `photo.upload` on Save Asset Count, with existing photos shown as thumbnails. On the detail screen, **Commit Count** finalizes the document (status `committed`, `commitDate`, queued `document.commit`) behind a confirm dialog, which locks it.

**Architecture:** Take Photo uses `expo-image-picker` (`launchCameraAsync`) wrapped in a thin `capturePhoto()`; `CountEntryForm` buffers captured photos (injected `onCapturePhoto` keeps it unit-testable) and surfaces them to `useSaveCountEntry`, which inserts `Photo` rows, appends their ids to the entry's `photoIds`, and enqueues a `photo.upload` per photo. Existing photos load via `useEntryPhotos`. Commit is a new `useCommitCountingDocument` hook + a detail-screen Commit button gated to drafts, reusing the `ui/ConfirmDialog`. Both flows ride existing mutation kinds (`photo.upload`, `document.commit`) + the Slice-1 reconciler, against the default mock backend.

**Tech Stack:** `expo-image-picker`, Expo Router, React 19, `@tanstack/react-query` v5, `expo-sqlite` via `SqlExecutor`, `react-i18next`. Tests: Jest (`jest-expo`) + `@testing-library/react-native` + `better-sqlite3` via `testDb.ts` + the `renderCountingHook.tsx` harness. The live camera capture is device-verified; the buffer/persist/queue/commit logic is unit-tested.

**Spec:** `docs/superpowers/specs/2026-05-26-counting-documents-design.md` — §8 (Take Photo), §7 (Commit Count), §3.4 (Photo), §5 (photo.upload + document.commit reconciliation), §12.6.

---

## Locked scope decisions (from brainstorming)

- **expo-image-picker** for capture (`launchCameraAsync`).
- **Photos buffer in the form, persist on Save Asset Count** (a discarded entry leaves no orphan photos/uploads).
- **HTTP hardening is Slice 6b** (separate plan). This slice runs against the default mock + the existing `document.commit`/`photo.upload` reconciler.

## Deferred / out of scope

- HTTP `CarmenApi` endpoint implementations + idempotency threading + multipart → **Slice 6b**.
- Photo deletion/retake management (only capture + queue this slice).
- Buddhist-calendar dates.

---

## File Structure

**New files**
- `src/features/counting/useEntryPhotos.ts` + test — load a saved entry's photos for thumbnails.
- `src/features/counting/useCommitCountingDocument.ts` + test — commit mutation.
- `src/features/counting/capturePhoto.ts` — `expo-image-picker` wrapper (glue, device-verified).

**Modified files**
- `package.json` + `app.config.js` — add expo-image-picker + permission plugin.
- `src/features/counting/useSaveCountEntry.ts` + test — accept buffered `photos`, insert + append ids + enqueue `photo.upload`.
- `src/features/counting/CountEntryForm.tsx` + test — photo buffer, Take Photo button, thumbnail strip, `onSave(values, newPhotos)`.
- `app/documents/[id]/assets/[assetId].tsx` — wire `capturePhoto`, existing photo thumbnails, the new onSave signature.
- `app/documents/[id]/index.tsx` — Commit button (drafts only) + ConfirmDialog.
- `src/platform/i18n/locales/en.json` + `th.json` — `documents.entry.takePhoto`, `documents.entry.photos`, `documents.commit.*`.
- `src/platform/i18n/__tests__/i18n.test.ts` — assert a new key.

No DB migration (the `photo` table exists from Slice 1).

---

## Task 1: Add expo-image-picker + permission config

**Files:** `package.json` (via installer), `app.config.js`. No unit test; verified by install + typecheck + suite green.

- [ ] **Step 1: Install**
```bash
npx expo install expo-image-picker
```
If it fails (network/sandbox), report BLOCKED with the exact error — do not hand-edit package.json.

- [ ] **Step 2: Add the plugin** in `app.config.js`. The `plugins` array currently is:
```js
    plugins: [
      'expo-router',
      [
        'expo-camera',
        { cameraPermission: 'Allow $(PRODUCT_NAME) to use the camera to scan asset codes.' },
      ],
    ],
```
Add the image-picker plugin as a third entry (before the closing `]`):
```js
      [
        'expo-image-picker',
        { cameraPermission: 'Allow $(PRODUCT_NAME) to take photos of assets during a count.' },
      ],
```

- [ ] **Step 3: Verify** dep recorded: `node -e "console.log(require('./package.json').dependencies['expo-image-picker'])"` → a version string.
- [ ] **Step 4: Verify** no regression: `CI=true npx jest 2>&1 | tail -5` (all pass) and `npx tsc --noEmit` (clean).
- [ ] **Step 5: Commit**
```bash
git add package.json app.config.js
ls package-lock.json >/dev/null 2>&1 && git add package-lock.json
git commit -m "build: add expo-image-picker + camera permission plugin"
```

---

## Task 2: i18n keys (Take Photo + Commit)

**Files:** `src/platform/i18n/locales/en.json`, `th.json`, `src/platform/i18n/__tests__/i18n.test.ts`.

- [ ] **Step 1: Failing test** — add to `src/platform/i18n/__tests__/i18n.test.ts` (new `it`, en locale):
```ts
  it('resolves the photos + commit keys', () => {
    expect(t('documents.entry.takePhoto')).toBe('Take Photo');
    expect(t('documents.commit.action')).toBe('Commit Count');
    expect(t('documents.commit.confirm')).toBe('Commit');
  });
```

- [ ] **Step 2: Run** `npx jest src/platform/i18n/__tests__/i18n.test.ts` — confirm FAIL.

- [ ] **Step 3:** In `src/platform/i18n/locales/en.json`, INSIDE the existing `documents.entry` object add two keys (after `discard`, add a comma):
```json
      "takePhoto": "Take Photo",
      "photos": "Photos"
```
and INSIDE the `documents` object add a new `commit` sub-object (sibling of `entry`):
```json
    "commit": {
      "action": "Commit Count",
      "title": "Commit this count?",
      "message": "Once committed, the document is locked and can no longer be edited.",
      "confirm": "Commit"
    }
```

- [ ] **Step 4:** In `src/platform/i18n/locales/th.json`, add to `documents.entry`:
```json
      "takePhoto": "ถ่ายรูป",
      "photos": "รูปภาพ"
```
and the `documents.commit` sub-object:
```json
    "commit": {
      "action": "ยืนยันการตรวจนับ",
      "title": "ยืนยันการตรวจนับนี้?",
      "message": "เมื่อยืนยันแล้ว เอกสารจะถูกล็อกและไม่สามารถแก้ไขได้อีก",
      "confirm": "ยืนยัน"
    }
```

- [ ] **Step 5: Run** `npx jest src/platform/i18n/__tests__/i18n.test.ts` — PASS.
- [ ] **Step 6: Run** `npx tsc --noEmit` — clean.
- [ ] **Step 7: Commit**
```bash
git add src/platform/i18n/locales/en.json src/platform/i18n/locales/th.json src/platform/i18n/__tests__/i18n.test.ts
git commit -m "feat(i18n): add take-photo + commit keys"
```

---

## Task 3: `useCommitCountingDocument` hook

**Files:** Create `src/features/counting/useCommitCountingDocument.ts`; Test `src/features/counting/__tests__/useCommitCountingDocument.test.tsx`.

- [ ] **Step 1: Failing test** `src/features/counting/__tests__/useCommitCountingDocument.test.tsx`:
```tsx
import { renderHook, act } from '@testing-library/react-native';
import { makeMigratedTestDb, type TestDb } from '../../../data/db/__tests__/testDb';
import { createCountingDocumentRepo } from '../../../data/repos/countingDocumentRepo';
import { createPendingMutationRepo } from '../../../data/repos/pendingMutationRepo';
import { makeWrapper } from './renderCountingHook';
import { useCommitCountingDocument } from '../useCommitCountingDocument';
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

describe('useCommitCountingDocument', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
    await createCountingDocumentRepo(db).upsert(draft);
  });
  afterEach(() => db.close());

  it('marks the document committed locally and enqueues document.commit', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useCommitCountingDocument('d1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(draft);
    });

    const stored = await createCountingDocumentRepo(db).findById('d1');
    expect(stored?.status).toBe('committed');
    expect(stored?.commitDate).not.toBeNull();

    const pending = await createPendingMutationRepo(db).listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].kind).toBe('document.commit');
    expect((pending[0].payload as { id: string }).id).toBe('d1');
  });
});
```

- [ ] **Step 2: Run** the test — confirm FAIL.

- [ ] **Step 3: Implement** `src/features/counting/useCommitCountingDocument.ts`:
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDb } from '../../data/db/dbContext';
import { useMutationQueue } from '../../data/sync/mutationQueueContext';
import { createCountingDocumentRepo } from '../../data/repos/countingDocumentRepo';
import type { CountingDocument } from '../../data/api/carmenApi';

export function useCommitCountingDocument(documentId: string) {
  const db = useDb();
  const queue = useMutationQueue();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: CountingDocument): Promise<void> => {
      const committed: CountingDocument = {
        ...doc,
        status: 'committed',
        commitDate: new Date().toISOString(),
      };
      await createCountingDocumentRepo(db).upsert(committed);
      await queue.enqueue('document.commit', { id: documentId });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['countingDocument', documentId] });
      void qc.invalidateQueries({ queryKey: ['countingDocuments'] });
    },
  });
}
```

- [ ] **Step 4: Run** the test — PASS.
- [ ] **Step 5: Commit**
```bash
git add src/features/counting/useCommitCountingDocument.ts src/features/counting/__tests__/useCommitCountingDocument.test.tsx
git commit -m "feat(counting): add useCommitCountingDocument hook"
```

---

## Task 4: `useEntryPhotos` hook

**Files:** Create `src/features/counting/useEntryPhotos.ts`; Test `src/features/counting/__tests__/useEntryPhotos.test.tsx`.

- [ ] **Step 1: Failing test** `src/features/counting/__tests__/useEntryPhotos.test.tsx`:
```tsx
import { renderHook, waitFor } from '@testing-library/react-native';
import { makeMigratedTestDb, type TestDb } from '../../../data/db/__tests__/testDb';
import { createPhotoRepo } from '../../../data/repos/photoRepo';
import { makeWrapper } from './renderCountingHook';
import { useEntryPhotos } from '../useEntryPhotos';

describe('useEntryPhotos', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
    await createPhotoRepo(db).insert({
      id: 'ph1',
      entryId: 'e1',
      localUri: 'file://a.jpg',
      remoteUrl: null,
      capturedAt: '2026-05-26T09:00:00Z',
      uploadStatus: 'queued',
      attempts: 0,
      lastError: null,
    });
  });
  afterEach(() => db.close());

  it('loads photos for an entry', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useEntryPhotos('e1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((p) => p.id)).toEqual(['ph1']);
  });

  it('returns [] for a falsy entry id (no query)', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useEntryPhotos(''), { wrapper });
    // disabled query → data stays undefined; the screen treats it as no photos
    expect(result.current.data ?? []).toEqual([]);
  });
});
```

- [ ] **Step 2: Run** the test — confirm FAIL.

- [ ] **Step 3: Implement** `src/features/counting/useEntryPhotos.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { useDb } from '../../data/db/dbContext';
import { createPhotoRepo } from '../../data/repos/photoRepo';

export function useEntryPhotos(entryId: string) {
  const db = useDb();
  return useQuery({
    queryKey: ['entryPhotos', entryId],
    queryFn: () => createPhotoRepo(db).listByEntry(entryId),
    enabled: !!entryId,
  });
}
```

- [ ] **Step 4: Run** the test — PASS (2 tests).
- [ ] **Step 5: Commit**
```bash
git add src/features/counting/useEntryPhotos.ts src/features/counting/__tests__/useEntryPhotos.test.tsx
git commit -m "feat(counting): add useEntryPhotos hook"
```

---

## Task 5: `useSaveCountEntry` — persist buffered photos

**Files:** Modify `src/features/counting/useSaveCountEntry.ts`, `src/features/counting/__tests__/useSaveCountEntry.test.tsx`.

Extend the save to accept an optional `photos` buffer: insert each `Photo` (uploadStatus `queued`), append its id to the entry's `photoIds`, and enqueue a `photo.upload` per photo.

- [ ] **Step 1: Add a failing test** — append inside the existing `describe('useSaveCountEntry', …)`:
```ts
  it('persists buffered photos: inserts rows, appends photoIds, enqueues photo.upload', async () => {
    const { wrapper } = makeWrapper(db);
    const { result } = renderHook(() => useSaveCountEntry('d1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        assetId: 'a1',
        countQty: 1,
        location: 'L',
        observedSerialNo: '',
        observedSpecification: '',
        observedRemark: '',
        comment: '',
        photos: [{ id: 'ph1', uri: 'file://a.jpg', mimeType: 'image/jpeg' }],
      });
    });

    const entry = await createCountEntryRepo(db).findByDocumentAndAsset('d1', 'a1');
    expect(entry?.photoIds).toContain('ph1');

    const photos = await createPhotoRepo(db).listByEntry(entry!.id);
    expect(photos.map((p) => p.id)).toEqual(['ph1']);
    expect(photos[0].uploadStatus).toBe('queued');

    const pending = await createPendingMutationRepo(db).listPending();
    const kinds = pending.map((m) => m.kind).sort();
    expect(kinds).toEqual(['entry.upsert', 'photo.upload']);
    const photoMut = pending.find((m) => m.kind === 'photo.upload');
    expect(photoMut?.payload).toMatchObject({ id: 'ph1', uri: 'file://a.jpg', mimeType: 'image/jpeg' });
  });
```
Add this import at the top of the test file (alongside the existing imports):
```ts
import { createPhotoRepo } from '../../../data/repos/photoRepo';
```

- [ ] **Step 2: Run** `npx jest src/features/counting/__tests__/useSaveCountEntry.test.tsx` — confirm the NEW test FAILS (no photo row / no photo.upload). The existing tests still pass (they pass no `photos`).

- [ ] **Step 3: Implement.** In `src/features/counting/useSaveCountEntry.ts`:
(a) Add imports:
```ts
import { createPhotoRepo } from '../../data/repos/photoRepo';
```
(b) Add `photos` to `SaveCountEntryInput`:
```ts
export interface SaveCountEntryInput {
  assetId: string;
  countQty: number;
  location: string;
  observedSerialNo: string;
  observedSpecification: string;
  observedRemark: string;
  comment: string;
  photos?: { id: string; uri: string; mimeType: string }[];
}
```
(c) In `mutationFn`, replace the `const entry: CountEntry = { … }` construction's `photoIds` line and add photo persistence. Specifically, change `photoIds: existing?.photoIds ?? []` to include the new ids, and after `await repo.upsert(entry)` insert the photos + enqueue uploads. Use this body (replace the existing `mutationFn`):
```ts
    mutationFn: async (input: SaveCountEntryInput): Promise<void> => {
      const repo = createCountEntryRepo(db);
      const photoRepo = createPhotoRepo(db);
      const newPhotos = input.photos ?? [];
      const existing = await repo.findByDocumentAndAsset(documentId, input.assetId);
      const now = new Date().toISOString();
      const entryId = existing?.id ?? uuid();
      const entry: CountEntry = {
        id: entryId,
        documentId,
        assetId: input.assetId,
        unknownCode: null,
        countQty: input.countQty,
        location: input.location || null,
        observedSerialNo: input.observedSerialNo || null,
        observedSpecification: input.observedSpecification || null,
        observedRemark: input.observedRemark || null,
        comment: input.comment,
        photoIds: [...(existing?.photoIds ?? []), ...newPhotos.map((p) => p.id)],
        transferDate: now,
        scannedAt: existing?.scannedAt ?? now,
        updatedAt: now,
      };
      await repo.upsert(entry);
      for (const p of newPhotos) {
        await photoRepo.insert({
          id: p.id,
          entryId,
          localUri: p.uri,
          remoteUrl: null,
          capturedAt: now,
          uploadStatus: 'queued',
          attempts: 0,
          lastError: null,
        });
        await queue.enqueue('photo.upload', { id: p.id, uri: p.uri, mimeType: p.mimeType });
      }
      await queue.enqueue('entry.upsert', { documentId, entries: [entry] });
    },
```
(d) In `onSuccess`, also invalidate the entry's photos (the existing `onSuccess(_data, input)` already receives `input`). Add this line alongside the existing invalidations:
```ts
      void qc.invalidateQueries({ queryKey: ['entryPhotos'] });
```

- [ ] **Step 4: Run** `npx jest src/features/counting/__tests__/useSaveCountEntry.test.tsx` — confirm ALL pass (existing + new).
- [ ] **Step 5: Run** `npx tsc --noEmit` — clean.
- [ ] **Step 6: Commit**
```bash
git add src/features/counting/useSaveCountEntry.ts src/features/counting/__tests__/useSaveCountEntry.test.tsx
git commit -m "feat(counting): persist buffered photos on Save Asset Count"
```

---

## Task 6: `capturePhoto` wrapper

**Files:** Create `src/features/counting/capturePhoto.ts`.

Thin expo-image-picker wrapper — glue, device-verified (no unit test; the form's photo behavior is tested via an injected fake).

- [ ] **Step 1: Create `src/features/counting/capturePhoto.ts`:**
```ts
import * as ImagePicker from 'expo-image-picker';

/** Launches the camera and returns the captured photo, or null if denied/cancelled. */
export async function capturePhoto(): Promise<{ uri: string; mimeType: string } | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
  if (result.canceled || !result.assets || result.assets.length === 0) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' };
}
```

- [ ] **Step 2: Run** `npx tsc --noEmit` — confirm clean (verifies the expo-image-picker API names; if `launchCameraAsync`/`requestCameraPermissionsAsync`/`assets`/`mimeType`/`canceled` differ in this version, report the exact error rather than guessing).
- [ ] **Step 3: Commit**
```bash
git add src/features/counting/capturePhoto.ts
git commit -m "feat(counting): add capturePhoto (expo-image-picker) wrapper"
```

---

## Task 7: `CountEntryForm` — photo buffer, Take Photo, thumbnails

**Files:** Modify `src/features/counting/CountEntryForm.tsx`, `src/features/counting/__tests__/CountEntryForm.test.tsx`.

Add two props (`existingPhotoUris`, `onCapturePhoto`), buffer captured photos, render a Take Photo button (drafts only) + a thumbnail strip (existing + new), include photos in the dirty check, and change `onSave` to `(values, newPhotos)`.

- [ ] **Step 1: Update the test** `src/features/counting/__tests__/CountEntryForm.test.tsx`:
(a) Add `Photo` import is not needed; add `react`-style nothing. Update `setup`'s default props to include the two new props:
```ts
  const props = {
    asset,
    transferDate: null as string | null,
    initial,
    locations,
    locked: false,
    existingPhotoUris: [] as string[],
    onCapturePhoto: jest.fn(async () => ({ uri: 'file://new.jpg', mimeType: 'image/jpeg' })),
    onSave: jest.fn(),
    onBack: jest.fn(),
    ...over,
  };
```
(b) The "saves the edited values" test now gets a 2nd onSave arg — update its assertion to:
```ts
    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ comment: 'all good', countQty: 2 }),
      [],
    );
```
(c) Add two new tests inside the `describe`:
```ts
  it('captures a photo, shows a thumbnail, and includes it on save', async () => {
    const props = setup();
    fireEvent.press(screen.getByLabelText('Take Photo'));
    await screen.findByLabelText('photo');
    expect(screen.getAllByLabelText('photo')).toHaveLength(1);
    fireEvent.press(screen.getByText('Save Asset Count'));
    expect(props.onSave).toHaveBeenCalledWith(
      expect.any(Object),
      [expect.objectContaining({ uri: 'file://new.jpg', mimeType: 'image/jpeg' })],
    );
  });

  it('shows existing photo thumbnails', () => {
    setup({ existingPhotoUris: ['file://a.jpg', 'file://b.jpg'] });
    expect(screen.getAllByLabelText('photo')).toHaveLength(2);
  });
```

- [ ] **Step 2: Run** `npx jest src/features/counting/__tests__/CountEntryForm.test.tsx` — confirm FAILS (no Take Photo / no thumbnails / onSave arity).

- [ ] **Step 3: Edit `src/features/counting/CountEntryForm.tsx`:**
(a) Add `Image` and `uuid` imports — change the react-native import to include `Image`, and add:
```ts
import { uuid } from '../../platform/id';
```
(react-native import becomes: `import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';`)
(b) Add the two props to `Props`:
```ts
  existingPhotoUris: string[];
  onCapturePhoto: () => Promise<{ uri: string; mimeType: string } | null>;
  onSave: (values: CountEntryFormValues, newPhotos: { id: string; uri: string; mimeType: string }[]) => void;
```
(replace the old `onSave: (values: CountEntryFormValues) => void;`).
(c) Destructure the new props: `export function CountEntryForm({ asset, transferDate, initial, locations, locked, existingPhotoUris, onCapturePhoto, onSave, onBack }: Props) {`.
(d) Add photo buffer state + update `dirty`:
```ts
  const [newPhotos, setNewPhotos] = useState<{ id: string; uri: string; mimeType: string }[]>([]);
  const dirty =
    JSON.stringify(values) !== JSON.stringify(initial) || newPhotos.length > 0;
```
(replace the existing `const dirty = …` line).
(e) Add a photo block in the JSX — insert it AFTER the Comment `TextInput` block and BEFORE the `documents.counted` label/`QtyStepper` (this matches the §8 field order: Comment → Take Photo → Counted Qty):
```tsx
        <Text style={styles.fieldLabel}>{t('documents.entry.photos')}</Text>
        <View style={styles.photoRow}>
          {existingPhotoUris.map((uri) => (
            <Image
              key={uri}
              source={{ uri }}
              accessibilityLabel="photo"
              style={styles.thumb}
            />
          ))}
          {newPhotos.map((p) => (
            <Image
              key={p.id}
              source={{ uri: p.uri }}
              accessibilityLabel="photo"
              style={styles.thumb}
            />
          ))}
        </View>
        {!locked ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('documents.entry.takePhoto')}
            style={styles.photoBtn}
            onPress={async () => {
              const p = await onCapturePhoto();
              if (p) setNewPhotos((prev) => [...prev, { id: uuid(), uri: p.uri, mimeType: p.mimeType }]);
            }}
          >
            <Text style={styles.photoBtnText}>{t('documents.entry.takePhoto')}</Text>
          </Pressable>
        ) : null}
```
(f) Change the Save button's onPress from `onPress={() => onSave(values)}` to `onPress={() => onSave(values, newPhotos)}`.
(g) Add styles to the `StyleSheet.create`:
```ts
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#e5e7eb' },
  photoBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#475569',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  photoBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
```

- [ ] **Step 4: Run** `npx jest src/features/counting/__tests__/CountEntryForm.test.tsx` — confirm ALL pass (the prior tests, with the updated onSave assertion, plus the 2 new photo tests).
- [ ] **Step 5: Run** `npx tsc --noEmit` — clean.
- [ ] **Step 6: Commit**
```bash
git add src/features/counting/CountEntryForm.tsx src/features/counting/__tests__/CountEntryForm.test.tsx
git commit -m "feat(counting): add Take Photo + thumbnails to CountEntryForm"
```

---

## Task 8: Wire the Asset Information screen for photos

**Files:** Modify `app/documents/[id]/assets/[assetId].tsx`.

Glue — verified by typecheck + the full suite + manual QA. Loads existing photos, passes `capturePhoto` + existing thumbnail URIs, and forwards buffered photos to `useSaveCountEntry`.

- [ ] **Step 1: Edit `app/documents/[id]/assets/[assetId].tsx`:**
(a) Add imports (match the file's `../../../../src/...` depth):
```tsx
import { capturePhoto } from '../../../../src/features/counting/capturePhoto';
import { useEntryPhotos } from '../../../../src/features/counting/useEntryPhotos';
```
(b) After the existing `const { data: entry … } = useCountEntryForAsset(...)` line, add:
```tsx
  const { data: photos } = useEntryPhotos(entry?.id ?? '');
```
(c) Change the `<CountEntryForm … />` element: add the two new props and update `onSave` to forward photos. Replace the existing `onSave={(values) => save.mutate({ assetId: assetKey, ...values }, { onSuccess: () => router.back() })}` and add the new props so the element reads:
```tsx
      <CountEntryForm
        asset={asset}
        transferDate={entry?.transferDate ?? null}
        initial={initial}
        locations={locations ?? []}
        locked={document.status !== 'draft'}
        existingPhotoUris={(photos ?? []).map((p) => p.remoteUrl ?? p.localUri)}
        onCapturePhoto={capturePhoto}
        onSave={(values, newPhotos) =>
          save.mutate(
            { assetId: assetKey, ...values, photos: newPhotos },
            { onSuccess: () => router.back() },
          )
        }
        onBack={() => router.back()}
      />
```

- [ ] **Step 2: Run** `npx tsc --noEmit` — clean.
- [ ] **Step 3: Run** the full suite: `CI=true npx jest 2>&1 | tail -6` — all pass.
- [ ] **Step 4: Commit**
```bash
git add "app/documents/[id]/assets/[assetId].tsx"
git commit -m "feat(documents): wire Take Photo into the Asset Information screen"
```

---

## Task 9: Detail-screen Commit button

**Files:** Modify `app/documents/[id]/index.tsx`.

Add a Commit Count button (drafts only) + a confirm dialog that commits the document (which then locks it).

- [ ] **Step 1: Edit `app/documents/[id]/index.tsx`:**
(a) Add imports:
```tsx
import { ConfirmDialog } from '../../../src/ui/ConfirmDialog';
import { useCommitCountingDocument } from '../../../src/features/counting/useCommitCountingDocument';
```
(b) Add hook + dialog state near the other hooks (after `const setQty = useSetCountedQty(documentId);`):
```tsx
  const commit = useCommitCountingDocument(documentId);
  const [showCommit, setShowCommit] = useState(false);
```
(`useState` is already imported.)
(c) Add a Commit button to the `ListHeaderComponent` `<View>`, right after the Scan button block (the `{!locked ? ( <Pressable …scanBtn… /> ) : null}`):
```tsx
            {!locked ? (
              <Pressable
                accessibilityRole="button"
                style={styles.commitBtn}
                onPress={() => setShowCommit(true)}
              >
                <Text style={styles.commitText}>{t('documents.commit.action')}</Text>
              </Pressable>
            ) : null}
```
(d) Add the dialog at the end of the returned `<SafeAreaView>` (after the `<FlatList … />`, before `</SafeAreaView>`):
```tsx
      <ConfirmDialog
        visible={showCommit}
        title={t('documents.commit.title')}
        message={t('documents.commit.message')}
        confirmLabel={t('documents.commit.confirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          if (document) commit.mutate(document);
          setShowCommit(false);
        }}
        onCancel={() => setShowCommit(false)}
      />
```
(e) Add styles:
```ts
  commitBtn: {
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#16a34a',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  commitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
```

- [ ] **Step 2: Run** `npx tsc --noEmit` — clean.
- [ ] **Step 3: Run** the full suite — all pass.
- [ ] **Step 4: Commit**
```bash
git add "app/documents/[id]/index.tsx"
git commit -m "feat(documents): add Commit Count to the detail screen"
```

---

## Task 10: Slice verification (full suite, lint, format, manual QA)

**Files:** none (verification + final commit if formatting changes).

- [ ] **Step 1: Typecheck** — `npx tsc --noEmit` — no errors.
- [ ] **Step 2: Lint** — `npm run lint` (`lint:fix` if needed).
- [ ] **Step 3: Format** — `npm run format:check`; if it lists Slice-6a files, `npx prettier --write` those specific paths (NOT `CLAUDE.md`), re-check.
- [ ] **Step 4: Full suite** — `CI=true npx jest 2>&1 | tail -15` — all pass.
- [ ] **Step 5: Manual QA (device — camera).** `npm start`, sign in:
  1. Open a **draft** → an asset → **Asset Information**. Tap **Take Photo** → grant permission → camera → capture → a thumbnail appears. Take a second → two thumbnails. **Save Asset Count** → returns to the list. Re-open the asset → the saved photos show as thumbnails (loaded via `useEntryPhotos`). Open **/sync** → a `photo.upload` (+ `entry.upsert`) was queued and drains; the photo's `remoteUrl` reconciles.
  2. Take a photo then press **Back** → the **Discard changes?** guard fires (photos count as unsaved edits).
  3. On the detail screen (draft) → tap **Commit Count** → **"Commit this count?"** → **Commit** → the document becomes **Committed**: the header badge flips, the Scan / Commit buttons disappear, the qty steppers + Take Photo are disabled (locked). Cancel leaves it a draft.
  4. A **committed** document shows no Commit/Scan buttons and read-only entries.

- [ ] **Step 6: Final commit (only if Steps 2–3 changed files)**
```bash
git add -A
git commit -m "chore(counting): lint/format pass for Slice 6a"
```

---

## Self-Review (run by the plan author)

**1. Spec coverage (§8 Take Photo / §7 Commit Count / §12.6 photos + commit):**
- Take Photo captures an entry photo (local id + URI), queues `photo.upload`, leaves the catalog image untouched — Tasks 5–8. ✓
- Photos buffer with the form and persist on Save (discard-safe) — Tasks 5 + 7. ✓
- Existing photos shown as thumbnails — Tasks 4 + 7 + 8. ✓
- Commit Count → confirm → `commitDate`, status `committed`, `document.commit` enqueued, locks the document — Tasks 3 + 9 (the existing `locked = status !== 'draft'` disables editing once committed). ✓
- i18n en + th — Task 2. ✓

**Deferred (documented):** HTTP endpoint impls + idempotency + multipart → Slice 6b; photo delete/retake; Buddhist dates.

**Device-only (flagged):** the live camera capture (`capturePhoto`/`launchCameraAsync`, permission prompt) — Task 10 manual QA. The buffer/persist/queue, commit, photo-load, and the form's photo behavior (via injected `onCapturePhoto`) are unit-tested.

**2. Placeholder scan:** No TBD/TODO; every code step is complete. ✓

**3. Type consistency:**
- `useSaveCountEntry` `SaveCountEntryInput.photos?: { id; uri; mimeType }[]` (optional → existing Slice-4 test calls still compile) — Task 5; the screen passes `photos: newPhotos` (Task 8). ✓
- `CountEntryForm.onSave: (values, newPhotos) => void` + new props `existingPhotoUris`/`onCapturePhoto` — Task 7; the screen supplies all three (Task 8). The buffered photo shape `{ id, uri, mimeType }` matches `SaveCountEntryInput.photos`. ✓
- `photo.upload` payload `{ id, uri, mimeType }` matches the sync worker's `PhotoUpload` cast; `document.commit` payload `{ id }` matches the worker's destructure — Tasks 3, 5. ✓
- `useCommitCountingDocument(documentId).mutate(doc)` invalidates `['countingDocument', id]` + `['countingDocuments']`; the detail screen passes `document` (Task 9). ✓
- `useEntryPhotos(entryId)` key `['entryPhotos', entryId]`; `useSaveCountEntry` invalidates the `['entryPhotos']` prefix — Tasks 4, 5. ✓
- i18n keys referenced (`documents.entry.takePhoto/photos`, `documents.commit.*`, reused `common.cancel`) added in Task 2. ✓
- `Photo` insert shape matches `photoRepo.insert` / the `Photo` type (`id, entryId, localUri, remoteUrl, capturedAt, uploadStatus, attempts, lastError`) — Task 5. ✓
