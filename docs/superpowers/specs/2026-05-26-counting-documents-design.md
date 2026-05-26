# Counting Documents (Asset Checker) — Design Spec

**Date:** 2026-05-26
**Status:** Draft for review
**Plan slot:** Plan 3 (follows Plan 1 foundation + Plan 2 data/auth/catalog)
**Source requirements:** Customer "Asset Checker" spec v1.1 / v1.2 (Chatchai Teeropas, Jun 2025) + step walkthrough doc.
**Supersedes (where conflicting):** Counting-Document sections of `2026-05-22-carmen-mobile-asset-design.md`.

## 1. Purpose & scope

Implement the customer-facing **Asset Checker**: from the Home screen a staff member can scan an asset, create a **Counting Document** scoped to one Location, count the assets in that location (by browsing, typing, or scanning), edit per-count observations, save as draft, and commit. A separate list lets them re-open drafts and void documents.

The catalog sync, auth, mutation queue, and sync worker already exist (Plans 1–2). This plan adds the counting-document data layer, fleshes out the `CarmenApi` counting methods (mock + http), wires the sync worker's result write-back, and builds the screens.

### In scope
- Home actions: Scan QR Code, Create New Counting Document, View All.
- Create / open / save-as-draft / commit / **void** a Counting Document (one Location each).
- Counting-document detail: asset-to-count list, All/Counted/Uncounted filter, search, category filter + sort, inline Counted Qty editing.
- Asset Information (count-entry) screen: view asset, edit per-count observations (Location, Serial No, Specification, Remark, Comment), Counted Qty stepper, take photo, discard guard.
- QR/barcode scan, standalone and inside a document (with "not found in location" handling and repeat-scan accumulation).
- Server-assigned running number (`CDYYMMNNNN`) written back to the device on sync.

### Out of scope (unchanged from base spec)
Standalone transfers/condition workflows, maintenance, multi-property switching, conflict-resolution UI beyond retry/discard, push notifications, floor-plan view, label printing. Photos compression pipeline reuses the base-spec approach; no new photo features beyond capture + queued upload.

### Decisions locked during brainstorming
1. **Asset edits are recorded on the count entry**, not on the catalog asset. The catalog stays read-only; the server decides what to do with observed values.
2. **Running number is assigned server-side on sync.** Offline, the document shows the running number as "pending" until the `document.upsert` mutation syncs.
3. **Navigation keeps the existing 4-tab bar.** The Home tab surfaces the three customer actions prominently.
4. **The document list shows status filter chips** (Draft / Committed / Void), defaulting to Draft.

## 2. Domain vocabulary (additions to base spec)

| Term | Meaning |
|---|---|
| **Running Number** | Server-assigned formatted ID `CD<YY><MM><NNNN>` derived from `countDate`, e.g. `CD25060001`. `null` (shown as "pending") until the document first syncs. |
| **Status** | `draft` → `committed` (via Commit Count) or `draft` → `void` (via Void). Committed and Void are terminal. |
| **Counted / Uncounted** | UI filter — `Counted` = a count entry with `countQty > 0` exists for the asset; `Uncounted` otherwise. |
| **Observation** | A per-entry value the counter recorded (Location override, Serial No, Specification, Remark, Comment) that does not mutate the catalog asset. |
| **Transfer date** | Read-only entry field set to the timestamp of the most recent Save Asset Count. |

## 3. Data model

### 3.1 Catalog `Asset` (read-only) — additions
Add two nullable fields surfaced on the Asset Information screen:
```
serialNo: string | null
specification: string | null
```
These are baseline values from Carmen. Requires: a migration adding the columns, `seedData` updates, and mapping in `httpCarmenApi`/`mockCarmenApi` list/get responses. The Asset Information screen prefills from these and stores any change as an entry observation.

### 3.2 `CountingDocument` (new table `counting_document`)
```
CountingDocument {
  id            // uuid, generated on-device
  runningNumber // string | null — server-assigned on sync; null = "pending"
  locationId
  locationName  // immutable after create
  status        // 'draft' | 'committed' | 'void'
  countDate     // editable while draft; defaults to today
  commitDate    // string | null — set on commit
  description   // editable while draft
  createdBy
  createdAt
  updatedAt
  syncedAt      // string | null — cache/reconciliation marker
}
```
`status` extends the existing `CarmenApi.CountingDocument` union with `'void'`.

### 3.3 `CountEntry` (new table `count_entry`)
Existing interface plus observation fields:
```
CountEntry {
  id                    // uuid
  documentId
  assetId | unknownCode // expected asset, or surprise scan
  countQty              // integer, default 0 (Asset Information defaults the editable value to 1)
  location              // observed-location override (string | null)
  observedSerialNo      // string | null   (NEW)
  observedSpecification // string | null   (NEW)
  observedRemark        // string | null   (NEW)
  comment               // free text
  photoIds[]
  transferDate          // string | null — = last Save Asset Count timestamp (NEW)
  scannedAt
  updatedAt
  syncedAt
}
```

### 3.4 `Photo` (new table `photo`)
```
Photo {
  id            // uuid generated on-device
  entryId
  localUri
  remoteUrl     // string | null
  capturedAt
  uploadStatus  // 'queued' | 'uploading' | 'done' | 'failed'
  attempts
  lastError     // string | null
}
```

### 3.5 Repos & migration
New factory repos following the established pattern (`SqlExecutor`-backed): `countingDocumentRepo`, `countEntryRepo`, `photoRepo`. One new entry in `migrations.ts` with a strictly-ascending `version` creating the three tables and the two `asset` columns.

## 4. API contract & mock

No new `CarmenApi` methods — the six already-declared counting methods cover everything. Changes:

- Extend `CountingDocument.status` with `'void'`; extend `CountEntry` with the four new fields (§3.3).
- **Void = `upsertCountingDocument({ ...doc, status: 'void' })`.** No new mutation kind or endpoint. The trash action only appears on drafts.
- **Mock** becomes stateful: holds documents + entries in memory, assigns `runningNumber = 'CD' + YY + MM + NNNN` from `countDate`'s year/month with a per-month counter, transitions status on commit/void, and returns the updated document. Keeps the existing artificial latency + offline toggle.
- **HTTP** implements `listCountingDocuments`, `getCountingDocument`, `upsertCountingDocument`, `upsertCountEntries`, `commitCountingDocument`, `uploadPhoto` (replacing the current `not_implemented` throws), per the endpoint table in the base spec §6.

## 5. Sync & the running-number write-back

All writes flow through `mutationQueue` (kinds already defined: `document.upsert`, `document.commit`, `entry.upsert`, `photo.upload`); reads come from SQLite via React Query. The sync worker already dispatches all four kinds.

**New: result reconciliation.** Today `performMutation` discards the API response. Server-assigned values (`runningNumber`, `commitDate`, `status`) must land back in local SQLite. We add a lightweight reconciliation hook to the sync worker so that after a successful:
- `document.upsert` → write the returned document's `runningNumber`/`status` and stamp `syncedAt` on the local row;
- `document.commit` → write the returned `commitDate`/`status`;
- `entry.upsert` → stamp `syncedAt` on the entries;
- `photo.upload` → patch the photo's `remoteUrl` + `uploadStatus = 'done'`.

The hook keeps the worker generic (it receives a reconciler callback wired in `SyncInfrastructure` with repo access) rather than importing repos directly. Until reconciliation runs, the document UI shows the running number as "pending".

## 6. Navigation & screens

Keep the four root tabs (Home / Scan / Documents / More). New and modified screens:

| Route | Purpose |
|---|---|
| `(tabs)/index` (Home) | Three actions: **Scan QR Code**, **Create New Counting Document**, **View All**. |
| `(tabs)/documents` | View-All list. Status chips (Draft default / Committed / Void). Per row: running#, status, location, count date, total assets counted, **view (eye)**, **void (trash — drafts only)**. |
| `/documents/new` | Location-pick modal → create draft → route to detail. |
| `/documents/[id]` | Counting-document detail (see §7). |
| `/documents/[id]/entries/[entryId]` | Asset Information / count entry (see §8). |
| `/scan` | Shared full-screen scanner (reticle, torch, manual entry, ~1.5s debounce). |
| `/assets/[id]` | Read-only asset detail (standalone scan target). |

## 7. Counting-document detail behavior

- **Header:** running number (or "pending"), status badge, location (read-only), count date (editable while draft), commit date, description (editable while draft).
- **Asset-to-Count list** = catalog assets where `asset.locationId == doc.locationId`, left-joined with this document's entries. Row shows: asset code, name, category, department, input date, acquire date, asset life, remain qty, **Counted Qty** (inline editable: direct input or +/–), and a **view** button → Asset Information.
- **Filter chips:** All / Counted / Uncounted (`countQty > 0` ⇒ Counted).
- **Search:** local filter over the list by asset code, name, category, department.
- **Filter/Sort:** filter by asset category; sort by code / name / department.
- **Scan button:** opens the scanner; resolves the code against this location (see §9).
- **Floating actions:** **Save as Draft** (persists doc + enqueues `document.upsert`, status stays `draft`); **Commit Count** (confirm dialog → `commitDate = now`, status `committed`, enqueues `document.commit`, locks the document).
- **Locked state:** once `committed` or `void`, all fields, inline qty, scan, and entry editing are disabled.

## 8. Asset Information (count-entry) behavior

Single-column layout, fields in order: asset image, Asset ID (code), name, category, input date, acquire date, remain qty, **Location** (editable dropdown), **transfer date** (read-only), **Serial No** / **Specification** / **Remark** / **Comment** (editable), **Take Photo**, **Counted Qty** (default 1, +/– or direct input), Back.

- Edits are buffered in the screen; **Save Asset Count** persists the entry to SQLite, sets `transferDate = now`, and enqueues `entry.upsert`. Editable fields write to entry observations (§3.3); the catalog asset is untouched.
- **Repeat scans accumulate:** scanning the same asset again increments `countQty` on top of the saved value after each Save Asset Count.
- **Location override:** if the saved `location` differs from the document's location, the asset drops out of this document's list (it has been observed elsewhere).
- **Take Photo:** captures an entry photo (local UUID + URI, queued `photo.upload`); does not change the asset's catalog image.
- **Discard guard:** Back with unsaved edits → popup **"Discard Change?"** with Yes (discard, return to detail) / No (stay).

## 9. Scan resolution

- **From Home (standalone):** scan → resolve via `getAssetByCode` (SQLite first, then API) → route to `/assets/[id]` read-only. Not part of any count.
- **Inside a counting document:** scan → resolve code → if the asset belongs to this document's location, open its Asset Information entry (repeat scans accumulate qty after save); if not resolvable in this location, show popup **"Not found Asset in location: {locationName}"** + **OK** (returns to the detail screen).
- Scanner debounces (~1.5s) and always offers a manual "type code" fallback.

## 10. i18n & dates

- New `en` + `th` keys for every label, chip, button, and popup ("Discard Change?", "Confirm Void?", "Not found Asset in location: {location}", status names).
- Dates render via `Intl.DateTimeFormat`; when locale = `th`, use the Buddhist calendar (`th-TH-u-ca-buddhist`) so years show as B.E. — consistent with the customer's `CD2506…` example.
- Asset/location values pass through unchanged (may already be Thai from the API).

## 11. Testing

- **Repos:** `better-sqlite3` in-memory via `testDb.ts` — CRUD + the asset-to-count join + the location-override-hides-from-list rule.
- **Mock API:** stateful behavior — running-number format/sequence per month, commit/void transitions.
- **Sync worker:** reconciliation write-back — a synced `document.upsert` lands the `runningNumber` locally; `photo.upload` patches `remoteUrl`.
- **Components (RNTL + MockCarmenApi + in-memory SQLite):** detail list (chips/search/sort, inline qty), count-entry screen (discard guard, qty accumulation, location-override hide), scan-not-found popup, void confirm.
- Targets the base spec's ~70% line coverage on `data/` and `features/`.

## 12. Build sequence (vertical slices)

1. **Data layer + mock:** migration (tables + asset columns), three repos, stateful `MockCarmenApi`, sync-worker reconciliation hook, HTTP impl. Tests.
2. **Create + View-All:** Home actions, location-pick create, document list with status chips + void.
3. **Detail list:** asset-to-count list, All/Counted/Uncounted, search, filter/sort, inline Counted Qty.
4. **Asset Information:** count-entry screen, observation edits, qty stepper, discard guard, Save Asset Count.
5. **Scan:** standalone + in-document resolution, not-found popup, repeat-scan accumulation.
6. **Photos + Commit + HTTP hardening:** take-photo capture/upload, Commit Count lock, finalize HTTP endpoints.

## 13. Open questions for the backend team (additions to base spec §13)

1. Is the running-number format confirmed as `CD<YY><MM><NNNN>` keyed on **count date** (not commit date), and is the sequence global per month or per location?
2. Does the server accept the new entry observation fields (`observedSerialNo`, `observedSpecification`, `observedRemark`, `location`, `transferDate`) on the bulk-entry upsert, and what does it do with an observed-location change?
3. Is `void` a supported document status transition, and is it allowed only from `draft`?
4. Do assets expose `serialNo` and `specification` in the `/assets` payload?
