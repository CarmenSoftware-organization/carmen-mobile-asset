import { MockCarmenApi } from '../mockCarmenApi';
import { CarmenApiError } from '../errors';
import type { CountingDocument } from '../carmenApi';

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

function draft(overrides: Partial<CountingDocument> = {}): CountingDocument {
  return {
    id: 'd1',
    runningNumber: null,
    locationId: 'loc1',
    locationName: 'Building A Floor 1',
    status: 'draft',
    countDate: '2025-06-15',
    commitDate: null,
    description: '',
    createdBy: 'mock-user',
    createdAt: '2025-06-15T08:00:00Z',
    ...overrides,
  };
}

describe('MockCarmenApi counting documents', () => {
  it('assigns CDYYMMNNNN running numbers per month', async () => {
    const api = new MockCarmenApi({ latencyMs: 0 });
    const a = await api.upsertCountingDocument(draft({ id: 'd1' }));
    const b = await api.upsertCountingDocument(draft({ id: 'd2' }));
    expect(a.runningNumber).toBe('CD25060001');
    expect(b.runningNumber).toBe('CD25060002');
  });

  it('keeps an already-assigned running number on re-upsert', async () => {
    const api = new MockCarmenApi({ latencyMs: 0 });
    await api.upsertCountingDocument(draft({ id: 'd1' }));
    const again = await api.upsertCountingDocument(draft({ id: 'd1', description: 'edited' }));
    expect(again.runningNumber).toBe('CD25060001');
    expect(again.description).toBe('edited');
  });

  it('lists and filters by status; commit and void transition status', async () => {
    const api = new MockCarmenApi({ latencyMs: 0 });
    await api.upsertCountingDocument(draft({ id: 'd1' }));
    await api.upsertCountingDocument(draft({ id: 'd2' }));
    const committed = await api.commitCountingDocument('d1');
    expect(committed.status).toBe('committed');
    expect(committed.commitDate).not.toBeNull();
    await api.upsertCountingDocument(draft({ id: 'd2', status: 'void' }));
    expect((await api.listCountingDocuments({ status: 'draft' })).map((d) => d.id)).toEqual([]);
    expect((await api.listCountingDocuments({ status: 'committed' })).map((d) => d.id)).toEqual(['d1']);
    expect((await api.getCountingDocument('d2'))?.status).toBe('void');
  });
});
