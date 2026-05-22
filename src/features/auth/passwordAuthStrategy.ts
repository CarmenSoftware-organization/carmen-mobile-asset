import type { CarmenApi, PasswordCredentials, Session } from '../../data/api/carmenApi';
import type { AuthStrategy } from './authStrategy';
import type { SessionStore } from './sessionStore';

interface Deps {
  api: CarmenApi;
  sessionStore: SessionStore;
}

export function createPasswordAuthStrategy(deps: Deps): AuthStrategy {
  let session: Session | null = null;

  return {
    async signIn(creds: PasswordCredentials) {
      const s = await deps.api.signIn(creds);
      session = s;
      await deps.sessionStore.save(s);
      return s;
    },
    async refresh() {
      if (!session) throw new Error('No session to refresh');
      const s = await deps.api.refresh(session.refreshToken);
      session = s;
      await deps.sessionStore.save(s);
      return s;
    },
    async signOut() {
      session = null;
      await deps.sessionStore.clear();
    },
    currentSession() {
      return session;
    },
    async hydrate() {
      const loaded = await deps.sessionStore.load();
      session = loaded;
      return loaded;
    },
  };
}
