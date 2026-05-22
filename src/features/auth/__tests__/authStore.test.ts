import { useAuthStore } from '../authStore';

const sample = {
  token: 't',
  refreshToken: 'r',
  expiresAt: '2030-01-01T00:00:00Z',
  user: { id: 'u1', displayName: 'alice', email: null, roles: [] },
};

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'loading', session: null });
  });

  it('setSession to a session transitions to signedIn', () => {
    useAuthStore.getState().setSession(sample);
    expect(useAuthStore.getState().status).toBe('signedIn');
    expect(useAuthStore.getState().session).toEqual(sample);
  });

  it('setSession(null) transitions to signedOut', () => {
    useAuthStore.getState().setSession(sample);
    useAuthStore.getState().setSession(null);
    expect(useAuthStore.getState().status).toBe('signedOut');
    expect(useAuthStore.getState().session).toBeNull();
  });
});
