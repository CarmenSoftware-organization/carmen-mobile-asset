import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDb } from '../../data/db/dbContext';
import { useMutationQueue } from '../../data/sync/mutationQueueContext';
import { createCountEntryRepo } from '../../data/repos/countEntryRepo';
import { uuid } from '../../platform/id';
import type { CountEntry } from '../../data/api/carmenApi';

export interface SaveCountEntryInput {
  assetId: string;
  countQty: number;
  location: string;
  observedSerialNo: string;
  observedSpecification: string;
  observedRemark: string;
  comment: string;
}

export function useSaveCountEntry(documentId: string) {
  const db = useDb();
  const queue = useMutationQueue();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveCountEntryInput): Promise<void> => {
      const repo = createCountEntryRepo(db);
      const existing = await repo.findByDocumentAndAsset(documentId, input.assetId);
      const now = new Date().toISOString();
      const entry: CountEntry = {
        id: existing?.id ?? uuid(),
        documentId,
        assetId: input.assetId,
        unknownCode: null,
        countQty: input.countQty,
        location: input.location || null,
        observedSerialNo: input.observedSerialNo || null,
        observedSpecification: input.observedSpecification || null,
        observedRemark: input.observedRemark || null,
        comment: input.comment,
        photoIds: existing?.photoIds ?? [],
        transferDate: now,
        scannedAt: existing?.scannedAt ?? now,
        updatedAt: now,
      };
      await repo.upsert(entry);
      await queue.enqueue('entry.upsert', { documentId, entries: [entry] });
    },
    onSuccess: (_data, input) => {
      void qc.invalidateQueries({ queryKey: ['assetCountList', documentId] });
      void qc.invalidateQueries({ queryKey: ['countEntry', documentId, input.assetId] });
      void qc.invalidateQueries({ queryKey: ['countingDocuments'] });
    },
  });
}
