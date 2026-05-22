import { create } from 'zustand';

export type SyncStatus = 'idle' | 'syncing' | 'error';

interface SyncStoreState {
  status: SyncStatus;
  queued: number;
  lastSuccessAt: Date | null;
  lastError: string | null;
  setStatus(status: SyncStatus, lastError?: string): void;
  setQueued(queued: number): void;
  recordSuccess(): void;
}

export const useSyncStore = create<SyncStoreState>((set) => ({
  status: 'idle',
  queued: 0,
  lastSuccessAt: null,
  lastError: null,
  setStatus: (status, lastError) =>
    set({ status, lastError: status === 'error' ? (lastError ?? 'unknown') : null }),
  setQueued: (queued) => set({ queued }),
  recordSuccess: () => set({ status: 'idle', lastSuccessAt: new Date(), lastError: null }),
}));
