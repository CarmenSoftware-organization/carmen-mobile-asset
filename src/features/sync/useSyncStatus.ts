import { useSyncStore } from '../../data/sync/syncStore';

export interface SyncStatus {
  status: 'idle' | 'syncing' | 'error';
  queued: number;
  lastSuccessAt: Date | null;
  lastError: string | null;
}

export function useSyncStatus(): SyncStatus {
  const status = useSyncStore((s) => s.status);
  const queued = useSyncStore((s) => s.queued);
  const lastSuccessAt = useSyncStore((s) => s.lastSuccessAt);
  const lastError = useSyncStore((s) => s.lastError);
  return { status, queued, lastSuccessAt, lastError };
}
