# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Cross-platform Expo + TypeScript mobile app (iOS + Android) for hotel/restaurant staff to perform physical asset counts against a single-tenant **Carmen API**. Each customer gets one backend URL baked into the build — no in-app property switching.

Development is **plan-driven**: design specs live in `docs/superpowers/specs/`, task-by-task implementation plans in `docs/superpowers/plans/`. Read the relevant spec/plan before extending a feature. The `CarmenApi` interface (`src/data/api/carmenApi.ts`) declares counting-document / scan / photo endpoints that are intentionally **not yet implemented** (`HttpCarmenApi` throws `not_implemented`); those land in later plans.

## Commands

```bash
npm start            # expo start (then press i / a / w, or scan QR)
npm run ios          # expo start --ios
npm run android      # expo start --android
npm test             # jest (all)
npm run test:watch   # jest --watch
npm run lint         # eslint .   (lint:fix to autofix)
npm run typecheck    # tsc --noEmit  (strict mode)
npm run format       # prettier --write .  (format:check to verify)
```

Run a single test file or pattern:
```bash
npx jest src/data/sync/__tests__/syncWorker.test.ts
npx jest -t "drains the queue"
```

Build for a specific customer (selects config at build time):
```bash
APP_CUSTOMER=acme-hotel npx expo run:ios
APP_API_IMPL=http APP_SERVER_BASE_URL=https://... npx expo start  # env overrides
```

## Architecture

### Layered structure with strict import boundaries

The `src/` tree is four layers; imports only flow **downward**. Each layer's `README.md` states its rule — honor it when adding code:

- **`platform/`** — config, i18n, secure storage, netinfo. Most stable; depends on nothing else.
- **`data/`** — SQLite repos, the `CarmenApi` client, mutation queue, sync worker. May import `platform/`. **Never** `features/` or `ui/`.
- **`features/`** — per-domain modules (`auth/`, `asset/`, `sync/`), owning hooks + Zustand stores + feature components. May import `data/`. **Never** `ui/`.
- **`ui/`** — presentational components. May import `features/` hooks. **Never** `data/` or `platform/`.

`app/` holds expo-router file-based routes (the `(tabs)` group, `auth/sign-in`, `assets/`, `sync` modal).

### Dependency-injection style

Most modules are **factory functions** (`createAssetRepo`, `createSyncWorker`, `createMutationQueue`, `createPasswordAuthStrategy`, `createAuth`, `createCarmenApi`) that take their dependencies and return a plain object implementing an interface. This is what makes the layer swappable and tests hermetic — prefer this pattern over classes/singletons when adding modules. (`ApiClient` / `HttpCarmenApi` / `MockCarmenApi` are the deliberate class exceptions.)

### Boot sequence (`app/_layout.tsx`)

`RootLayout` runs `initI18n() → openDatabase() → createAuth()` once, shows a spinner until ready, then nests providers: `QueryClient → Db → CarmenApi → MutationQueue → AuthBundle`. The `MutationQueue` is created once from the db and shared via `MutationQueueProvider` so UI mutation hooks enqueue through the same instance the sync worker drains. Inside it mounts:
- **`SyncInfrastructure`** — when a session exists, consumes the shared `mutationQueue` (via `useMutationQueue()`), wires the `syncWorker` to it (driven by netinfo + queue events), and kicks off `catalogSync`.
- **`RouteGate`** — a `Stack` whose effect redirects on auth status (`signedOut` → `/auth/sign-in`, `signedIn` while in the auth group → `/`). Modal routes (`auth/sign-in`, `sync`) use `presentation: 'modal'`.

### Per-customer config (build-time)

`APP_CUSTOMER` selects a JSON file under `src/platform/config/customers/` (currently only `default.json`). `app.config.js` reads it at build time (plain JSON to avoid TS transpile issues); `loadConfig()` reads it at runtime with env overrides (`APP_SERVER_BASE_URL`, `APP_API_IMPL`). The slug derives the iOS/Android bundle id, the SQLite filename (`carmen-{slug}.db`), and the secure-store session key — so two customer builds are fully isolated on-device.

### CarmenApi: pluggable backend

`createCarmenApi()` returns `MockCarmenApi` (default, `apiImpl: 'mock'`) or `HttpCarmenApi` (`apiImpl: 'http'`). `ApiClient` centralizes HTTP: it maps status codes to `CarmenApiErrorCode`, attaches the bearer token, and on a `401` calls `onUnauthenticated()` (→ `strategy.refresh()`) and retries **once**.

### Auth

`AuthStrategy` interface with `PasswordAuthStrategy` as the default. The strategy holds the in-memory session and persists it via `sessionStore` (`expo-secure-store`). `useAuthStore` (Zustand) exposes `status` (`loading | signedOut | signedIn`) + `session` and is the single source the `RouteGate` reads.

### Data layer

Repos depend on `SqlExecutor` (a 4-method interface wrapping `expo-sqlite`), never on `expo-sqlite` directly — this is the seam tests exploit. Schema changes go in `src/data/db/migrations.ts` as a new entry with a **strictly ascending** `version`; `runMigrations` applies anything above `PRAGMA user_version`. The DB opens with `WAL` + `foreign_keys` pragmas.

### Sync

- **`catalogSync`** — pulls assets via cursor pagination with `updatedSince` + tombstone deletes, then locations; persists the high-water cursor in the `_meta` table.
- **`mutationQueue`** — wraps `pendingMutationRepo` and notifies subscribers on every change.
- **`syncWorker`** — drains one mutation at a time. `markInFlight` acts as a lease to prevent concurrent double-fire. Retries with `BACKOFF_MS` exponential backoff; `PERMANENT_ERROR_CODES` (`unauthenticated`, `conflict`, `not_implemented`, `not_found`) fail the mutation immediately.
- **`syncStore`** (Zustand) — `status / queued / lastSuccessAt / lastError`, surfaced by `<SyncIndicator />` and the `/sync` modal.

## Testing

Jest with the `jest-expo` preset + `@testing-library/react-native`. Tests live in `__tests__/` dirs next to the code (`*.test.ts[x]`). Database-layer tests use **`better-sqlite3` in-memory** via `src/data/db/__tests__/testDb.ts` (`makeMigratedTestDb()`) rather than `expo-sqlite` — the `SqlExecutor` abstraction makes this swap transparent. When adding a repo/sync test, build its executor from `testDb.ts`.
