import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDb } from '../../data/db/dbContext';
import { useMutationQueue } from '../../data/sync/mutationQueueContext';
import { createCountingDocumentRepo } from '../../data/repos/countingDocumentRepo';
import type { CountingDocument } from '../../data/api/carmenApi';

export function useCommitCountingDocument(documentId: string) {
  const db = useDb();
  const queue = useMutationQueue();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: CountingDocument): Promise<void> => {
      const committed: CountingDocument = {
        ...doc,
        status: 'committed',
        commitDate: new Date().toISOString(),
      };
      await createCountingDocumentRepo(db).upsert(committed);
      await queue.enqueue('document.commit', { id: documentId });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['countingDocument', documentId] });
      void qc.invalidateQueries({ queryKey: ['countingDocuments'] });
    },
  });
}
