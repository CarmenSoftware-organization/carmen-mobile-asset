import { createContext, useContext, type ReactNode } from 'react';
import type { AuthBundle } from './createAuth';

const AuthBundleCtx = createContext<AuthBundle | null>(null);

export function AuthBundleProvider({
  value,
  children,
}: {
  value: AuthBundle;
  children: ReactNode;
}) {
  return <AuthBundleCtx.Provider value={value}>{children}</AuthBundleCtx.Provider>;
}

export function useAuthBundle(): AuthBundle {
  const v = useContext(AuthBundleCtx);
  if (!v) throw new Error('useAuthBundle used outside AuthBundleProvider');
  return v;
}
