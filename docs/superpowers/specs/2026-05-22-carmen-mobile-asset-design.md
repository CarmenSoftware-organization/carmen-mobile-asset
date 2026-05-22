# Carmen Mobile Asset — Design Spec

**Date:** 2026-05-22
**Status:** Draft for review
**Reference POC:** https://demo-asset-mobile.netlify.app/

## 1. Purpose & scope

A cross-platform mobile app (iOS + Android) for hotel/restaurant front-line staff to perform physical asset counts at a property. The app connects to an existing **Carmen API** (treated as a black box for this design — we define the contract we need and stub it). Each customer gets a single-tenant deployment: one configured backend URL per app build, no in-app property switching.

Primary user job: walk through a location, scan QR / barcode labels, record what is present, save and commit a **Counting Document**. Adjacent actions (changing an asset's location, adding photos / comments) happen inside the count entry rather than as separate workflows.

### In scope for v1
- Sign in (pluggable auth boundary; default = username/password)
- Catalog sync of assets + locations
- Create / open / save-as-draft / commit Counting Documents
- QR / barcode scanning during a count
- Asset detail screen (view + edit `Count Qty`, `Location`, `Comment`; add photos)
- Resilient sync: works online, tolerates brief connectivity drops via a mutation queue
- English + Thai localization (Buddhist-calendar dates considered)

### Out of scope (v2+)
Standalone Transfers tab with approvals · standalone Condition workflow · maintenance / work orders · multi-property switching · BT-RFID sled · NFC · biometric quick-unlock (interface reserved) · conflict-resolution UI beyond retry/discard · push notifications · map / floor-plan view · in-app label printing.

## 2. Domain vocabulary

Adopted from the POC.

| Term | Meaning |
|---|---|
| **Counting Document** | A unit of audit work scoped to one Location at a moment in time. |
| **Running Number** | Server-generated formatted ID, e.g. `CNT20260522001`. Treat as a stable display key. |
| **Count Qty** | Integer recorded by staff for an asset in a Counting Document. |
| **Counted / Uncounted** | UI filter chips — derived from `Count Qty > 0` vs `null/0`. |
| **Save as Draft** | Persist a Counting Document with `status = draft`. |
| **Commit Count** | Finalize a Counting Document; server transitions `draft → committed`. |
| **Remark** | Free-text field on the asset (Carmen-side). |
| **Comment** | Free-text field on the **count entry** (added by counting staff). |

## 3. Tech stack

- **Expo SDK 51+**, TypeScript, managed workflow.
- **Navigation:** `expo-router` (file-based, built on React Navigation). Tab bar at root, modal scanner overlay.
- **Data fetching:** TanStack Query (React Query) for cache + stale-while-revalidate.
- **Ephemeral UI state:** Zustand (e.g. active count session, scanner state).
- **Persistence:** `expo-sqlite` via a thin repository layer. Holds the cached asset/location catalog, queued mutations, in-progress Counting Documents, and local photo records.
- **Networking:** single `apiClient` (fetch + interceptors) behind a typed `CarmenApi` interface. Mock implementation for dev; real implementation when the Carmen API materializes.
- **Camera / scanning:** `expo-camera` (barcode detection built in since SDK 51).
- **Photos:** `expo-image-picker`, `expo-image-manipulator`.
- **Secure storage:** `expo-secure-store` (Keychain / Keystore) for tokens.
- **i18n:** `i18next` + `react-i18next`.
- **Connectivity:** `@react-native-community/netinfo`.

### Layered boundaries

```
ui/         screens, components, navigation
  └─ depends on →
features/   count, scan, asset, photo, auth   (each owns hooks + zustand stores)
  └─ depends on →
data/       CarmenApi interface, repositories (SQLite), syncQueue, mock impl
  └─ depends on →
platform/   camera, permissions, secure storage, netinfo, config
```

Each layer can be replaced or tested in isolation. Feature code never reaches past `data/` directly into `platform/`.

## 4. Tab-bar navigation

Four tabs at the root:

1. **Home** — quick scan button; create new Counting Document; resume in-progress documents; recent activity.
2. **Scan** — opens the camera scanner immediately.
3. **Documents** — list of Counting Documents, filterable by `Draft` / `Committed` (Draft sub-grouped into "Untouched" and "In progress" based on whether any entries are counted).
4. **More** — settings, server / config info, sync status, sign out, app version, scanner test page.

Modal / pushed screens (not in the tab bar):

- `/scan` — full-screen scanner with reticle, torch, manual code entry.
- `/documents/[id]` — Counting Document detail (header + filter chips + asset list).
- `/documents/new` — location-pick modal then create.
- `/documents/[id]/entries/[entryId]` — count-entry screen (Qty stepper, Location dropdown, Comment, Take Photo, Save). Works for both expected and unexpected entries.
- `/assets/[id]` — read-only asset detail when scanned outside a count.
- `/photo/capture?entryId=...` — camera capture screen.
- `/auth/sign-in` — modal shown when no valid token.

Header is consistent across screens, with a **sync indicator** (queued count + last-success timestamp; tap to force sync).

## 5. Data model

All entities are persisted in SQLite with the same field names used in API payloads, with a `syncedAt` column for cache management.

### Asset (read-only from mobile)
```
Asset {
  id, code, name, category, department,
  locationId, locationName,
  quantity, remainQty,
  price, currency, totalAmount,
  inputDate, acquireDate, assetLife,
  remark, imageUrl,
  updatedAt
}
```
`assetLife` is a server-formatted string (e.g. `"2 ปี 4 เดือน"`) — the app renders it verbatim.

### Location
```
Location {
  id, name, updatedAt
}
```
Flat in v1 (matches POC). A future tree representation can be added without breaking changes.

### CountingDocument
```
CountingDocument {
  id (uuid generated on-device),
  runningNumber? (server-assigned on first sync),
  locationId, locationName,
  status (draft | committed),
  countDate, commitDate?,
  description,
  createdBy, createdAt,
  entries: CountEntry[]
}
```
A document stays in `draft` from creation until **Commit Count** is invoked. The Documents list filters on whether the draft has any non-zero entries to distinguish "untouched" from "in progress" — this is a UI affordance, not a stored state.

### CountEntry
```
CountEntry {
  id (uuid),
  documentId,
  assetId | unknownCode,        // either an expected asset or a surprise scan
  countQty (integer, default 0),
  location (optional override — present if user changed location during count),
  comment (free text),
  photoIds[],
  scannedAt, updatedAt
}
```

### Photo
```
Photo {
  id (uuid generated on-device),
  entryId,
  localUri, remoteUrl?,
  capturedAt,
  uploadStatus (queued | uploading | done | failed),
  attempts, lastError?
}
```

### PendingMutation (the offline queue)
```
PendingMutation {
  id (uuid), idempotencyKey (uuid),
  kind ("document.upsert" | "document.commit" | "entry.upsert" | "photo.upload"),
  payload (JSON),
  createdAt, attempts, lastError?,
  status (pending | in_flight | failed)
}
```

### Design notes
- **Idempotency keys on every mutation.** Each enqueue generates a UUID; the server is expected to honour `Idempotency-Key` and return the same response for repeats.
- **Photos get a local UUID before upload.** Count entries reference the photo by ID immediately so the record is valid even with the upload still queued.
- **Counting Document IDs are generated on-device** to keep drafts usable offline. The `runningNumber` is assigned only when the server first persists the document.

## 6. API contract (required from the Carmen backend)

### Conventions
- REST + JSON over HTTPS. Bearer token in `Authorization` header.
- All mutating endpoints **must** accept and honour an `Idempotency-Key` header (UUID).
- Cursor pagination on list endpoints: `?cursor=...&limit=...`.
- `ETag` + `If-None-Match` on cacheable GETs.
- Errors: `{ code, message, details? }` with stable string codes (e.g. `asset.not_found`, `document.already_committed`).

### Endpoints

| Workflow | Method + path | Notes |
|---|---|---|
| Auth | `POST /auth/token` | Default body `{username, password}` → `{token, expiresAt, user}`. Pluggable. |
| Auth | `POST /auth/refresh` | Body `{refreshToken}` → new `{token, expiresAt}`. |
| Catalog | `GET /assets?updatedSince=...&cursor=...&limit=...` | Incremental list incl. tombstones for deletes. |
| Catalog | `GET /locations?updatedSince=...` | Incremental. |
| Lookup | `GET /assets/by-code/{code}` | Resolves a scanned QR / barcode. |
| Lookup | `GET /assets/{id}` | Full detail incl. recent history. |
| Documents | `POST /counting-documents` | Body includes client-generated `id` + `locationId`. Server returns `runningNumber`. |
| Documents | `GET /counting-documents?status=...` | List, filterable. |
| Documents | `GET /counting-documents/{id}` | Full document incl. entries. |
| Documents | `PUT /counting-documents/{id}/entries` | Bulk upsert of entries (idempotent). |
| Documents | `POST /counting-documents/{id}/commit` | Finalize. May return `document.already_committed`. |
| ~~Asset moves~~ | *(none — see note below)* | Location changes inside a count entry are recorded on the **entry**, not as a separate asset-move call. |
| Photos | `POST /uploads` | Multipart; returns `{photoId, remoteUrl}`. |
| Misc | `GET /me` | User profile + permissions. |
| Misc | `GET /server-info` | Version, feature flags, min-client-version. |

### Location-change semantics

When the user changes an asset's `Location` dropdown inside a count entry, the mobile app records this as `CountEntry.location` (the observed location at count time). The server is responsible for deciding whether this triggers an asset relocation, requires manager approval, or is just an audit record — the mobile app does **not** call a separate "move asset" endpoint. This keeps mobile logic simple and lets Carmen's existing back-office workflow stay authoritative.

### Two non-negotiable backend requirements
1. **`Idempotency-Key` on every POST** — without it, retries after a network blip will double-create records.
2. **`updatedSince` cursor on `/assets` and `/locations`** — without an incremental endpoint, every reconnect re-downloads the full catalog.

### Mock implementation
A `MockCarmenApi` ships with the app behind the same interface: in-memory + SQLite-backed dataset, artificial latency, and a "go offline" toggle exposed in the More tab during dev. Swap at runtime via config so we can demo without a real server.

## 7. Resilience & sync strategy

### Read path
1. On launch / login, kick off an **incremental catalog sync** for assets + locations (`GET /assets?updatedSince=...`). Land in SQLite.
2. App reads from SQLite first via the repository layer.
3. React Query refetches in the background (stale-while-revalidate).
4. Scanned-code lookup tries SQLite first (instant); falls back to `GET /assets/by-code/{code}` if not cached.

### Write path
1. All mutations go through `mutationQueue.enqueue(...)`. **Never** call the network directly from feature code.
2. Each enqueue generates an idempotency key + persists to the `PendingMutation` table.
3. A `syncWorker` drains the queue when `netinfo` reports connectivity. Exponential backoff on transient failures (2s → 60s, max 6 attempts).
4. On app backgrounding, one final drain attempt before suspension.
5. **Server-rejected mutations** (e.g. `document.already_committed`) surface as a toast + a "Sync issues (N)" banner that opens a list where the user can retry or discard. No automatic merge logic in v1.

### Sync indicator
Persistent in the header: queued count + last successful sync timestamp. Tap → force sync.

## 8. Scanner subsystem

- Single `<Scanner>` component using `expo-camera`. Handles QR + common 1D barcodes (Code128, EAN-13, etc.; configurable).
- **Debounce** scans (~1.5s) so the same code can't double-fire.
- **Three resolution paths** for a scanned code:
  1. Inside an active Counting Document → increment `Count Qty` on the matching row; if the code isn't in the document, prompt *"Add as unexpected asset?"*.
  2. Outside a document → route to `/assets/[id]`.
  3. Code doesn't resolve to any known asset → toast *"Unknown code: XYZ"*; offer manual lookup.
- **Manual fallback** ("Type code") always visible on the scanner overlay — covers damaged labels.
- **Torch toggle** and **permission re-prompt** with a friendly recovery screen if denied.

## 9. Photos

- Capture via `expo-image-picker` / `expo-camera`.
- **Resize & compress** with `expo-image-manipulator`: 1600 px max edge, JPEG quality ~0.75. Target < 200 KB without losing readable detail.
- Local-first: assign UUID + local file URI, persist to SQLite, reference from the count entry immediately.
- Enqueue a `photo.upload` mutation; the sync worker streams the file to `POST /uploads` and patches the row with `remoteUrl`.
- Local file kept until upload succeeds and is acknowledged; cleanup in a background pass.
- UI shows a "pending upload" badge on photos whose `uploadStatus !== "done"`.

## 10. Auth boundary

A single `AuthStrategy` interface:

```ts
interface AuthStrategy {
  signIn(credentials: unknown): Promise<Session>;
  refresh(): Promise<Session>;
  signOut(): Promise<void>;
  currentToken(): string | null;
}
```

- **Default implementation:** username + password → `POST /auth/token`. Bearer token, refresh on 401.
- **Token storage:** `expo-secure-store` (Keychain / Keystore). Never AsyncStorage.
- **Pluggable:** an OIDC / SSO implementation can drop in without touching feature code. Strategy chosen at build time via the per-customer config.
- **Session expiry UX:** on 401, API client attempts one refresh; if that fails, bounce to `/auth/sign-in` modal with a "session expired" banner. Queued mutations stay queued until re-auth succeeds.
- **Biometric quick-unlock:** v1.1. Hook reserved in the interface.

## 11. Configuration, i18n, deployment

### Per-customer config
A `config.<customer>.ts` file selected at build time via env:
```bash
APP_CUSTOMER=acme-hotel npx expo run:ios
```
Holds: server base URL, customer brand name, primary colour, auth strategy choice, feature flags.

### App identity
Each customer build produces its own bundle ID, display name, and icon — driven by `app.config.ts` reading the same env. EAS Build profiles per customer.

### i18n
- `i18next` + `react-i18next`.
- Two locales at launch: **`en`** (UI default) and **`th`**.
- Asset / location values flow through unchanged — they may already be Thai from the API.
- Dates: `Intl.DateTimeFormat`. Use **Buddhist calendar** (`th-TH-u-ca-buddhist`) when locale = `th` so years render as B.E. (Carmen customers expect this).

### Distribution
- Staging: TestFlight (iOS) + Play Internal Track.
- Production: EAS Submit per customer when ready.
- Dev: Expo Go for in-house iteration; release builds via EAS dev clients / standalone.

## 12. Testing approach

- **Unit (Jest + ts-jest):** repositories, sync queue, idempotency-key logic, scanner debouncer, count-quantity reducer, i18n key coverage. Target ~70% line coverage on `data/` and `features/`.
- **Component (React Native Testing Library):** each screen's behaviour with mocked `CarmenApi` and in-memory SQLite. No snapshots — assertion-based.
- **Integration (Jest):** end-to-end through `MockCarmenApi ↔ syncQueue ↔ SQLite`. Toggle "offline", perform counts, toggle back, assert server state matches local.
- **E2E (Maestro):** smoke flows on iOS Simulator + Android Emulator in CI — sign in, create Counting Document, scan, save draft, commit. YAML in `e2e/`. One real-device run per release.
- **CI (GitHub Actions):** lint + typecheck + unit/component on every PR; integration nightly; Maestro on release branches.
- **Manual:** a "scanner test page" inside the More tab exposes the scanner outside any workflow — useful for QA on different label printers and lighting.

## 13. Open questions for the backend team

When the Carmen API team is ready, these are the things we need confirmed:

1. Does the Carmen backend currently support `Idempotency-Key` on POSTs? If not, what's the path to adding it?
2. Is there an existing `updatedSince` style cursor on `/assets` and `/locations`, or do we need a new endpoint?
3. What auth scheme is expected? (Token? OIDC? Per-property keys?)
4. Where do photos go? Direct upload to a Carmen-owned endpoint, or pre-signed URLs to object storage?
5. Is the `runningNumber` format (`CNT<yyyymmdd><seq>`) generated server-side, and is it guaranteed unique?
6. When a count entry records a different `location` than the asset's current one, what does the server do with that signal? (Audit-only? Auto-relocate? Open a relocation request?) Mobile records the observed location on the entry; the rest is your call.

## 14. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Carmen API ends up incompatible with the contract above | Mock implementation lets us build + demo independently; we surface gaps early via the open-questions list. |
| Camera barcode detection is slow / unreliable on low-end Android devices | `expo-camera` has known performance; we keep manual entry one tap away as fallback. Test plan includes low-end Android device. |
| Conflict-rejected mutations confuse users | v1 surfaces a clear "Sync issues" banner with retry/discard. v2 adds conflict-resolution UI. |
| Thai users expect Buddhist-calendar dates and we miss this | Plan calls out Buddhist calendar from day one; locale-driven not hard-coded. |
| Per-customer builds proliferate and complicate releases | EAS Build profiles keep this declarative; one config file per customer. Acceptable for first ~5–10 customers; revisit if it scales further. |
