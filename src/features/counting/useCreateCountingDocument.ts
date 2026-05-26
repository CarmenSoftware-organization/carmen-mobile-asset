import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDb } from '../../data/db/dbContext';
import { useMutationQueue } from '../../data/sync/mutationQueueContext';
import { createCountingDocumentRepo } from '../../data/repos/countingDocumentRepo';
import { useAuthStore } from '../auth/authStore';
import { newCountingDocument } from './newCountingDocument';
import type { Location } from '../../data/repos/types';
import type { CountingDocument } from '../../data/api/carmenApi';

export function useCreateCountingDocument() {
  const db = useDb();
  const queue = useMutationQueue();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (location: Location): Promise<CountingDocument> => {
      const createdBy = useAuthStore.getState().session?.user.id ?? 'unknown';
      const doc = newCountingDocument({ location, createdBy });
      await createCountingDocumentRepo(db).upsert(doc);
      await queue.enqueue('document.upsert', doc);
      return doc;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['countingDocuments'] });
    },
  });
}
