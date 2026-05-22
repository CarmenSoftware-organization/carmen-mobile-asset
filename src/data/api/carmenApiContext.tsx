import { createContext, useContext, type ReactNode } from 'react';
import type { CarmenApi } from './carmenApi';

const ApiCtx = createContext<CarmenApi | null>(null);

export function CarmenApiProvider({ value, children }: { value: CarmenApi; children: ReactNode }) {
  return <ApiCtx.Provider value={value}>{children}</ApiCtx.Provider>;
}

export function useCarmenApi(): CarmenApi {
  const v = useContext(ApiCtx);
  if (!v) throw new Error('useCarmenApi used outside CarmenApiProvider');
  return v;
}
