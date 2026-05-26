import { filterSortAssetCounts, type AssetCountRow } from '../filterSortAssetCounts';
import type { Asset } from '../../../data/repos/types';

function asset(over: Partial<Asset>): Asset {
  return {
    id: over.id ?? 'a',
    code: over.code ?? 'AST',
    name: over.name ?? 'Name',
    category: over.category ?? null,
    department: over.department ?? null,
    locationId: 'loc1',
    locationName: 'Loc 1',
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

const rows: AssetCountRow[] = [
  { asset: asset({ id: 'a1', code: 'AST002', name: 'Chair', category: 'Furniture', department: 'HR' }), countedQty: 0 },
  { asset: asset({ id: 'a2', code: 'AST001', name: 'Desktop', category: 'IT', department: 'Finance' }), countedQty: 3 },
  { asset: asset({ id: 'a3', code: 'AST003', name: 'Switch', category: 'IT', department: 'IT' }), countedQty: 0 },
];
const base = { search: '', filter: 'all' as const, category: null, sort: 'code' as const };

describe('filterSortAssetCounts', () => {
  it('sorts by code by default', () => {
    expect(filterSortAssetCounts(rows, base).map((r) => r.asset.code)).toEqual([
      'AST001',
      'AST002',
      'AST003',
    ]);
  });

  it('sorts by name and by department', () => {
    expect(filterSortAssetCounts(rows, { ...base, sort: 'name' }).map((r) => r.asset.name)).toEqual([
      'Chair',
      'Desktop',
      'Switch',
    ]);
    expect(
      filterSortAssetCounts(rows, { ...base, sort: 'department' }).map((r) => r.asset.department),
    ).toEqual(['Finance', 'HR', 'IT']);
  });

  it('filters counted vs uncounted by countedQty', () => {
    expect(filterSortAssetCounts(rows, { ...base, filter: 'counted' }).map((r) => r.asset.id)).toEqual([
      'a2',
    ]);
    expect(
      filterSortAssetCounts(rows, { ...base, filter: 'uncounted' }).map((r) => r.asset.id),
    ).toEqual(['a1', 'a3']);
  });

  it('filters by category', () => {
    expect(filterSortAssetCounts(rows, { ...base, category: 'IT' }).map((r) => r.asset.id)).toEqual([
      'a2',
      'a3',
    ]);
  });

  it('searches code/name/category/department case-insensitively', () => {
    expect(filterSortAssetCounts(rows, { ...base, search: 'finance' }).map((r) => r.asset.id)).toEqual([
      'a2',
    ]);
    expect(filterSortAssetCounts(rows, { ...base, search: 'switch' }).map((r) => r.asset.id)).toEqual([
      'a3',
    ]);
  });
});
