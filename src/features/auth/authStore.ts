import { create } from 'zustand';
import type { Session } from '../../data/api/carmenApi';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthStoreState {
  status: AuthStatus;
  session: Session | null;
  setSession(session: Session | null): void;
  setStatus(status: AuthStatus): void;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  status: 'loading',
  session: null,
  setSession: (session) => set({ session, status: session ? 'signedIn' : 'signedOut' }),
  setStatus: (status) => set({ status }),
}));
