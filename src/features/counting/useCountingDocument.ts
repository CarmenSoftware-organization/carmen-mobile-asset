import { useQuery } from '@tanstack/react-query';
import { useDb } from '../../data/db/dbContext';
import { createCountingDocumentRepo } from '../../data/repos/countingDocumentRepo';

export function useCountingDocument(id: string) {
  const db = useDb();
  return useQuery({
    queryKey: ['countingDocument', id],
    queryFn: () => createCountingDocumentRepo(db).findById(id),
    enabled: !!id,
  });
}
