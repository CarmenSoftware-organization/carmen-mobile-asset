import type { CarmenApi } from '../api/carmenApi';
import type { AssetRepo } from '../repos/assetRepo';
import type { LocationRepo } from '../repos/locationRepo';
import type { MetaRepo } from '../repos/metaRepo';

const ASSETS_CURSOR_KEY = 'catalog_assets_updated_since';
const LAST_SUCCESS_KEY = 'catalog_last_success_at';

export interface CatalogSyncDeps {
  api: CarmenApi;
  assetRepo: AssetRepo;
  locationRepo: LocationRepo;
  metaRepo: MetaRepo;
}

export interface CatalogSync {
  run(): Promise<void>;
}

export function createCatalogSync(deps: CatalogSyncDeps): CatalogSync {
  return {
    async run() {
      const since = (await deps.metaRepo.get(ASSETS_CURSOR_KEY)) ?? undefined;
      let cursor: string | undefined = undefined;
      let maxUpdatedAt = since ?? '0';
      while (true) {
        const page = await deps.api.listAssets({ updatedSince: since, cursor });
        if (page.items.length > 0) {
          await deps.assetRepo.upsertMany(page.items);
          for (const a of page.items) {
            if (a.updatedAt > maxUpdatedAt) maxUpdatedAt = a.updatedAt;
          }
        }
        if (page.tombstones.length > 0) {
          await deps.assetRepo.deleteByIds(page.tombstones);
        }
        if (!page.nextCursor) break;
        cursor = page.nextCursor;
      }
      const locs = await deps.api.listLocations({ updatedSince: since });
      if (locs.length > 0) await deps.locationRepo.upsertMany(locs);
      const now = new Date().toISOString();
      if (maxUpdatedAt !== '0') {
        await deps.metaRepo.set(ASSETS_CURSOR_KEY, maxUpdatedAt);
      }
      await deps.metaRepo.set(LAST_SUCCESS_KEY, now);
    },
  };
}
