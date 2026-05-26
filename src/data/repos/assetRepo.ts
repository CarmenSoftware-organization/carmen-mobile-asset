import type { SqlExecutor } from '../db/types';
import type { Asset } from './types';

interface AssetRow extends Asset {
  syncedAt: string;
}

function rowToAsset(r: AssetRow): Asset {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { syncedAt, ...rest } = r;
  return rest;
}

export interface AssetRepo {
  list(opts?: { search?: string }): Promise<Asset[]>;
  findById(id: string): Promise<Asset | null>;
  findByCode(code: string): Promise<Asset | null>;
  listByLocation(locationId: string): Promise<Asset[]>;
  upsertMany(assets: Asset[]): Promise<void>;
  deleteByIds(ids: string[]): Promise<void>;
}

export function createAssetRepo(db: SqlExecutor): AssetRepo {
  return {
    async list(opts) {
      if (opts?.search) {
        const like = `%${opts.search}%`;
        const rows = await db.getAllAsync<AssetRow>(
          'SELECT * FROM assets WHERE name LIKE ? COLLATE NOCASE OR code LIKE ? COLLATE NOCASE ORDER BY code',
          [like, like],
        );
        return rows.map(rowToAsset);
      }
      const rows = await db.getAllAsync<AssetRow>('SELECT * FROM assets ORDER BY code');
      return rows.map(rowToAsset);
    },
    async findById(id) {
      const row = await db.getFirstAsync<AssetRow>('SELECT * FROM assets WHERE id = ?', [id]);
      return row ? rowToAsset(row) : null;
    },
    async findByCode(code) {
      const row = await db.getFirstAsync<AssetRow>('SELECT * FROM assets WHERE code = ?', [code]);
      return row ? rowToAsset(row) : null;
    },
    async listByLocation(locationId) {
      const rows = await db.getAllAsync<AssetRow>(
        'SELECT * FROM assets WHERE locationId = ? ORDER BY code',
        [locationId],
      );
      return rows.map(rowToAsset);
    },
    async upsertMany(assets) {
      const now = new Date().toISOString();
      for (const a of assets) {
        await db.runAsync(
          `INSERT INTO assets (
             id, code, name, category, department, locationId, locationName,
             quantity, remainQty, price, currency, totalAmount,
             inputDate, acquireDate, assetLife, remark, imageUrl,
             serialNo, specification, updatedAt, syncedAt
           ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET
             code=excluded.code, name=excluded.name, category=excluded.category,
             department=excluded.department, locationId=excluded.locationId,
             locationName=excluded.locationName, quantity=excluded.quantity,
             remainQty=excluded.remainQty, price=excluded.price, currency=excluded.currency,
             totalAmount=excluded.totalAmount, inputDate=excluded.inputDate,
             acquireDate=excluded.acquireDate, assetLife=excluded.assetLife,
             remark=excluded.remark, imageUrl=excluded.imageUrl,
             serialNo=excluded.serialNo, specification=excluded.specification,
             updatedAt=excluded.updatedAt, syncedAt=excluded.syncedAt`,
          [
            a.id,
            a.code,
            a.name,
            a.category,
            a.department,
            a.locationId,
            a.locationName,
            a.quantity,
            a.remainQty,
            a.price,
            a.currency,
            a.totalAmount,
            a.inputDate,
            a.acquireDate,
            a.assetLife,
            a.remark,
            a.imageUrl,
            a.serialNo,
            a.specification,
            a.updatedAt,
            now,
          ],
        );
      }
    },
    async deleteByIds(ids) {
      if (ids.length === 0) return;
      const placeholders = ids.map(() => '?').join(',');
      await db.runAsync(`DELETE FROM assets WHERE id IN (${placeholders})`, ids);
    },
  };
}
