import type { AssetRepo } from '../../data/repos/assetRepo';
import type { CarmenApi } from '../../data/api/carmenApi';
import type { Asset } from '../../data/repos/types';

export interface CodeResolver {
  resolve(code: string): Promise<Asset | null>;
}

export function createCodeResolver(assetRepo: AssetRepo, api: CarmenApi): CodeResolver {
  return {
    async resolve(code) {
      const local = await assetRepo.findByCode(code);
      if (local) return local;
      return api.getAssetByCode(code);
    },
  };
}
