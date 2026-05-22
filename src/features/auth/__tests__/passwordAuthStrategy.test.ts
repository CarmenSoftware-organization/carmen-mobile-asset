import { createPasswordAuthStrategy } from '../passwordAuthStrategy';
import type { SessionStore } from '../sessionStore';
import type { CarmenApi, Session } from '../../../data/api/carmenApi';

function makeApi(overrides: Partial<CarmenApi> = {}): CarmenApi {
  return new Proxy({} as CarmenApi, {
    get(_t, key) {
      if (key in overrides) return (overrides as Record<string, unknown>)[key as string];
      return () => {
        throw new Error(`Unexpected ${String(key)}`);
      };
    },
  });
}

function makeStore(initial: Session | null = null): SessionStore & { _data: Session | null } {
  let data = initial;
  return {
    _data: data,
    async load() {
      return data;
    },
    async save(s) {
      data = s;
    },
    async clear() {
      data = null;
    },
  };
}

const sample: Session = {
  token: 't',
  refreshToken: 'r',
  expiresAt: '2030-01-01T00:00:00Z',
  user: { id: 'u1', displayName: 'alice', email: null, roles: [] },
};

describe('PasswordAuthStrategy', () => {
  it('signIn calls api and stores session', async () => {
    const api = makeApi({ signIn: jest.fn(async () => sample) });
    const store = makeStore();
    const strat = createPasswordAuthStrategy({ api, sessionStore: store });
    const s = await strat.signIn({ username: 'alice', password: 'pw' });
    expect(s).toEqual(sample);
    expect(strat.currentSession()).toEqual(sample);
  });

  it('hydrate loads from session store', async () => {
    const api = makeApi();
    const store = makeStore(sample);
    const strat = createPasswordAuthStrategy({ api, sessionStore: store });
    const s = await strat.hydrate();
    expect(s).toEqual(sample);
    expect(strat.currentSession()).toEqual(sample);
  });

  it('refresh calls api with current refresh token', async () => {
    const refreshed: Session = { ...sample, token: 't2' };
    const refresh = jest.fn(async () => refreshed);
    const api = makeApi({ refresh });
    const store = makeStore(sample);
    const strat = createPasswordAuthStrategy({ api, sessionStore: store });
    await strat.hydrate();
    const s = await strat.refresh();
    expect(refresh).toHaveBeenCalledWith('r');
    expect(s).toEqual(refreshed);
    expect(strat.currentSession()).toEqual(refreshed);
  });

  it('refresh throws if no session', async () => {
    const api = makeApi();
    const strat = createPasswordAuthStrategy({ api, sessionStore: makeStore() });
    await expect(strat.refresh()).rejects.toThrow(/no session/i);
  });

  it('signOut clears session and store', async () => {
    const api = makeApi();
    const store = makeStore(sample);
    const strat = createPasswordAuthStrategy({ api, sessionStore: store });
    await strat.hydrate();
    await strat.signOut();
    expect(strat.currentSession()).toBeNull();
    expect(await store.load()).toBeNull();
  });
});
