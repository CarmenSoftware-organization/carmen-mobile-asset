import { useQuery } from '@tanstack/react-query';
import { useDb } from '../../data/db/dbContext';
import { createAssetRepo } from '../../data/repos/assetRepo';

export function useAssets(search?: string) {
  const db = useDb();
  return useQuery({
    queryKey: ['assets', search ?? ''],
    queryFn: async () => {
      const repo = createAssetRepo(db);
      return repo.list({ search });
    },
  });
}
