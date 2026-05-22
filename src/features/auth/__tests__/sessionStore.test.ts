import { createSessionStore } from '../sessionStore';

type FakeStore = {
  data: Record<string, string>;
  getItemAsync: jest.Mock;
  setItemAsync: jest.Mock;
  deleteItemAsync: jest.Mock;
};

function makeFake(): FakeStore {
  const data: Record<string, string> = {};
  return {
    data,
    getItemAsync: jest.fn(async (k: string) => data[k] ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => {
      data[k] = v;
    }),
    deleteItemAsync: jest.fn(async (k: string) => {
      delete data[k];
    }),
  };
}

const sample = {
  token: 't',
  refreshToken: 'r',
  expiresAt: '2030-01-01T00:00:00Z',
  user: { id: 'u1', displayName: 'alice', email: null, roles: [] },
};

describe('sessionStore', () => {
  it('returns null when no session stored', async () => {
    const fake = makeFake();
    const store = createSessionStore(fake as never);
    expect(await store.load()).toBeNull();
  });

  it('save then load round-trips a session', async () => {
    const fake = makeFake();
    const store = createSessionStore(fake as never);
    await store.save(sample);
    expect(await store.load()).toEqual(sample);
  });

  it('clear removes the session', async () => {
    const fake = makeFake();
    const store = createSessionStore(fake as never);
    await store.save(sample);
    await store.clear();
    expect(await store.load()).toBeNull();
  });

  it('load returns null and deletes corrupted JSON', async () => {
    const fake = makeFake();
    fake.data['carmen-session-default'] = 'not-json';
    const store = createSessionStore(fake as never);
    expect(await store.load()).toBeNull();
    expect(fake.deleteItemAsync).toHaveBeenCalled();
  });
});
