import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DbProvider } from '../../../data/db/dbContext';
import { MutationQueueProvider } from '../../../data/sync/mutationQueueContext';
import { createMutationQueue, type MutationQueue } from '../../../data/sync/mutationQueue';
import { createPendingMutationRepo } from '../../../data/repos/pendingMutationRepo';
import type { SqlExecutor } from '../../../data/db/types';

/** Wraps a hook under test with the providers it needs, backed by a real testDb-backed queue. */
export function makeWrapper(db: SqlExecutor): {
  wrapper: (props: { children: ReactNode }) => ReactNode;
  queue: MutationQueue;
} {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const queue = createMutationQueue(createPendingMutationRepo(db));
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <DbProvider value={db}>
          <MutationQueueProvider value={queue}>{children}</MutationQueueProvider>
        </DbProvider>
      </QueryClientProvider>
    );
  }
  return { wrapper, queue };
}
