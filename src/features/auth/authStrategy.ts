import type { PasswordCredentials, Session } from '../../data/api/carmenApi';

export interface AuthStrategy {
  signIn(creds: PasswordCredentials): Promise<Session>;
  refresh(): Promise<Session>;
  signOut(): Promise<void>;
  currentSession(): Session | null;
  hydrate(): Promise<Session | null>;
}
