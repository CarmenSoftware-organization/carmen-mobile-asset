import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDb } from '../../data/db/dbContext';
import { useMutationQueue } from '../../data/sync/mutationQueueContext';
import { createCountEntryRepo } from '../../data/repos/countEntryRepo';
import { uuid } from '../../platform/id';
import type { CountEntry } from '../../data/api/carmenApi';

export function useSetCountedQty(documentId: string) {
  const db = useDb();
  const queue = useMutationQueue();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ assetId, qty }: { assetId: string; qty: number }): Promise<void> => {
      const repo = createCountEntryRepo(db);
      const existing = await repo.findByDocumentAndAsset(documentId, assetId);
      const now = new Date().toISOString();
      const entry: CountEntry = existing
        ? { ...existing, countQty: qty, updatedAt: now }
        : {
            id: uuid(),
            documentId,
            assetId,
            unknownCode: null,
            countQty: qty,
            location: null,
            observedSerialNo: null,
            observedSpecification: null,
            observedRemark: null,
            comment: '',
            photoIds: [],
            transferDate: null,
            scannedAt: now,
            updatedAt: now,
          };
      await repo.upsert(entry);
      await queue.enqueue('entry.upsert', { documentId, entries: [entry] });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['assetCountList', documentId] });
      void qc.invalidateQueries({ queryKey: ['countingDocuments'] });
    },
  });
}
