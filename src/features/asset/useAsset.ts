import { useQuery } from '@tanstack/react-query';
import { useDb } from '../../data/db/dbContext';
import { createAssetRepo } from '../../data/repos/assetRepo';

export function useAsset(id: string) {
  const db = useDb();
  return useQuery({
    queryKey: ['asset', id],
    queryFn: async () => {
      const repo = createAssetRepo(db);
      return repo.findById(id);
    },
    enabled: !!id,
  });
}
