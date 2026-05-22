# Plan 2 — Data Layer, Auth, Catalog Browse — Design Supplement

**Date:** 2026-05-22
**Status:** Draft for review
**Parent spec:** `2026-05-22-carmen-mobile-asset-design.md` (commit `1503f25`)
**Foundation:** Plan 1 shipped at `origin/main` (head `11db027`).

This document narrows the parent spec to what Plan 2 ships and locks in the implementation decisions made during brainstorming. Anything not contradicted here defers to the parent spec.

## 1. Scope

### End state (demoable)
A signed-in user opens the app, sees the Home tab with a working sync indicator, taps **Browse assets**, sees a search-and-tap list of every asset synced from the (mock by default) Carmen API, and can drill into a read-only asset detail showing every field from parent §5. Pull-to-refresh re-syncs the catalog. Sign-out works.

### In scope
- SQLite database with versioned migrations.
- Repository pattern over `assets`, `locations`, `pending_mutations`, `_meta`.
- `CarmenApi` interface + `MockCarmenApi` (full) + `HttpCarmenApi` (auth + asset endpoints only).
- Runtime selection between `mock` and `http` via a new `apiImpl` field on the customer config.
- `mutationQueue` + `syncWorker` with exponential backoff and a `useSyncStatus()` hook.
- `AuthStrategy` interface + `PasswordAuthStrategy` (username/password), tokens in `expo-secure-store`.
- `authStore` (zustand) and modal sign-in route at `/auth/sign-in`.
- Asset catalog sync (`updatedSince` cursor), `useAssets()` and `useAsset(id)` hooks.
- `/assets` list route (search by name/code, pull-to-refresh).
- `/assets/[id]` detail route (read-only, all parent §5 fields).
- `<SyncIndicator />` replacing Plan 1's placeholder dot: idle/syncing/error color + tap-to-open status sheet.
- New i18n keys for auth UI, assets list/detail headings, and sync sheet copy.

### Out of scope (Plan 3 / Plan 4)
Counting documents (create/list/edit/commit) · scanner · photos · failed-mutation retry/discard UI · biometric quick-unlock · More tab settings beyond a dev-only API impl toggle · Buddhist-calendar date rendering · `expo-router` modal animation polish.

## 2. New folder layout

Plan 1 left `src/data/` and `src/features/` as documented placeholders. Plan 2 populates them:

```
src/
  data/
    db/
      index.ts           openDatabase(), connection singleton
      migrate.ts         runMigrations(db, migrations)
      migrations.ts      ordered array of { version, up }
    repos/
      assetRepo.ts
      locationRepo.ts
      pendingMutationRepo.ts
      metaRepo.ts        catalog sync cursors, last-sync timestamps
      __tests__/         per-repo tests using an in-memory sqlite
    api/
      carmenApi.ts       CarmenApi interface + DTO types
      mockCarmenApi.ts
      httpCarmenApi.ts
      apiClient.ts       fetch wrapper: auth header, idempotency, error mapping
      seedData.ts        mock seed (5–8 assets, 3 locations)
      createCarmenApi.ts factory selecting mock vs http from config
      __tests__/
    sync/
      mutationQueue.ts
      syncWorker.ts      drains queue, emits status
      catalogSync.ts     fetches /assets + /locations with updatedSince
      __tests__/
  features/
    auth/
      authStrategy.ts        interface
      passwordAuthStrategy.ts
      authStore.ts           zustand
      useAuth.ts
      SignInForm.tsx
      __tests__/
    asset/
      useAssets.ts           list + search
      useAsset.ts            by id
      AssetListItem.tsx
      AssetDetailView.tsx
      __tests__/
    sync/
      useSyncStatus.ts
      SyncIndicator.tsx      replaces inline dot in src/ui/Header.tsx
      SyncStatusSheet.tsx    modal content for tap-to-open
      __tests__/
app/
  auth/
    sign-in.tsx              modal route
  assets/
    index.tsx                /assets list
    [id].tsx                 /assets/[id] detail
  sync.tsx                   modal route for the status sheet (or in-place RN modal — see §8)
```

## 3. Data layer details

### 3.1 SQLite open
`expo-sqlite` async API:

```ts
import { openDatabaseAsync } from 'expo-sqlite';
import { loadConfig } from '../../platform/config';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function openDatabase() {
  if (!dbPromise) {
    const { customerSlug } = loadConfig();
    dbPromise = openDatabaseAsync(`carmen-${customerSlug}.db`).then(async (db) => {
      await runMigrations(db, migrations);
      return db;
    });
  }
  return dbPromise;
}
```

One DB file per customer; the connection is a process-wide singleton. Tests inject their own in-memory connection.

### 3.2 Migrations
Versioned, idempotent, applied in order. Migration runner reads `PRAGMA user_version`, runs all `up` functions with `version > current`, bumps `user_version`. Plan 2 ships only `v1`:

```ts
export const migrations: Migration[] = [
  {
    version: 1,
    async up(db) {
      await db.execAsync(`
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
      `);
    },
  },
];
```

Counting / photo tables added in Plan 3 + Plan 4 migrations (`v2`, `v3`).

### 3.3 Repositories
Each repo exports a factory `createXRepo(db)` returning an object with typed methods. Repos map between SQLite rows and domain objects:

```ts
export interface AssetRepo {
  list(opts?: { search?: string }): Promise<Asset[]>;
  findById(id: string): Promise<Asset | null>;
  findByCode(code: string): Promise<Asset | null>;
  upsertMany(assets: Asset[]): Promise<void>;
  deleteByIds(ids: string[]): Promise<void>;
}
```

Repos never call the network or other repos — they only know about their table. Cross-cutting orchestration (e.g. "sync and store") lives in `sync/catalogSync.ts`.

## 4. CarmenApi

### 4.1 Interface
One `CarmenApi` TS interface covering every endpoint listed in parent spec §6. DTO types are exported alongside. The interface is the contract; both impls satisfy it.

The interface declares every method from parent §6. Plan 2's `HttpCarmenApi` implements only the ones below; the rest are declared but throw `{ code: 'not_implemented' }` until Plan 3.

```ts
export interface CarmenApi {
  // Implemented in Plan 2 (HTTP + mock):
  signIn(creds: PasswordCredentials): Promise<Session>;
  refresh(refreshToken: string): Promise<Session>;
  listAssets(opts: { updatedSince?: string; cursor?: string; limit?: number }): Promise<Page<Asset>>;
  getAssetByCode(code: string): Promise<Asset | null>;
  getAsset(id: string): Promise<Asset | null>;
  listLocations(opts: { updatedSince?: string }): Promise<Location[]>;
  getMe(): Promise<UserProfile>;
  getServerInfo(): Promise<ServerInfo>;

  // Declared but throw 'not_implemented' in Plan 2's HttpCarmenApi
  // (MockCarmenApi may implement them for use in later plans' tests):
  listCountingDocuments(opts: { status?: 'draft' | 'committed' }): Promise<CountingDocument[]>;
  getCountingDocument(id: string): Promise<CountingDocument | null>;
  upsertCountingDocument(doc: CountingDocument): Promise<CountingDocument>;
  upsertCountEntries(documentId: string, entries: CountEntry[]): Promise<void>;
  commitCountingDocument(id: string): Promise<CountingDocument>;
  uploadPhoto(file: PhotoUpload): Promise<{ photoId: string; remoteUrl: string }>;
}
```

Every DTO type (`PasswordCredentials`, `Session`, `Asset`, `Page<T>`, `Location`, `UserProfile`, `ServerInfo`, `CountingDocument`, `CountEntry`, `PhotoUpload`) is exported from `carmenApi.ts`. Shapes match parent §5 (data model) exactly.

### 4.2 Mock implementation
Backed by `seedData.ts` (5–8 assets, 3 locations covering the demo flow). All methods work. Artificial latency configurable via a constructor option (`{ latencyMs: 150 }` by default). Internal "offline" toggle — `setOnline(false)` makes every call reject with a `network_error` code — used by tests and exposed on the dev-only More tab toggle.

### 4.3 HTTP implementation
Real `fetch` against `customerConfig.serverBaseUrl`. Covers in Plan 2: `signIn`, `refresh`, `listAssets`, `getAssetByCode`, `getAsset`, `listLocations`, `getMe`, `getServerInfo`. Methods not yet covered throw `{ code: 'not_implemented' }` — Plan 3 fills them in.

Shared concerns in `apiClient.ts`:
- Bearer token injection (reads from secure-store via auth strategy).
- `Idempotency-Key` header on every mutating call (caller supplies, client doesn't generate — the queue owns key generation).
- Error mapping: `{code, message, details?}` JSON body → typed `CarmenApiError` thrown.
- One refresh attempt on 401, then re-throw `unauthenticated` if it also fails.

### 4.4 Selection
Adds `apiImpl: 'mock' | 'http'` to `CustomerConfig` (and the JSON file). Default `'mock'`. The factory:

```ts
export async function createCarmenApi(): Promise<CarmenApi> {
  const cfg = loadConfig();
  if (cfg.apiImpl === 'http') {
    return new HttpCarmenApi(cfg.serverBaseUrl);
  }
  return new MockCarmenApi();
}
```

A More-tab developer toggle (only visible when `__DEV__`) lets you switch at runtime — useful for demos. Behind a `featureFlags.devApiToggle` flag in the customer config (defaults to `false` in production builds).

## 5. Mutation queue + sync worker

### 5.1 Queue API
```ts
export interface MutationQueue {
  enqueue<K extends MutationKind>(kind: K, payload: PayloadFor<K>): Promise<string /* mutationId */>;
  listPending(): Promise<PendingMutation[]>;
  listFailed(): Promise<PendingMutation[]>;        // Plan 4 surfaces this in UI
  discard(id: string): Promise<void>;              // Plan 4 surfaces this in UI
}
```

Each `enqueue` generates a UUID idempotency key, persists to `pending_mutations`, returns the mutation id.

### 5.2 Worker
A single `SyncWorker` started at app bootstrap (in `app/_layout.tsx` after auth + db ready). Subscribes to:
- NetInfo connectivity changes.
- A `queueChanged` event the queue emits after `enqueue`.

On each tick: load oldest `status='pending'` row, call the matching `CarmenApi` method, then either delete the row (success) or:
- Transient error (`network_error`, 5xx, idempotency conflict where server says retry) → bump `attempts`, set next attempt timestamp with exponential backoff (2, 5, 15, 30, 60, fail at 6).
- Permanent error (4xx other than 408/409 special cases) → set `status='failed'`, record `lastError`, stop.

Plan 2 only ships **catalog-side** mutations (none yet — Plan 2 is read-only except for auth). So the worker's actual work in Plan 2 is limited to catalog sync, not mutation drain. **The queue infrastructure is built and unit-tested, but no UI feature in Plan 2 enqueues anything yet.** Plan 3 starts pushing count-document mutations through it.

### 5.3 Status stream
```ts
export interface SyncStatus {
  status: 'idle' | 'syncing' | 'error';
  queued: number;
  lastSuccessAt: Date | null;
  lastError: string | null;
}

export function useSyncStatus(): SyncStatus;
```

Backed by a zustand store the worker (and catalog sync) update. `<SyncIndicator />` reads it.

## 6. Auth

### 6.1 Strategy interface
```ts
export interface AuthStrategy {
  signIn(creds: unknown): Promise<Session>;
  refresh(): Promise<Session>;
  signOut(): Promise<void>;
  currentSession(): Session | null;
}
```

### 6.2 PasswordAuthStrategy
- `signIn({username, password})` → `POST /auth/token`, stores returned `{token, refreshToken, expiresAt, user}` in secure-store with key `carmen-session-<customerSlug>`.
- `refresh()` → reads stored refresh token, calls `/auth/refresh`, replaces the session.
- `signOut()` → clears secure-store + zustand store.
- `currentSession()` returns the in-memory cached session (synchronous; loaded once at bootstrap).

### 6.3 Bootstrap
On app start, `app/_layout.tsx`:
1. Init i18n (existing).
2. Open DB + run migrations.
3. Hydrate auth from secure-store → `authStore.set({ session, status })`.
4. If signed in, create `CarmenApi`, start `SyncWorker`, trigger initial catalog sync.
5. Render `<Slot />` (which is gated by `authStore.status` — see §6.4).

### 6.4 Route gate
A new `app/_layout.tsx` wrapper checks `authStore.status`:
- `'loading'` → splash / blank.
- `'signedOut'` → redirect to `/auth/sign-in` (modal route).
- `'signedIn'` → render `(tabs)`.

### 6.5 Sign-in screen
Modal route at `app/auth/sign-in.tsx`. Two TextInputs (username, password), submit button, inline error display, loading state during the API call. On success, dismisses and lands on Home. i18n keys: `auth.title`, `auth.username`, `auth.password`, `auth.signIn`, `auth.error.invalid`, `auth.error.network`.

Sign-out: a button in More tab. On press, clears session and the route gate redirects to sign-in.

## 7. Asset catalog + UI

### 7.1 Catalog sync
`catalogSync.ts` exports `syncCatalog()`:
1. Reads `_meta.assets_updated_since` cursor.
2. Loops `carmenApi.listAssets({updatedSince, cursor})` paginating until no more.
3. Upserts batches into `assetRepo`.
4. Same for locations.
5. Writes new cursor + `lastSuccessAt` to `_meta`.
6. Updates `syncStatus` store throughout (`status='syncing'`, then `'idle'` on success).

Triggered by: (a) bootstrap after sign-in, (b) explicit pull-to-refresh on list, (c) "Sync now" button in status sheet.

### 7.2 Hooks
- `useAssets({search?: string})` — TanStack Query, key `['assets', search]`, queryFn reads from `assetRepo.list({search})`. Stale-while-revalidate. On `pull-to-refresh`, invalidates the key and triggers `syncCatalog()` first.
- `useAsset(id)` — `['asset', id]`, queryFn `assetRepo.findById(id)`.

### 7.3 Screens
- **Home updates:** add a "Browse assets" button row (visible only when signed in). i18n key `home.browseAssets`.
- **`/assets` list:** SearchBar at top → controls the `search` arg of `useAssets`. `FlatList` of `<AssetListItem code, name, category, department />`. Pull-to-refresh hook into `syncCatalog`. Loading skeleton (3 placeholder rows) on first load. Empty state ("No assets found").
- **`/assets/[id]` detail:** Header (asset name + code), image (with skeleton + fallback), then a definition list of every field. `assetLife` rendered verbatim (Thai string supported).

## 8. Sync indicator + status sheet

### 8.1 SyncIndicator
Plan 1's `src/ui/Header.tsx` has a hard-coded green dot inside a `<View accessibilityLabel="sync-status">`. Plan 2 modifies `Header.tsx` to render `<SyncIndicator />` in that slot instead, preserving the accessibility label. The new component reads `useSyncStatus()` and renders a colored dot:
- `idle` → green
- `syncing` → blue with a subtle pulse animation (`Animated.loop` / `react-native-reanimated` if already available; otherwise a simple opacity oscillation with `Animated.timing`)
- `error` → amber

Pressable; on press opens the status sheet.

### 8.2 Status sheet
Implemented as an `expo-router` modal route at `app/sync.tsx`. Shows:
- Last successful sync time (relative — "2 min ago" via Intl.RelativeTimeFormat).
- Queued mutation count (will read 0 in Plan 2 since nothing enqueues yet — but the wiring is exercised).
- "Sync now" button → calls `syncCatalog()`.

Failed-mutation list with retry/discard buttons is Plan 4.

## 9. New dependencies

Runtime:
- `expo-sqlite` (`npx expo install expo-sqlite`)
- `expo-secure-store` (`npx expo install expo-secure-store`)
- `@tanstack/react-query` (`npm install`)
- `zustand` (`npm install`)
- `@react-native-community/netinfo` (`npx expo install @react-native-community/netinfo`)

`expo-router`'s modal routing already in place from Plan 1.

No new dev deps.

## 10. Testing approach

**Unit / integration (Jest + better-sqlite3 in-memory adapter):**
- Migrations: applying `v1` to a fresh DB produces the expected schema. Re-running is a no-op. Future `v2` migration test pattern documented.
- Each repo: CRUD + edge cases (empty result, missing id, conflict on unique code).
- `pendingMutationRepo`: enqueue → list → mark-done / mark-failed.
- `mutationQueue.enqueue`: idempotency key uniqueness; emits `queueChanged` event.
- `SyncWorker` with `FakeNetInfo` + `FakeCarmenApi`: drains pending when online, backs off on transient errors, marks failed on permanent.
- `MockCarmenApi`: returns expected seed data; offline toggle rejects appropriately.
- `HttpCarmenApi` with `fetch` mocked: builds correct URL/headers; maps errors; refresh-on-401 loop runs once.
- `PasswordAuthStrategy` with FakeSecureStore + FakeApi: sign-in stores session, sign-out clears it, refresh replaces it.
- `catalogSync`: paginates `listAssets` calls and writes batches to repo; updates cursor.

**Component (RNTL):**
- `<SignInForm />`: validates inputs, shows loading on submit, calls onSubmit with `{username, password}`, displays inline error.
- `<AssetListItem />`: renders all fields.
- `<AssetDetailView />`: renders every spec §5 field correctly, handles Thai `assetLife`.
- `<SyncIndicator />`: colors match status, opens sheet on press.

**Estimated count:** ~30–40 new tests.

## 11. Open questions for backend team (carried forward)

Same as parent §13 — Plan 2's HTTP impl uses the contract assumed there. If the real Carmen backend rejects any of these assumptions when we point at it, we adjust then.

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| `expo-sqlite`'s async API in tests requires special handling | Use `better-sqlite3` in-memory adapter behind the repo factory; expose an injectable DB connection so tests substitute it. |
| react-query + zustand state can diverge for the same data (catalog) | react-query owns server-derived state (cached lists); zustand owns ephemeral UI / sync status only. Lint guideline: features only read DB through hooks, never zustand. |
| Mock API too convenient — we never test against the HTTP impl in CI | Plan 2 ships unit tests for both impls with mocked `fetch`. A future integration plan (post-v1) can wire up a docker-compose'd Carmen-API stub. |
| `expo-secure-store` requires native module rebuild — Expo Go works but a bare-build is needed for production | Documented in the README. Plan 4 will revisit when EAS Build profiles are added. |
| Sync indicator pulse animation may regress on low-end Android | Keep it simple (opacity oscillation, no transform). Optional: drop the animation if `__DEV__` or via reduced-motion env signal. |
