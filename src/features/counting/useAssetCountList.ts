import { useQuery } from '@tanstack/react-query';
import { useDb } from '../../data/db/dbContext';
import { createAssetRepo } from '../../data/repos/assetRepo';
import { createCountEntryRepo } from '../../data/repos/countEntryRepo';
import type { AssetCountRow } from './filterSortAssetCounts';

export function useAssetCountList(documentId: string, locationId: string, locationName: string) {
  const db = useDb();
  return useQuery({
    queryKey: ['assetCountList', documentId],
    queryFn: async (): Promise<AssetCountRow[]> => {
      const assets = await createAssetRepo(db).listByLocation(locationId);
      const entries = await createCountEntryRepo(db).listByDocument(documentId);
      const entryByAsset = new Map<string, { countQty: number; location: string | null }>();
      for (const e of entries) {
        if (e.assetId) entryByAsset.set(e.assetId, { countQty: e.countQty, location: e.location });
      }
      return assets
        .filter((asset) => {
          const e = entryByAsset.get(asset.id);
          // Hidden when observed at a different location (§8 location override).
          return !(e && e.location && e.location !== locationName);
        })
        .map((asset) => ({ asset, countedQty: entryByAsset.get(asset.id)?.countQty ?? 0 }));
    },
    enabled: !!documentId && !!locationId,
  });
}
