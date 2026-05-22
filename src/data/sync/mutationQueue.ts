import type { PendingMutationRepo } from '../repos/pendingMutationRepo';
import type { MutationKind, PendingMutation } from '../repos/types';

export interface MutationQueue {
  enqueue<K extends MutationKind>(kind: K, payload: unknown): Promise<string>;
  listPending(): Promise<PendingMutation[]>;
  listFailed(): Promise<PendingMutation[]>;
  discard(id: string): Promise<void>;
  /** Worker-side lifecycle: */
  markDone(id: string): Promise<void>;
  incrementAttempts(id: string, lastError: string): Promise<void>;
  markFailed(id: string, lastError: string): Promise<void>;
  /** Subscribe to changes; returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

function uuid(): string {
  return (
    Date.now().toString(16) +
    '-' +
    Math.random().toString(16).slice(2, 10) +
    '-' +
    Math.random().toString(16).slice(2, 10)
  );
}

export function createMutationQueue(repo: PendingMutationRepo): MutationQueue {
  const listeners = new Set<() => void>();
  function notify() {
    for (const l of listeners) l();
  }
  return {
    async enqueue(kind, payload) {
      const id = await repo.enqueue({ idempotencyKey: uuid(), kind, payload });
      notify();
      return id;
    },
    listPending: () => repo.listPending(),
    listFailed: () => repo.listFailed(),
    async discard(id) {
      await repo.discard(id);
      notify();
    },
    async markDone(id) {
      await repo.markDone(id);
      notify();
    },
    async incrementAttempts(id, lastError) {
      await repo.incrementAttempts(id, lastError);
      notify();
    },
    async markFailed(id, lastError) {
      await repo.markFailed(id, lastError);
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
