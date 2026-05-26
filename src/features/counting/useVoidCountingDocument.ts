import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDb } from '../../data/db/dbContext';
import { useMutationQueue } from '../../data/sync/mutationQueueContext';
import { createCountingDocumentRepo } from '../../data/repos/countingDocumentRepo';
import type { CountingDocument } from '../../data/api/carmenApi';

export function useVoidCountingDocument() {
  const db = useDb();
  const queue = useMutationQueue();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: CountingDocument): Promise<void> => {
      const voided: CountingDocument = { ...doc, status: 'void' };
      await createCountingDocumentRepo(db).upsert(voided);
      await queue.enqueue('document.upsert', voided);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['countingDocuments'] });
    },
  });
}
