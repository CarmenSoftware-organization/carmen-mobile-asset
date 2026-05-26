import { useQuery } from '@tanstack/react-query';
import { useDb } from '../../data/db/dbContext';
import { createAssetRepo } from '../../data/repos/assetRepo';
import { createCountEntryRepo } from '../../data/repos/countEntryRepo';
import type { AssetCountRow } from './filterSortAssetCounts';

export function useAssetCountList(documentId: string, locationId: string) {
  const db = useDb();
  return useQuery({
    queryKey: ['assetCountList', documentId],
    queryFn: async (): Promise<AssetCountRow[]> => {
      const assets = await createAssetRepo(db).listByLocation(locationId);
      const entries = await createCountEntryRepo(db).listByDocument(documentId);
      const qtyByAsset = new Map<string, number>();
      for (const e of entries) if (e.assetId) qtyByAsset.set(e.assetId, e.countQty);
      return assets.map((asset) => ({ asset, countedQty: qtyByAsset.get(asset.id) ?? 0 }));
    },
    enabled: !!documentId && !!locationId,
  });
}
