# Counting Documents — Slice 5: Scan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scan a QR/barcode (with a manual code-entry fallback) to resolve an asset. From Home, a scan opens the read-only asset detail. Inside a counting document, a scan either opens that asset's Asset Information entry pre-set to accumulate the count (saved qty + 1), or — if the asset isn't in the document's location — shows a "Not found Asset in location: {location}" popup.

**Architecture:** Add `expo-camera`. A shared presentational `ScannerView` (`features/scan/`) renders the camera (reticle + torch + ~1.5s debounce) plus a manual entry field and reports a scanned code via `onScan`. Two screens consume it: the **Scan tab** (standalone → resolve → `/assets/[id]`) and a pushed **`/documents/[id]/scan`** (in-document → resolve + in-location check → entry-with-accumulate or not-found popup). Resolution is a unit-tested `codeResolver` (SQLite `findByCode` first, then API `getAssetByCode`). Accumulation is a unit-tested `initialCountQty` helper consumed by the Slice-4 Asset Information screen via an `accumulate` query param. i18n's `t`/`useT` gain interpolation support for the `{location}`/`{code}` messages.

**Tech Stack:** `expo-camera` (CameraView + useCameraPermissions), Expo Router, React 19, `@tanstack/react-query` v5, `react-i18next`. Tests: Jest (`jest-expo`) + `@testing-library/react-native` + `better-sqlite3` via `testDb.ts`. The camera view itself is verified on device/simulator (jest can't exercise it); the resolution, accumulation, i18n, and manual-entry paths are unit-tested.

**Spec:** `docs/superpowers/specs/2026-05-26-counting-documents-design.md` — §9 (scan resolution), §6 (`/scan` row), §8 (repeat-scan accumulation), §12.5.

---

## Locked scope decisions (from brainstorming)

- **Add expo-camera now** — full-screen scanner (camera + reticle + torch + ~1.5s debounce) + manual "type code" fallback. The camera view is device/simulator-verified only.
- **Accumulation:** an in-document scan opens the Asset Information entry with Counted Qty = (saved qty + 1); first scan of a new asset opens at 1. Reviewing + Save accumulates one per scan.

## Deferred / out of scope

- **Take Photo + Commit Count** → Slice 6.
- **Standalone not-found** uses a simple `Alert` (the spec only specifies the styled popup for the in-document case).
- Buddhist-calendar dates (§10) — unchanged.

---

## File Structure

**New files**
- `src/features/scan/codeResolver.ts` + test — `createCodeResolver(assetRepo, api)` → SQLite-first, API-fallback resolution.
- `src/features/scan/useCodeResolver.ts` — hook wiring the resolver to `useDb`/`useCarmenApi`.
- `src/features/scan/ScannerView.tsx` + test — camera + reticle + torch + debounce + manual entry; reports `onScan(code)`.
- `src/features/counting/initialCountQty.ts` + test — accumulation helper.
- `app/documents/[id]/scan.tsx` — in-document scanner screen (glue) + route.

**Modified files**
- `package.json` — `expo-camera` dependency (via `npx expo install`).
- `app.config.js` — add the `expo-camera` config plugin (camera permission string).
- `src/platform/i18n/index.ts` — `t`/`useT` accept an optional interpolation-values arg.
- `src/platform/i18n/locales/en.json` + `th.json` — add the top-level `scan` keys.
- `src/platform/i18n/__tests__/i18n.test.ts` — assert an interpolated key.
- `app/(tabs)/scan.tsx` — replace the placeholder with the standalone scanner (glue).
- `app/documents/[id]/index.tsx` — add a Scan button (drafts only) → `/documents/[id]/scan`.
- `app/documents/[id]/assets/[assetId].tsx` — read the `accumulate` param + use `initialCountQty`.
- `app/_layout.tsx` — register the `documents/[id]/scan` route.

No DB migration.

---

## Task 1: Add expo-camera + camera permission config

**Files:** `package.json` (via installer), `app.config.js`.

This is a dependency/config task — no unit test. Verified by install success + typecheck + the existing suite staying green + (device) the camera prompting for permission.

- [ ] **Step 1: Install** (use `expo install` so the version matches the SDK):
```bash
npx expo install expo-camera
```

- [ ] **Step 2: Add the config plugin** in `app.config.js`. Change the `plugins` line:
```js
    plugins: ['expo-router'],
```
to:
```js
    plugins: [
      'expo-router',
      [
        'expo-camera',
        { cameraPermission: 'Allow $(PRODUCT_NAME) to use the camera to scan asset codes.' },
      ],
    ],
```

- [ ] **Step 3: Verify** the dependency is recorded:
```bash
node -e "console.log(require('./package.json').dependencies['expo-camera'])"
```
Expected: a version string (not `undefined`).

- [ ] **Step 4: Verify the existing suite still passes** (nothing imports expo-camera yet):

Run: `CI=true npx jest 2>&1 | tail -5`
Expected: all suites PASS (unchanged count from before this slice).

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**
```bash
git add package.json package-lock.json app.config.js
git commit -m "build: add expo-camera + camera permission plugin"
```
(If `package-lock.json` isn't present in this repo, omit it from the `git add`.)

---

## Task 2: i18n interpolation + scan keys

**Files:** `src/platform/i18n/index.ts`, `src/platform/i18n/locales/en.json`, `th.json`, `src/platform/i18n/__tests__/i18n.test.ts`.

- [ ] **Step 1: Failing test** — add to `src/platform/i18n/__tests__/i18n.test.ts` (a new `it` in the existing `describe`, run under the `en` locale like the others):
```ts
  it('interpolates values and resolves scan keys', () => {
    expect(t('scan.submit')).toBe('Find');
    expect(t('scan.notFoundInLocation', { location: 'Warehouse A' })).toBe(
      'Not found Asset in location: Warehouse A',
    );
  });
```

- [ ] **Step 2: Run** `npx jest src/platform/i18n/__tests__/i18n.test.ts` — confirm FAIL (raw key / no interpolation).

- [ ] **Step 3: Add interpolation support** in `src/platform/i18n/index.ts`. Replace the existing `t` function and the `useT` hook with these (the `normalize` helper and imports stay as-is):
```ts
export function t(key: string, opts?: Record<string, unknown>): string {
  return normalize(i18next.t(key, opts), key);
}
```
```ts
export function useT() {
  const { t: i18nT } = useTranslation();
  return useCallback(
    (key: string, opts?: Record<string, unknown>) => normalize(i18nT(key, opts), key),
    [i18nT],
  );
}
```
(`react-i18next`'s `t` accepts `(key, options)` and interpolates `{{var}}` placeholders. Existing callers passing only a key are unaffected.)

- [ ] **Step 4: Add the `scan` block to `src/platform/i18n/locales/en.json`** as a new TOP-LEVEL key (sibling of `documents`, e.g. after the `documents` object — add a comma after `documents`'s closing brace):
```json
  "scan": {
    "title": "Scan QR Code",
    "manualEntry": "Or enter a code manually",
    "manualPlaceholder": "Asset code",
    "submit": "Find",
    "torchOn": "Torch on",
    "torchOff": "Torch off",
    "permissionMessage": "Camera access is needed to scan asset codes.",
    "grantPermission": "Grant camera access",
    "notFound": "No asset found for code: {{code}}",
    "notFoundInLocation": "Not found Asset in location: {{location}}",
    "ok": "OK"
  }
```

- [ ] **Step 5: Add the matching top-level `scan` block to `src/platform/i18n/locales/th.json`:**
```json
  "scan": {
    "title": "สแกน QR Code",
    "manualEntry": "หรือกรอกรหัสด้วยตนเอง",
    "manualPlaceholder": "รหัสสินทรัพย์",
    "submit": "ค้นหา",
    "torchOn": "เปิดไฟฉาย",
    "torchOff": "ปิดไฟฉาย",
    "permissionMessage": "ต้องเข้าถึงกล้องเพื่อสแกนรหัสสินทรัพย์",
    "grantPermission": "อนุญาตการเข้าถึงกล้อง",
    "notFound": "ไม่พบสินทรัพย์สำหรับรหัส: {{code}}",
    "notFoundInLocation": "ไม่พบสินทรัพย์ในสถานที่: {{location}}",
    "ok": "ตกลง"
  }
```

- [ ] **Step 6: Run** `npx jest src/platform/i18n/__tests__/i18n.test.ts` — confirm PASS.
- [ ] **Step 7: Run** `npx tsc --noEmit` — confirm clean.
- [ ] **Step 8: Commit**
```bash
git add src/platform/i18n/index.ts src/platform/i18n/locales/en.json src/platform/i18n/locales/th.json src/platform/i18n/__tests__/i18n.test.ts
git commit -m "feat(i18n): add scan keys + interpolation support"
```

---

## Task 3: `codeResolver` (+ hook)

**Files:** Create `src/features/scan/codeResolver.ts`, `src/features/scan/useCodeResolver.ts`; Test `src/features/scan/__tests__/codeResolver.test.ts`.

- [ ] **Step 1: Failing test** `src/features/scan/__tests__/codeResolver.test.ts`:
```ts
import { createCodeResolver } from '../codeResolver';
import type { AssetRepo } from '../../../data/repos/assetRepo';
import type { CarmenApi } from '../../../data/api/carmenApi';
import type { Asset } from '../../../data/repos/types';

function asset(id: string, code: string): Asset {
  return {
    id,
    code,
    name: code,
    category: null,
    department: null,
    locationId: 'loc1',
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

describe('codeResolver', () => {
  it('returns the local asset without calling the API', async () => {
    const local = asset('a1', 'AST001');
    const api = { getAssetByCode: jest.fn() } as unknown as CarmenApi;
    const repo = { findByCode: jest.fn(async () => local) } as unknown as AssetRepo;
    const resolver = createCodeResolver(repo, api);
    expect(await resolver.resolve('AST001')).toEqual(local);
    expect(api.getAssetByCode).not.toHaveBeenCalled();
  });

  it('falls back to the API when not found locally', async () => {
    const remote = asset('a9', 'AST999');
    const api = { getAssetByCode: jest.fn(async () => remote) } as unknown as CarmenApi;
    const repo = { findByCode: jest.fn(async () => null) } as unknown as AssetRepo;
    const resolver = createCodeResolver(repo, api);
    expect(await resolver.resolve('AST999')).toEqual(remote);
    expect(api.getAssetByCode).toHaveBeenCalledWith('AST999');
  });

  it('returns null when neither has it', async () => {
    const api = { getAssetByCode: jest.fn(async () => null) } as unknown as CarmenApi;
    const repo = { findByCode: jest.fn(async () => null) } as unknown as AssetRepo;
    const resolver = createCodeResolver(repo, api);
    expect(await resolver.resolve('NOPE')).toBeNull();
  });
});
```

- [ ] **Step 2: Run** `npx jest src/features/scan/__tests__/codeResolver.test.ts` — confirm FAIL.

- [ ] **Step 3: Implement** `src/features/scan/codeResolver.ts`:
```ts
import type { AssetRepo } from '../../data/repos/assetRepo';
import type { CarmenApi } from '../../data/api/carmenApi';
import type { Asset } from '../../data/repos/types';

export interface CodeResolver {
  resolve(code: string): Promise<Asset | null>;
}

export function createCodeResolver(assetRepo: AssetRepo, api: CarmenApi): CodeResolver {
  return {
    async resolve(code) {
      const local = await assetRepo.findByCode(code);
      if (local) return local;
      return api.getAssetByCode(code);
    },
  };
}
```

- [ ] **Step 4: Implement the hook** `src/features/scan/useCodeResolver.ts`:
```ts
import { useMemo } from 'react';
import { useDb } from '../../data/db/dbContext';
import { useCarmenApi } from '../../data/api/carmenApiContext';
import { createAssetRepo } from '../../data/repos/assetRepo';
import { createCodeResolver, type CodeResolver } from './codeResolver';

export function useCodeResolver(): CodeResolver {
  const db = useDb();
  const api = useCarmenApi();
  return useMemo(() => createCodeResolver(createAssetRepo(db), api), [db, api]);
}
```

- [ ] **Step 5: Run** `npx jest src/features/scan/__tests__/codeResolver.test.ts` — confirm PASS (3 tests).
- [ ] **Step 6: Run** `npx tsc --noEmit` — confirm clean.
- [ ] **Step 7: Commit**
```bash
git add src/features/scan/codeResolver.ts src/features/scan/useCodeResolver.ts src/features/scan/__tests__/codeResolver.test.ts
git commit -m "feat(scan): add codeResolver (SQLite-first, API fallback)"
```

---

## Task 4: `initialCountQty` accumulation helper

**Files:** Create `src/features/counting/initialCountQty.ts`; Test `src/features/counting/__tests__/initialCountQty.test.ts`.

- [ ] **Step 1: Failing test** `src/features/counting/__tests__/initialCountQty.test.ts`:
```ts
import { initialCountQty } from '../initialCountQty';

describe('initialCountQty', () => {
  it('defaults to the saved value (or 1) when not accumulating', () => {
    expect(initialCountQty(null, false)).toBe(1);
    expect(initialCountQty(3, false)).toBe(3);
    expect(initialCountQty(0, false)).toBe(0);
  });

  it('adds one on top of the saved value when accumulating', () => {
    expect(initialCountQty(null, true)).toBe(1);
    expect(initialCountQty(3, true)).toBe(4);
    expect(initialCountQty(0, true)).toBe(1);
  });
});
```

- [ ] **Step 2: Run** `npx jest src/features/counting/__tests__/initialCountQty.test.ts` — confirm FAIL.

- [ ] **Step 3: Implement** `src/features/counting/initialCountQty.ts`:
```ts
/**
 * Initial Counted Qty for the Asset Information screen.
 * - accumulate (reached via scan): saved + 1 (each scan adds one on save).
 * - otherwise (reached via the list view button): the saved value, or 1 for a new entry.
 */
export function initialCountQty(existingQty: number | null, accumulate: boolean): number {
  if (accumulate) return (existingQty ?? 0) + 1;
  return existingQty ?? 1;
}
```

- [ ] **Step 4: Run** the test — confirm PASS (2 tests).
- [ ] **Step 5: Commit**
```bash
git add src/features/counting/initialCountQty.ts src/features/counting/__tests__/initialCountQty.test.ts
git commit -m "feat(counting): add initialCountQty accumulation helper"
```

---

## Task 5: `ScannerView` component

**Files:** Create `src/features/scan/ScannerView.tsx`; Test `src/features/scan/__tests__/ScannerView.test.tsx`.

A controlled scanner: renders the camera (when permission granted) with a reticle + torch toggle + ~1.5s scan debounce, plus a manual code-entry field. Both the camera and the manual field report via `onScan(code)`. The test mocks `expo-camera` and exercises the manual-entry path (the camera itself is device-verified).

- [ ] **Step 1: Failing test** `src/features/scan/__tests__/ScannerView.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { initI18n, setLocale } from '../../../platform/i18n';
import { ScannerView } from '../ScannerView';

jest.mock('expo-camera', () => ({
  CameraView: () => null,
  useCameraPermissions: () => [{ granted: true }, jest.fn()],
}));

describe('ScannerView', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
    await setLocale('en');
  });

  it('reports a manually entered code and clears the field', () => {
    const onScan = jest.fn();
    render(<ScannerView onScan={onScan} />);
    fireEvent.changeText(screen.getByLabelText('Asset code'), 'AST001');
    fireEvent.press(screen.getByLabelText('Find'));
    expect(onScan).toHaveBeenCalledWith('AST001');
    expect(screen.getByLabelText('Asset code').props.value).toBe('');
  });

  it('does not submit a blank code', () => {
    const onScan = jest.fn();
    render(<ScannerView onScan={onScan} />);
    fireEvent.press(screen.getByLabelText('Find'));
    expect(onScan).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run** `npx jest src/features/scan/__tests__/ScannerView.test.tsx` — confirm FAIL (cannot find module).

- [ ] **Step 3: Implement** `src/features/scan/ScannerView.tsx`:
```tsx
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useT } from '../../platform/i18n';

const DEBOUNCE_MS = 1500;

interface Props {
  onScan: (code: string) => void;
}

export function ScannerView({ onScan }: Props) {
  const t = useT();
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const [torch, setTorch] = useState(false);
  const lastScanRef = useRef(0);

  const handleBarcode = (data: string) => {
    const now = Date.now();
    if (now - lastScanRef.current < DEBOUNCE_MS) return;
    lastScanRef.current = now;
    onScan(data);
  };

  const submitManual = () => {
    const code = manual.trim();
    if (!code) return;
    onScan(code);
    setManual('');
  };

  return (
    <View style={styles.container}>
      {permission?.granted ? (
        <View style={styles.cameraWrap}>
          <CameraView
            style={StyleSheet.absoluteFill}
            enableTorch={torch}
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'code128', 'code39'] }}
            onBarcodeScanned={({ data }) => handleBarcode(data)}
          />
          <View style={styles.reticle} pointerEvents="none" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={torch ? t('scan.torchOff') : t('scan.torchOn')}
            style={styles.torchBtn}
            onPress={() => setTorch((v) => !v)}
          >
            <Text style={styles.torchText}>{torch ? t('scan.torchOff') : t('scan.torchOn')}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.permission}>
          <Text style={styles.permissionText}>{t('scan.permissionMessage')}</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.grantBtn}
            onPress={() => void requestPermission()}
          >
            <Text style={styles.grantText}>{t('scan.grantPermission')}</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.manual}>
        <Text style={styles.manualLabel}>{t('scan.manualEntry')}</Text>
        <View style={styles.manualRow}>
          <TextInput
            style={styles.manualInput}
            value={manual}
            onChangeText={setManual}
            placeholder={t('scan.manualPlaceholder')}
            accessibilityLabel={t('scan.manualPlaceholder')}
            autoCapitalize="characters"
            autoCorrect={false}
            onSubmitEditing={submitManual}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('scan.submit')}
            style={styles.submitBtn}
            onPress={submitManual}
          >
            <Text style={styles.submitText}>{t('scan.submit')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  cameraWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  reticle: {
    width: 220,
    height: 220,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  torchBtn: {
    position: 'absolute',
    bottom: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  torchText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  permissionText: { color: '#fff', fontSize: 15, textAlign: 'center' },
  grantBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12 },
  grantText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  manual: { backgroundColor: '#fff', padding: 12, gap: 6 },
  manualLabel: { fontSize: 12, color: '#94a3b8' },
  manualRow: { flexDirection: 'row', gap: 8 },
  manualInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  submitBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
```

- [ ] **Step 4: Run** the test — confirm PASS (2 tests).
- [ ] **Step 5: Run** `npx tsc --noEmit` — confirm clean.
- [ ] **Step 6: Commit**
```bash
git add src/features/scan/ScannerView.tsx src/features/scan/__tests__/ScannerView.test.tsx
git commit -m "feat(scan): add ScannerView (camera + torch + manual entry)"
```

---

## Task 6: Standalone Scan tab

**Files:** Modify `app/(tabs)/scan.tsx`.

Glue — verified by typecheck + manual QA. Resolves a scanned/typed code and routes to the read-only asset detail, or alerts when not found.

- [ ] **Step 1: Replace the contents of `app/(tabs)/scan.tsx` with:**
```tsx
import { Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useT } from '../../src/platform/i18n';
import { Header } from '../../src/ui/Header';
import { ScannerView } from '../../src/features/scan/ScannerView';
import { useCodeResolver } from '../../src/features/scan/useCodeResolver';

export default function ScanScreen() {
  const t = useT();
  const router = useRouter();
  const resolver = useCodeResolver();
  return (
    <SafeAreaView style={styles.container}>
      <Header title={t('scan.title')} />
      <ScannerView
        onScan={async (code) => {
          const asset = await resolver.resolve(code);
          if (asset) router.push(`/assets/${asset.id}`);
          else Alert.alert(t('scan.notFound', { code }));
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
});
```

- [ ] **Step 2: Run** `npx tsc --noEmit` — confirm clean.
- [ ] **Step 3: Commit**
```bash
git add "app/(tabs)/scan.tsx"
git commit -m "feat(scan): wire standalone Scan tab to asset resolution"
```

---

## Task 7: In-document scan screen + route

**Files:** Create `app/documents/[id]/scan.tsx`; Modify `app/_layout.tsx`.

Glue. Resolves a code; if the asset is in this document's location, pushes its Asset Information entry with `accumulate=1`; otherwise shows the "Not found Asset in location" popup.

- [ ] **Step 1: Create `app/documents/[id]/scan.tsx`:**
```tsx
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useT } from '../../../src/platform/i18n';
import { Header } from '../../../src/ui/Header';
import { ScannerView } from '../../../src/features/scan/ScannerView';
import { useCodeResolver } from '../../../src/features/scan/useCodeResolver';
import { useCountingDocument } from '../../../src/features/counting/useCountingDocument';

export default function InDocumentScanScreen() {
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const documentId = id ?? '';
  const { data: document } = useCountingDocument(documentId);
  const resolver = useCodeResolver();
  const [notFound, setNotFound] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <Header title={t('scan.title')} />
      <ScannerView
        onScan={async (code) => {
          const asset = await resolver.resolve(code);
          if (asset && document && asset.locationId === document.locationId) {
            router.push(`/documents/${documentId}/assets/${asset.id}?accumulate=1`);
          } else {
            setNotFound(true);
          }
        }}
      />
      {notFound && document ? (
        <Modal transparent animationType="fade" visible onRequestClose={() => setNotFound(false)}>
          <View style={styles.backdrop}>
            <View style={styles.dialog}>
              <Text style={styles.dialogText}>
                {t('scan.notFoundInLocation', { location: document.locationName })}
              </Text>
              <Pressable
                accessibilityRole="button"
                style={styles.okBtn}
                onPress={() => setNotFound(false)}
              >
                <Text style={styles.okText}>{t('scan.ok')}</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: '#fff', borderRadius: 12, padding: 20, gap: 12 },
  dialogText: { fontSize: 15, color: '#0f172a' },
  okBtn: {
    alignSelf: 'flex-end',
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  okText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
```

- [ ] **Step 2: Register the route in `app/_layout.tsx`.** Inside the `RouteGate` `<Stack>`, add after the `documents/[id]/assets/[assetId]` line:
```tsx
        <Stack.Screen name="documents/[id]/scan" />
```

- [ ] **Step 3: Run** `npx tsc --noEmit` — confirm clean.
- [ ] **Step 4: Commit**
```bash
git add "app/documents/[id]/scan.tsx" app/_layout.tsx
git commit -m "feat(scan): add in-document scanner with not-found-in-location popup"
```

---

## Task 8: Detail-screen Scan button

**Files:** Modify `app/documents/[id]/index.tsx`.

Add a Scan button (drafts only) to the detail screen header area that pushes the in-document scanner.

- [ ] **Step 1: Edit `app/documents/[id]/index.tsx`.** The screen already has `const router = useRouter();` and a `locked` boolean. Inside the `ListHeaderComponent` `<View>`, after the `<AssetCountToolbar … />` element, add a Scan button shown only for drafts:
```tsx
            {!locked ? (
              <Pressable
                accessibilityRole="button"
                style={styles.scanBtn}
                onPress={() => router.push(`/documents/${documentId}/scan`)}
              >
                <Text style={styles.scanText}>{t('scan.title')}</Text>
              </Pressable>
            ) : null}
```
Add `Pressable` to the `react-native` import (the file currently imports `{ ActivityIndicator, FlatList, StyleSheet, Text, View }` → add `Pressable`). Add these styles to the screen's `StyleSheet.create`:
```tsx
  scanBtn: {
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  scanText: { color: '#fff', fontSize: 15, fontWeight: '600' },
```

- [ ] **Step 2: Run** `npx tsc --noEmit` — confirm clean.
- [ ] **Step 3: Run** the full suite to confirm no regression: `CI=true npx jest 2>&1 | tail -6`. All pass.
- [ ] **Step 4: Commit**
```bash
git add "app/documents/[id]/index.tsx"
git commit -m "feat(documents): add Scan button to the detail screen"
```

---

## Task 9: Asset Information accumulate param

**Files:** Modify `app/documents/[id]/assets/[assetId].tsx`.

The Asset Information screen reads an `accumulate` query param and uses `initialCountQty` so a scan-initiated open pre-sets Counted Qty to saved + 1.

- [ ] **Step 1: Edit `app/documents/[id]/assets/[assetId].tsx`:**
(a) Add the import:
```tsx
import { initialCountQty } from '../../../../src/features/counting/initialCountQty';
```
(b) Read `accumulate` from the params — change:
```tsx
  const { id, assetId } = useLocalSearchParams<{ id: string; assetId: string }>();
```
to:
```tsx
  const { id, assetId, accumulate } = useLocalSearchParams<{
    id: string;
    assetId: string;
    accumulate?: string;
  }>();
```
(c) In the `initial` object, change the `countQty` line:
```tsx
    countQty: entry?.countQty ?? 1,
```
to:
```tsx
    countQty: initialCountQty(entry?.countQty ?? null, accumulate === '1'),
```

- [ ] **Step 2: Run** `npx tsc --noEmit` — confirm clean.
- [ ] **Step 3: Commit**
```bash
git add "app/documents/[id]/assets/[assetId].tsx"
git commit -m "feat(documents): accumulate counted qty on scan-initiated entry"
```

---

## Task 10: Slice verification (full suite, lint, format, manual QA)

**Files:** none (verification + final commit if formatting changes).

- [ ] **Step 1: Typecheck** — `npx tsc --noEmit` — no errors.
- [ ] **Step 2: Lint** — `npm run lint` — no errors (`npm run lint:fix` if autofixable, then re-run).
- [ ] **Step 3: Format** — `npm run format:check`. If it lists Slice-5 files (`src/features/scan/*`, `src/features/counting/*`, `src/platform/i18n/*`, `app/(tabs)/scan.tsx`, `app/documents/*`, `app.config.js`), run `npx prettier --write` on those specific paths (NOT unrelated files like `CLAUDE.md`), then re-check.
- [ ] **Step 4: Full suite** — `CI=true npx jest 2>&1 | tail -15` — all suites PASS (Slices 1–4 + the new scan tests).
- [ ] **Step 5: Manual QA (device or simulator — camera).** `npm start`, sign in, grant camera permission, then:
  1. **Home → Scan QR Code** → the Scan tab shows the camera with a reticle + a torch toggle + a manual "Asset code" field. Type `AST001` → **Find** → the read-only asset detail opens. Scan a real QR encoding a known code → same. An unknown code → "No asset found" alert.
  2. Open a **draft** document → the detail screen shows a **Scan QR Code** button (above the list). Tap it → in-document scanner.
  3. Type/scan a code for an asset **in this document's location** (e.g. `AST001` for Building A Floor 1) → the Asset Information screen opens with **Counted Qty = saved + 1** (1 the first time). Save → back to the scanner. Scan the same asset again → opens at the next value (accumulation). Each Save bumps the list's counted total.
  4. Type/scan a code for an asset **not in this location** (e.g. a Warehouse asset while in Building A) → **"Not found Asset in location: Building A Floor 1"** popup → **OK** returns to the scanner.
  5. Torch toggle flips the flashlight; the ~1.5s debounce prevents a single QR from firing repeatedly.
  6. On a **void/committed** document, the detail screen shows **no** Scan button.

- [ ] **Step 6: Final commit (only if Steps 2–3 changed files)**
```bash
git add -A
git commit -m "chore(scan): lint/format pass for Slice 5"
```

---

## Self-Review (run by the plan author)

**1. Spec coverage (§9 scan resolution / §12.5 "standalone + in-document resolution, not-found popup, repeat-scan accumulation"):**
- Shared full-screen scanner: camera + reticle + torch + manual entry + ~1.5s debounce (§6) — Task 5 (`ScannerView`). ✓
- Standalone (Home → `/scan`): resolve via SQLite-then-API → route to `/assets/[id]` — Tasks 3 + 6. ✓
- In-document: resolve → if in the document's location, open Asset Information; else "Not found Asset in location: {location}" popup + OK — Task 7. ✓
- Repeat-scan accumulation (qty on top of saved value) — Tasks 4 (`initialCountQty`) + 9 (`accumulate` param). ✓
- Manual "type code" fallback — Task 5. ✓
- Scan buttons wired (Home already routes to the Scan tab from Slice 2; detail Scan button) — Task 8. ✓
- i18n en + th incl. the interpolated location/code messages — Task 2. ✓

**Deliberately deferred:** Take Photo + Commit (Slice 6); standalone not-found uses a simple `Alert`; Buddhist dates.

**Device-only (not unit-tested), flagged:** the live camera barcode path (`CameraView.onBarcodeScanned`), camera-permission prompt, and torch hardware — covered by the Task 10 manual QA. The resolution, accumulation, i18n interpolation, and manual-entry submit are unit-tested.

**2. Placeholder scan:** No TBD/TODO. Every code step has complete code. ✓

**3. Type consistency:**
- `createCodeResolver(assetRepo: AssetRepo, api: CarmenApi): CodeResolver` with `resolve(code) => Promise<Asset|null>` — identical in impl (Task 3), hook (Task 3), and test (Task 3); consumed by both scan screens (Tasks 6–7). ✓
- `ScannerView { onScan: (code: string) => void }` — identical in component (Task 5), test (Task 5), Scan tab (Task 6), in-document scan (Task 7). ✓
- `initialCountQty(existingQty: number | null, accumulate: boolean): number` — impl/test (Task 4), consumed in the entry screen (Task 9). ✓
- `t`/`useT` extended signature `(key, opts?)` is backward-compatible — existing single-arg callers unaffected (Task 2). ✓
- Route `documents/[id]/scan` registered (Task 7); detail pushes it (Task 8); in-document scan pushes `documents/[id]/assets/[assetId]?accumulate=1` which the entry screen reads (Task 9). The `/assets/[id]` standalone target predates this slice. ✓
- `scan.*` i18n keys referenced by `ScannerView`, both screens, and the Scan button are all added in Task 2. ✓
