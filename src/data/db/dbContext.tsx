import { createContext, useContext, type ReactNode } from 'react';
import type { SqlExecutor } from './types';

const DbCtx = createContext<SqlExecutor | null>(null);

export function DbProvider({ value, children }: { value: SqlExecutor; children: ReactNode }) {
  return <DbCtx.Provider value={value}>{children}</DbCtx.Provider>;
}

export function useDb(): SqlExecutor {
  const v = useContext(DbCtx);
  if (!v) throw new Error('useDb used outside DbProvider');
  return v;
}
