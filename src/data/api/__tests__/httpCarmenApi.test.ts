import { HttpCarmenApi } from '../httpCarmenApi';
import { CarmenApiError } from '../errors';

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

  it('throws not_implemented for plan-3 methods', async () => {
    const api = new HttpCarmenApi({
      baseUrl: 'https://api.test',
      getToken: () => null,
      fetchImpl: jest.fn() as never,
    });
    await expect(
      api.uploadPhoto({ id: 'p', uri: 'file://x', mimeType: 'image/jpeg' }),
    ).rejects.toMatchObject({ code: 'not_implemented' });
    await expect(api.commitCountingDocument('d')).rejects.toBeInstanceOf(CarmenApiError);
  });
});
