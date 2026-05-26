import type { Asset } from '../../data/repos/types';

export interface AssetCountRow {
  asset: Asset;
  countedQty: number;
}

export type CountFilter = 'all' | 'counted' | 'uncounted';
export type AssetSort = 'code' | 'name' | 'department';

export interface AssetCountFilterOptions {
  search: string;
  filter: CountFilter;
  category: string | null;
  sort: AssetSort;
}

function sortValue(row: AssetCountRow, sort: AssetSort): string {
  if (sort === 'code') return row.asset.code;
  if (sort === 'name') return row.asset.name;
  return row.asset.department ?? '';
}

export function filterSortAssetCounts(
  rows: AssetCountRow[],
  opts: AssetCountFilterOptions,
): AssetCountRow[] {
  const q = opts.search.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (opts.filter === 'counted' && r.countedQty <= 0) return false;
    if (opts.filter === 'uncounted' && r.countedQty > 0) return false;
    if (opts.category && r.asset.category !== opts.category) return false;
    if (q) {
      const hay = [r.asset.code, r.asset.name, r.asset.category, r.asset.department]
        .filter((v): v is string => typeof v === 'string')
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  return [...filtered].sort((a, b) =>
    sortValue(a, opts.sort).localeCompare(sortValue(b, opts.sort)),
  );
}
