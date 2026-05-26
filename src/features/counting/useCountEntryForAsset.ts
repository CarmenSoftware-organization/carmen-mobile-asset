import { useQuery } from '@tanstack/react-query';
import { useDb } from '../../data/db/dbContext';
import { createCountEntryRepo } from '../../data/repos/countEntryRepo';

export function useCountEntryForAsset(documentId: string, assetId: string) {
  const db = useDb();
  return useQuery({
    queryKey: ['countEntry', documentId, assetId],
    queryFn: () => createCountEntryRepo(db).findByDocumentAndAsset(documentId, assetId),
    enabled: !!documentId && !!assetId,
  });
}
