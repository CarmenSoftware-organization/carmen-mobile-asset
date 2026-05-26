import { createContext, useContext, type ReactNode } from 'react';
import type { MutationQueue } from './mutationQueue';

const MutationQueueCtx = createContext<MutationQueue | null>(null);

export function MutationQueueProvider({
  value,
  children,
}: {
  value: MutationQueue;
  children: ReactNode;
}) {
  return <MutationQueueCtx.Provider value={value}>{children}</MutationQueueCtx.Provider>;
}

export function useMutationQueue(): MutationQueue {
  const v = useContext(MutationQueueCtx);
  if (!v) throw new Error('useMutationQueue used outside MutationQueueProvider');
  return v;
}
