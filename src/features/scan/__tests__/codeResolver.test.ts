import { createCodeResolver } from '../codeResolver';
import type { AssetRepo } from '../../../data/repos/assetRepo';
import type { CarmenApi } from '../../../data/api/carmenApi';
import type { Asset } from '../../../data/repos/types';

function asset(id: string, code: string): Asset {
  return {
    id,
    code,
    name: code,
    category: null,
    department: null,
    locationId: 'loc1',
    locationName: 'L',
    quantity: 1,
    remainQty: 1,
    price: null,
    currency: null,
    totalAmount: null,
    inputDate: null,
    acquireDate: null,
    assetLife: null,
    remark: null,
    imageUrl: null,
    serialNo: null,
    specification: null,
    updatedAt: '2026-05-22T10:00:00Z',
  };
}

describe('codeResolver', () => {
  it('returns the local asset without calling the API', async () => {
    const local = asset('a1', 'AST001');
    const api = { getAssetByCode: jest.fn() } as unknown as CarmenApi;
    const repo = { findByCode: jest.fn(async () => local) } as unknown as AssetRepo;
    const resolver = createCodeResolver(repo, api);
    expect(await resolver.resolve('AST001')).toEqual(local);
    expect(api.getAssetByCode).not.toHaveBeenCalled();
  });

  it('falls back to the API when not found locally', async () => {
    const remote = asset('a9', 'AST999');
    const api = { getAssetByCode: jest.fn(async () => remote) } as unknown as CarmenApi;
    const repo = { findByCode: jest.fn(async () => null) } as unknown as AssetRepo;
    const resolver = createCodeResolver(repo, api);
    expect(await resolver.resolve('AST999')).toEqual(remote);
    expect(api.getAssetByCode).toHaveBeenCalledWith('AST999');
  });

  it('returns null when neither has it', async () => {
    const api = { getAssetByCode: jest.fn(async () => null) } as unknown as CarmenApi;
    const repo = { findByCode: jest.fn(async () => null) } as unknown as AssetRepo;
    const resolver = createCodeResolver(repo, api);
    expect(await resolver.resolve('NOPE')).toBeNull();
  });
});
