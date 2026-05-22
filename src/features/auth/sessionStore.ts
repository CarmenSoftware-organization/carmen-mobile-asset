import * as SecureStore from 'expo-secure-store';
import type { Session } from '../../data/api/carmenApi';
import { loadConfig } from '../../platform/config';

function key(): string {
  return `carmen-session-${loadConfig().customerSlug}`;
}

export interface SessionStore {
  load(): Promise<Session | null>;
  save(session: Session): Promise<void>;
  clear(): Promise<void>;
}

export function createSessionStore(secureStore: typeof SecureStore = SecureStore): SessionStore {
  return {
    async load() {
      const raw = await secureStore.getItemAsync(key());
      if (!raw) return null;
      try {
        return JSON.parse(raw) as Session;
      } catch {
        await secureStore.deleteItemAsync(key());
        return null;
      }
    },
    async save(session) {
      await secureStore.setItemAsync(key(), JSON.stringify(session));
    },
    async clear() {
      await secureStore.deleteItemAsync(key());
    },
  };
}
