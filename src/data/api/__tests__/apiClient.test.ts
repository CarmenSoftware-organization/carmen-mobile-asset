import { ApiClient } from '../apiClient';
import { CarmenApiError } from '../errors';

function makeFetch(responses: Array<{ status: number; body: unknown }>) {
  let i = 0;
  return jest.fn(async (_url: string, _init?: RequestInit) => {
    const r = responses[i++];
    return new Response(JSON.stringify(r.body), {
      status: r.status,
      headers: { 'content-type': 'application/json' },
    });
  });
}

describe('ApiClient', () => {
  it('adds bearer token header when getToken returns one', async () => {
    const fakeFetch = makeFetch([{ status: 200, body: { ok: true } }]);
    const client = new ApiClient({
      baseUrl: 'https://example.test',
      getToken: () => 'tok123',
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });
    await client.request('GET', '/me');
    const init = (fakeFetch.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(init.Authorization).toBe('Bearer tok123');
  });

  it('omits Authorization when no token', async () => {
    const fakeFetch = makeFetch([{ status: 200, body: {} }]);
    const client = new ApiClient({
      baseUrl: 'https://example.test',
      getToken: () => null,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });
    await client.request('GET', '/me');
    const init = (fakeFetch.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(init.Authorization).toBeUndefined();
  });

  it('sets Idempotency-Key on mutating requests when provided', async () => {
    const fakeFetch = makeFetch([{ status: 200, body: {} }]);
    const client = new ApiClient({
      baseUrl: 'https://example.test',
      getToken: () => null,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });
    await client.request('POST', '/x', { body: { a: 1 }, idempotencyKey: 'idem-1' });
    const init = (fakeFetch.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(init['Idempotency-Key']).toBe('idem-1');
  });

  it('throws CarmenApiError with code from response body on 4xx', async () => {
    const fakeFetch = makeFetch([
      { status: 404, body: { code: 'asset.not_found', message: 'nope' } },
    ]);
    const client = new ApiClient({
      baseUrl: 'https://example.test',
      getToken: () => null,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });
    await expect(client.request('GET', '/assets/x')).rejects.toMatchObject({
      code: 'not_found',
      message: 'nope',
    });
  });

  it('maps 5xx to server_error', async () => {
    const fakeFetch = makeFetch([
      { status: 503, body: {} },
      { status: 503, body: {} },
    ]);
    const client = new ApiClient({
      baseUrl: 'https://example.test',
      getToken: () => null,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });
    await expect(client.request('GET', '/x')).rejects.toBeInstanceOf(CarmenApiError);
    await expect(client.request('GET', '/x')).rejects.toMatchObject({ code: 'server_error' });
  });

  it('maps network errors to network_error', async () => {
    const fakeFetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });
    const client = new ApiClient({
      baseUrl: 'https://example.test',
      getToken: () => null,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });
    await expect(client.request('GET', '/x')).rejects.toMatchObject({ code: 'network_error' });
  });

  it('retries once after refreshing on 401', async () => {
    const fakeFetch = makeFetch([
      { status: 401, body: { code: 'unauthenticated' } },
      { status: 200, body: { ok: true } },
    ]);
    const refresh = jest.fn(async () => 'tok-new');
    let currentToken: string | null = 'tok-old';
    const client = new ApiClient({
      baseUrl: 'https://example.test',
      getToken: () => currentToken,
      fetchImpl: fakeFetch as unknown as typeof fetch,
      onUnauthenticated: async () => {
        const t = await refresh();
        currentToken = t;
        return t;
      },
    });
    const out = await client.request<{ ok: boolean }>('GET', '/x');
    expect(out).toEqual({ ok: true });
    expect(refresh).toHaveBeenCalledTimes(1);
    const secondInit = (fakeFetch.mock.calls[1][1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(secondInit.Authorization).toBe('Bearer tok-new');
  });
});
