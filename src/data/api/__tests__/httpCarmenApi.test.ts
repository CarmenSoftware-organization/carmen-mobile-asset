import { HttpCarmenApi } from '../httpCarmenApi';

function fakeFetch(
  handlers: Record<string, (init: RequestInit) => { status: number; body: unknown }>,
) {
  return jest.fn(async (url: string, init: RequestInit) => {
    const key = `${init.method ?? 'GET'} ${new URL(url).pathname}`;
    const h = handlers[key];
    if (!h) throw new Error(`No handler for ${key}`);
    const r = h(init);
    return new Response(JSON.stringify(r.body), {
      status: r.status,
      headers: { 'content-type': 'application/json' },
    });
  });
}

describe('HttpCarmenApi', () => {
  it('signIn POSTs to /auth/token with credentials and returns session', async () => {
    const fetchImpl = fakeFetch({
      'POST /auth/token': () => ({
        status: 200,
        body: {
          token: 't',
          refreshToken: 'r',
          expiresAt: '2030-01-01T00:00:00Z',
          user: { id: 'u1', displayName: 'alice', email: null, roles: [] },
        },
      }),
    });
    const api = new HttpCarmenApi({
      baseUrl: 'https://api.test',
      getToken: () => null,
      fetchImpl: fetchImpl as never,
    });
    const s = await api.signIn({ username: 'alice', password: 'pw' });
    expect(s.token).toBe('t');
  });

  it('listAssets builds the query string with updatedSince + cursor', async () => {
    const fetchImpl = fakeFetch({
      'GET /assets': () => ({ status: 200, body: { items: [], nextCursor: null, tombstones: [] } }),
    });
    const api = new HttpCarmenApi({
      baseUrl: 'https://api.test',
      getToken: () => null,
      fetchImpl: fetchImpl as never,
    });
    await api.listAssets({ updatedSince: '2026-01-01T00:00:00Z', cursor: 'c1', limit: 50 });
    const calledUrl = fetchImpl.mock.calls[0][0] as string;
    expect(calledUrl).toContain('updatedSince=2026-01-01');
    expect(calledUrl).toContain('cursor=c1');
    expect(calledUrl).toContain('limit=50');
  });

  it('getAssetByCode returns null on 404', async () => {
    const fetchImpl = fakeFetch({
      'GET /assets/by-code/UNKNOWN': () => ({ status: 404, body: { code: 'asset.not_found' } }),
    });
    const api = new HttpCarmenApi({
      baseUrl: 'https://api.test',
      getToken: () => null,
      fetchImpl: fetchImpl as never,
    });
    expect(await api.getAssetByCode('UNKNOWN')).toBeNull();
  });

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
      'POST /counting-documents': (init) => ({
        status: 200,
        body: JSON.parse(init.body as string),
      }),
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
    const result = await api.uploadPhoto(
      { id: 'p1', uri: 'file://x.jpg', mimeType: 'image/jpeg' },
      'idem-4',
    );
    expect(result).toEqual({ photoId: 'p1', remoteUrl: 'https://cdn/x' });
    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    expect(init.body).toBeInstanceOf(FormData);
    const headers = init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('idem-4');
  });
});
