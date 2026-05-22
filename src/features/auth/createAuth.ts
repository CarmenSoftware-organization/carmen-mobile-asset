import { createCarmenApi } from '../../data/api/createCarmenApi';
import type { CarmenApi, PasswordCredentials } from '../../data/api/carmenApi';
import type { AuthStrategy } from './authStrategy';
import { createPasswordAuthStrategy } from './passwordAuthStrategy';
import { createSessionStore } from './sessionStore';
import { useAuthStore } from './authStore';

export interface AuthBundle {
  api: CarmenApi;
  strategy: AuthStrategy;
  signIn(creds: PasswordCredentials): Promise<void>;
  signOut(): Promise<void>;
}

export async function createAuth(): Promise<AuthBundle> {
  const sessionStore = createSessionStore();
  let strategy: AuthStrategy | null = null;
  const api = createCarmenApi({
    getToken: () => strategy?.currentSession()?.token ?? null,
    onUnauthenticated: async () => {
      try {
        const s = await strategy?.refresh();
        return s?.token ?? null;
      } catch {
        useAuthStore.getState().setSession(null);
        return null;
      }
    },
  });
  strategy = createPasswordAuthStrategy({ api, sessionStore });
  const initial = await strategy.hydrate();
  useAuthStore.getState().setSession(initial);

  return {
    api,
    strategy,
    async signIn(creds) {
      const s = await strategy!.signIn(creds);
      useAuthStore.getState().setSession(s);
    },
    async signOut() {
      await strategy!.signOut();
      useAuthStore.getState().setSession(null);
    },
  };
}
