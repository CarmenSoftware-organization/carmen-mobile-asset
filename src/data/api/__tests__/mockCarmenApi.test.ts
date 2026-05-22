import { MockCarmenApi } from '../mockCarmenApi';
import { CarmenApiError } from '../errors';

describe('MockCarmenApi', () => {
  it('signIn returns a session for any credentials', async () => {
    const api = new MockCarmenApi({ latencyMs: 0 });
    const s = await api.signIn({ username: 'alice', password: 'pw' });
    expect(s.token).toMatch(/mock-token/);
    expect(s.user.displayName).toBe('alice');
  });

  it('listAssets returns the seed data', async () => {
    const api = new MockCarmenApi({ latencyMs: 0 });
    const page = await api.listAssets({});
    expect(page.items).toHaveLength(5);
    expect(page.tombstones).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });

  it('getAssetByCode returns the matching asset', async () => {
    const api = new MockCarmenApi({ latencyMs: 0 });
    const asset = await api.getAssetByCode('AST002');
    expect(asset?.name).toBe('Office Chair');
  });

  it('getAssetByCode returns null when unknown', async () => {
    const api = new MockCarmenApi({ latencyMs: 0 });
    expect(await api.getAssetByCode('UNKNOWN')).toBeNull();
  });

  it('listLocations returns seed locations', async () => {
    const api = new MockCarmenApi({ latencyMs: 0 });
    const locs = await api.listLocations({});
    expect(locs.map((l) => l.id).sort()).toEqual(['loc1', 'loc2', 'wh-a']);
  });

  it('offline mode rejects with network_error', async () => {
    const api = new MockCarmenApi({ latencyMs: 0 });
    api.setOnline(false);
    await expect(api.listAssets({})).rejects.toBeInstanceOf(CarmenApiError);
    await expect(api.listAssets({})).rejects.toMatchObject({ code: 'network_error' });
  });

  it('refresh returns a fresh session', async () => {
    const api = new MockCarmenApi({ latencyMs: 0 });
    const s = await api.refresh('rt');
    expect(s.token).toMatch(/mock-token/);
  });
});
