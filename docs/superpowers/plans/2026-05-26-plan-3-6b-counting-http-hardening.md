# Counting Documents — Slice 6b: HTTP Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the six counting/photo endpoints in `HttpCarmenApi` (replacing the `not_implemented` throws) per the §6 endpoint contract — including per-mutation idempotency keys and multipart photo upload — so the app is HTTP-backend-ready while the mock stays the default.

**Architecture:** Thread each pending mutation's existing `idempotencyKey` from the sync worker through the four mutating `CarmenApi` methods (interface + mock + worker) so POST retries are idempotent (the §6 non-negotiable). Extend `ApiClient` to send `FormData` bodies as multipart (no JSON content-type). Implement the six `HttpCarmenApi` methods against `ApiClient`, mapping the §6 paths/verbs and 404→null. All unit-tested against a mocked `fetch`; no real backend exists yet, so the contract is exercised but speculative.

**Tech Stack:** `fetch` via `ApiClient`, TypeScript (strict). Tests: Jest (`jest-expo`) with a mocked `fetch`. No UI, no new dependency.

**Spec:** `docs/superpowers/specs/2026-05-26-carmen-mobile-asset-design.md` §6 (endpoint contract: paths, verbs, `Idempotency-Key` on POSTs, multipart `/uploads`); `2026-05-26-counting-documents-design.md` §4, §12.6.

---

## Scope

- Thread `idempotencyKey` through `upsertCountingDocument` / `upsertCountEntries` / `commitCountingDocument` / `uploadPhoto` (interface + mock ignores it + worker passes `m.idempotencyKey`).
- `ApiClient` multipart (`FormData`) support.
- `HttpCarmenApi`: `listCountingDocuments`, `getCountingDocument`, `upsertCountingDocument`, `upsertCountEntries`, `commitCountingDocument`, `uploadPhoto`.

**Out of scope:** changing the default backend (mock stays default); ETag/If-None-Match caching; cursor pagination on counting-documents (the §6 list endpoint is filterable but the app doesn't page it). The endpoint response shapes are per §6 and remain provisional until the real backend confirms them (spec §13 open questions).

---

## File Structure

**Modified files**
- `src/data/api/carmenApi.ts` — add optional `idempotencyKey?: string` to the 4 mutating methods.
- `src/data/api/mockCarmenApi.ts` — accept (ignore) the new param on those 4 methods.
- `src/data/sync/syncWorker.ts` — pass `m.idempotencyKey` into the 4 calls in `performMutation`.
- `src/data/api/apiClient.ts` + `__tests__/apiClient.test.ts` — `FormData` bodies sent as-is (no JSON content-type).
- `src/data/api/httpCarmenApi.ts` + `__tests__/httpCarmenApi.test.ts` — implement the 6 methods; rewrite the `not_implemented` test into per-endpoint tests.

No DB migration, no new files.

---

## Task 1: Thread `idempotencyKey` through the mutating API methods

**Files:** Modify `src/data/api/carmenApi.ts`, `src/data/api/mockCarmenApi.ts`, `src/data/sync/syncWorker.ts`.

A signature-threading change (the optional param is backward-compatible). No new test — verified by typecheck + the full existing suite staying green; the idempotency header itself is asserted in Task 3.

- [ ] **Step 1: Interface** — in `src/data/api/carmenApi.ts`, change the four mutating method signatures in the `CarmenApi` interface to:
```ts
  upsertCountingDocument(doc: CountingDocument, idempotencyKey?: string): Promise<CountingDocument>;
  upsertCountEntries(documentId: string, entries: CountEntry[], idempotencyKey?: string): Promise<void>;
  commitCountingDocument(id: string, idempotencyKey?: string): Promise<CountingDocument>;
  uploadPhoto(file: PhotoUpload, idempotencyKey?: string): Promise<{ photoId: string; remoteUrl: string }>;
```

- [ ] **Step 2: Mock** — in `src/data/api/mockCarmenApi.ts`, add the (ignored) param to the same four methods. Change each signature's parameter list to include `_idempotencyKey?: string` as the last param, e.g.:
```ts
  async upsertCountingDocument(
    doc: CountingDocument,
    _idempotencyKey?: string,
  ): Promise<CountingDocument> {
```
```ts
  async upsertCountEntries(
    documentId: string,
    entries: CountEntry[],
    _idempotencyKey?: string,
  ): Promise<void> {
```
```ts
  async commitCountingDocument(id: string, _idempotencyKey?: string): Promise<CountingDocument> {
```
```ts
  async uploadPhoto(
    file: PhotoUpload,
    _idempotencyKey?: string,
  ): Promise<{ photoId: string; remoteUrl: string }> {
```
(Bodies unchanged — the mock ignores the key.)

- [ ] **Step 3: Worker** — in `src/data/sync/syncWorker.ts` `performMutation`, pass `m.idempotencyKey` into each call. Change the four cases:
```ts
    case 'document.upsert': {
      const result = await api.upsertCountingDocument(m.payload as CountingDocument, m.idempotencyKey);
      await reconcile?.onDocumentUpserted(result);
      return;
    }
    case 'document.commit': {
      const { id } = m.payload as { id: string };
      const result = await api.commitCountingDocument(id, m.idempotencyKey);
      await reconcile?.onDocumentCommitted(result);
      return;
    }
    case 'entry.upsert': {
      const { documentId, entries } = m.payload as { documentId: string; entries: CountEntry[] };
      await api.upsertCountEntries(documentId, entries, m.idempotencyKey);
      await reconcile?.onEntriesUpserted(documentId, entries);
      return;
    }
    case 'photo.upload': {
      const file = m.payload as PhotoUpload;
      const result = await api.uploadPhoto(file, m.idempotencyKey);
      await reconcile?.onPhotoUploaded(file.id, result);
      return;
    }
```
(`PendingMutation.idempotencyKey` is a `string` — see `src/data/repos/types.ts`.)

- [ ] **Step 4: Verify** — `npx tsc --noEmit` (clean) and `CI=true npx jest 2>&1 | tail -6` (all suites pass — behavior is unchanged; the mock ignores the key, so the existing mock + sync-worker tests stay green).

- [ ] **Step 5: Commit**
```bash
git add src/data/api/carmenApi.ts src/data/api/mockCarmenApi.ts src/data/sync/syncWorker.ts
git commit -m "feat(api): thread mutation idempotencyKey through CarmenApi"
```

---

## Task 2: `ApiClient` multipart (FormData) support

**Files:** Modify `src/data/api/apiClient.ts`, `src/data/api/__tests__/apiClient.test.ts`.

When the request body is a `FormData`, send it as-is (no `JSON.stringify`, no `application/json` header) so `fetch` sets the multipart boundary.

- [ ] **Step 1: Failing test** — add to `src/data/api/__tests__/apiClient.test.ts` (inside the `describe('ApiClient', …)`):
```ts
  it('sends FormData bodies as-is without a JSON content-type', async () => {
    const fakeFetch = makeFetch([{ status: 200, body: { photoId: 'p', remoteUrl: 'r' } }]);
    const client = new ApiClient({
      baseUrl: 'https://example.test',
      getToken: () => null,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });
    const form = new FormData();
    form.append('file', 'x');
    await client.request('POST', '/uploads', { body: form });
    const init = fakeFetch.mock.calls[0][1] as RequestInit;
    expect(init.body).toBe(form);
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
  });
```

- [ ] **Step 2: Run** `npx jest src/data/api/__tests__/apiClient.test.ts` — confirm the new test FAILS (the body is currently `JSON.stringify`'d and `Content-Type: application/json` is set).

- [ ] **Step 3: Implement** — in `src/data/api/apiClient.ts` `doRequest`, replace the header setup + the `fetchImpl(...)` call. Currently:
```ts
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = this.opts.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (rOpts.idempotencyKey) headers['Idempotency-Key'] = rOpts.idempotencyKey;

    let response: Response;
    try {
      response = await fetchImpl(url, {
        method,
        headers,
        body: rOpts.body !== undefined ? JSON.stringify(rOpts.body) : undefined,
      });
    } catch (err) {
```
Replace with:
```ts
    const isFormData = typeof FormData !== 'undefined' && rOpts.body instanceof FormData;
    const headers: Record<string, string> = {};
    if (!isFormData) headers['Content-Type'] = 'application/json';
    const token = this.opts.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (rOpts.idempotencyKey) headers['Idempotency-Key'] = rOpts.idempotencyKey;

    let body: BodyInit | undefined;
    if (rOpts.body !== undefined) {
      body = isFormData ? (rOpts.body as FormData) : JSON.stringify(rOpts.body);
    }

    let response: Response;
    try {
      response = await fetchImpl(url, { method, headers, body });
    } catch (err) {
```

- [ ] **Step 4: Run** `npx jest src/data/api/__tests__/apiClient.test.ts` — confirm ALL pass (the new test + the existing ones, incl. the JSON/idempotency/bearer cases).
- [ ] **Step 5: Run** `npx tsc --noEmit` — clean.
- [ ] **Step 6: Commit**
```bash
git add src/data/api/apiClient.ts src/data/api/__tests__/apiClient.test.ts
git commit -m "feat(api): ApiClient sends FormData bodies as multipart"
```

---

## Task 3: Implement the six `HttpCarmenApi` methods

**Files:** Modify `src/data/api/httpCarmenApi.ts`, `src/data/api/__tests__/httpCarmenApi.test.ts`.

- [ ] **Step 1: Rewrite the tests.** In `src/data/api/__tests__/httpCarmenApi.test.ts`, DELETE the `it('throws not_implemented for plan-3 methods', …)` block entirely, and ADD these tests inside the `describe('HttpCarmenApi', …)`:
```ts
  it('listCountingDocuments GETs /counting-documents with status filter', async () => {
    const fetchImpl = fakeFetch({
      'GET /counting-documents': () => ({ status: 200, body: [{ id: 'd1' }] }),
    });
    const api = new HttpCarmenApi({
      baseUrl: 'https://api.test',
      getToken: () => null,
      fetchImpl: fetchImpl as never,
    });
    const docs = await api.listCountingDocuments({ status: 'draft' });
    expect(docs).toEqual([{ id: 'd1' }]);
    expect(fetchImpl.mock.calls[0][0] as string).toContain('status=draft');
  });

  it('getCountingDocument returns the document, or null on 404', async () => {
    const ok = fakeFetch({
      'GET /counting-documents/d1': () => ({ status: 200, body: { id: 'd1', status: 'draft' } }),
    });
    const apiOk = new HttpCarmenApi({
      baseUrl: 'https://api.test',
      getToken: () => null,
      fetchImpl: ok as never,
    });
    expect(await apiOk.getCountingDocument('d1')).toMatchObject({ id: 'd1' });

    const missing = fakeFetch({
      'GET /counting-documents/zzz': () => ({ status: 404, body: { code: 'document.not_found' } }),
    });
    const apiMissing = new HttpCarmenApi({
      baseUrl: 'https://api.test',
      getToken: () => null,
      fetchImpl: missing as never,
    });
    expect(await apiMissing.getCountingDocument('zzz')).toBeNull();
  });

  it('upsertCountingDocument POSTs the doc with an Idempotency-Key', async () => {
    const fetchImpl = fakeFetch({
      'POST /counting-documents': (init) => ({ status: 200, body: JSON.parse(init.body as string) }),
    });
    const api = new HttpCarmenApi({
      baseUrl: 'https://api.test',
      getToken: () => null,
      fetchImpl: fetchImpl as never,
    });
    const doc = { id: 'd1', status: 'draft' } as never;
    const result = await api.upsertCountingDocument(doc, 'idem-1');
    expect(result).toMatchObject({ id: 'd1' });
    const headers = (fetchImpl.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('idem-1');
  });

  it('upsertCountEntries PUTs { entries } to the document entries endpoint', async () => {
    const fetchImpl = fakeFetch({
      'PUT /counting-documents/d1/entries': () => ({ status: 200, body: {} }),
    });
    const api = new HttpCarmenApi({
      baseUrl: 'https://api.test',
      getToken: () => null,
      fetchImpl: fetchImpl as never,
    });
    await api.upsertCountEntries('d1', [{ id: 'e1' } as never], 'idem-2');
    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({ entries: [{ id: 'e1' }] });
  });

  it('commitCountingDocument POSTs to /commit', async () => {
    const fetchImpl = fakeFetch({
      'POST /counting-documents/d1/commit': () => ({
        status: 200,
        body: { id: 'd1', status: 'committed' },
      }),
    });
    const api = new HttpCarmenApi({
      baseUrl: 'https://api.test',
      getToken: () => null,
      fetchImpl: fetchImpl as never,
    });
    const result = await api.commitCountingDocument('d1', 'idem-3');
    expect(result).toMatchObject({ status: 'committed' });
  });

  it('uploadPhoto POSTs multipart FormData to /uploads', async () => {
    const fetchImpl = fakeFetch({
      'POST /uploads': () => ({ status: 200, body: { photoId: 'p1', remoteUrl: 'https://cdn/x' } }),
    });
    const api = new HttpCarmenApi({
      baseUrl: 'https://api.test',
      getToken: () => null,
      fetchImpl: fetchImpl as never,
    });
    const result = await api.uploadPhoto({ id: 'p1', uri: 'file://x.jpg', mimeType: 'image/jpeg' }, 'idem-4');
    expect(result).toEqual({ photoId: 'p1', remoteUrl: 'https://cdn/x' });
    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    expect(init.body).toBeInstanceOf(FormData);
    const headers = init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('idem-4');
  });
```

- [ ] **Step 2: Run** `npx jest src/data/api/__tests__/httpCarmenApi.test.ts` — confirm the new tests FAIL (methods still throw `not_implemented`). The existing signIn/listAssets/getAssetByCode tests still pass.

- [ ] **Step 3: Implement.** In `src/data/api/httpCarmenApi.ts`:
(a) Remove the now-unused `notImplemented` helper function.
(b) Replace the six stub methods (`listCountingDocuments` through `uploadPhoto`) with:
```ts
  async listCountingDocuments(opts: {
    status?: CountingDocument['status'];
  }): Promise<CountingDocument[]> {
    return this.client.request<CountingDocument[]>(
      'GET',
      `/counting-documents${qs({ status: opts.status })}`,
    );
  }

  async getCountingDocument(id: string): Promise<CountingDocument | null> {
    try {
      return await this.client.request<CountingDocument>(
        'GET',
        `/counting-documents/${encodeURIComponent(id)}`,
      );
    } catch (err) {
      if (err instanceof CarmenApiError && err.code === 'not_found') return null;
      throw err;
    }
  }

  async upsertCountingDocument(
    doc: CountingDocument,
    idempotencyKey?: string,
  ): Promise<CountingDocument> {
    return this.client.request<CountingDocument>('POST', '/counting-documents', {
      body: doc,
      idempotencyKey,
    });
  }

  async upsertCountEntries(
    documentId: string,
    entries: CountEntry[],
    idempotencyKey?: string,
  ): Promise<void> {
    await this.client.request<void>(
      'PUT',
      `/counting-documents/${encodeURIComponent(documentId)}/entries`,
      { body: { entries }, idempotencyKey },
    );
  }

  async commitCountingDocument(id: string, idempotencyKey?: string): Promise<CountingDocument> {
    return this.client.request<CountingDocument>(
      'POST',
      `/counting-documents/${encodeURIComponent(id)}/commit`,
      { idempotencyKey },
    );
  }

  async uploadPhoto(
    file: PhotoUpload,
    idempotencyKey?: string,
  ): Promise<{ photoId: string; remoteUrl: string }> {
    const form = new FormData();
    form.append('file', {
      uri: file.uri,
      name: file.id,
      type: file.mimeType,
    } as unknown as Blob);
    return this.client.request<{ photoId: string; remoteUrl: string }>('POST', '/uploads', {
      body: form,
      idempotencyKey,
    });
  }
```
(`qs`, `CarmenApiError`, `CountingDocument`, `CountEntry`, `PhotoUpload` are already imported in this file. The RN `FormData.append` file-part shape needs the `as unknown as Blob` cast under strict TS.)

- [ ] **Step 4: Run** `npx jest src/data/api/__tests__/httpCarmenApi.test.ts` — confirm ALL pass.
- [ ] **Step 5: Run** `npx tsc --noEmit` — clean (verifies the `notImplemented` removal left no dangling reference and the signatures match the interface).
- [ ] **Step 6: Commit**
```bash
git add src/data/api/httpCarmenApi.ts src/data/api/__tests__/httpCarmenApi.test.ts
git commit -m "feat(api): implement HTTP counting + photo endpoints"
```

---

## Task 4: Slice verification

**Files:** none (verification + final commit if formatting changes).

- [ ] **Step 1: Typecheck** — `npx tsc --noEmit` — no errors.
- [ ] **Step 2: Lint** — `npm run lint` (`lint:fix` if needed).
- [ ] **Step 3: Format** — `npm run format:check`; if it lists Slice-6b files (`src/data/api/*`, `src/data/sync/syncWorker.ts`), `npx prettier --write` those specific paths (NOT `CLAUDE.md`), re-check.
- [ ] **Step 4: Full suite** — `CI=true npx jest 2>&1 | tail -15` — all pass (the new apiClient + httpCarmenApi tests; the mock + sync-worker suites unchanged).
- [ ] **Step 5: Smoke-check the HTTP impl is reachable (optional, no real server).** Confirm the app still boots on the mock (default): `APP_API_IMPL` unset → `createCarmenApi` returns the mock. The HTTP path is only exercised under `APP_API_IMPL=http` against a real server, which doesn't exist yet — so this slice's verification is the unit tests, not a live call. No manual device QA needed (no UI changed).
- [ ] **Step 6: Final commit (only if Steps 2–3 changed files)**
```bash
git add -A
git commit -m "chore(api): lint/format pass for Slice 6b"
```

---

## Self-Review (run by the plan author)

**1. Spec coverage (§6 endpoint contract / §4 / §12.6 "finalize HTTP endpoints"):**
- `POST /counting-documents` (create, returns runningNumber) — Task 3 `upsertCountingDocument`. ✓
- `GET /counting-documents?status=...` — Task 3 `listCountingDocuments`. ✓
- `GET /counting-documents/{id}` (404→null) — Task 3 `getCountingDocument`. ✓
- `PUT /counting-documents/{id}/entries` (bulk upsert) — Task 3 `upsertCountEntries`. ✓
- `POST /counting-documents/{id}/commit` — Task 3 `commitCountingDocument`. ✓
- `POST /uploads` multipart → `{photoId, remoteUrl}` — Tasks 2 + 3 `uploadPhoto`. ✓
- `Idempotency-Key` on every POST (the §6 non-negotiable) — Tasks 1 (threading) + 3 (header via `ApiClient`, already supported). The PUT entries call also passes it; the GETs don't (correct). ✓
- No separate asset-move call (location recorded on the entry) — unchanged; nothing added. ✓

**Deferred (documented):** ETag/If-None-Match; cursor pagination on counting-documents; switching the default backend (mock stays default). Response shapes remain provisional per spec §13.

**2. Placeholder scan:** No TBD/TODO; every code step is complete. The `notImplemented` helper is explicitly removed in Task 3. ✓

**3. Type consistency:**
- The four mutating methods gain `idempotencyKey?: string` consistently across the interface (Task 1), the mock (Task 1, as `_idempotencyKey`), the worker call sites (Task 1), and `HttpCarmenApi` (Task 3). ✓
- `performMutation` passes `m.idempotencyKey` (a `string` per `PendingMutation`) into each call — Task 1. ✓
- `ApiClient.request`'s `RequestOptions` already has `body?: unknown` + `idempotencyKey?: string`; the FormData branch keys off `body instanceof FormData` — Task 2. ✓
- `listCountingDocuments` param widened to `{ status?: CountingDocument['status'] }` to match the interface (the old stub had `'draft' | 'committed'`) — Task 3. ✓
- `getCountingDocument` mirrors the existing `getAsset` 404→null pattern. ✓
- Endpoint paths/verbs match §6 exactly; `qs` filters `undefined` so no `?status=` when omitted. ✓
- Test mock `fakeFetch` keys on `METHOD pathname` (existing helper) — the new tests reuse it. ✓
