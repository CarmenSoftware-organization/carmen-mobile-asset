import type { SqlExecutor } from '../db/types';
import type { Location } from './types';

interface LocationRow {
  id: string;
  name: string;
  updatedAt: string;
  syncedAt: string;
}

function rowToLocation(r: LocationRow): Location {
  return { id: r.id, name: r.name, updatedAt: r.updatedAt };
}

export interface LocationRepo {
  list(): Promise<Location[]>;
  findById(id: string): Promise<Location | null>;
  upsertMany(locations: Location[]): Promise<void>;
  deleteByIds(ids: string[]): Promise<void>;
}

export function createLocationRepo(db: SqlExecutor): LocationRepo {
  return {
    async list() {
      const rows = await db.getAllAsync<LocationRow>('SELECT * FROM locations ORDER BY name');
      return rows.map(rowToLocation);
    },
    async findById(id) {
      const row = await db.getFirstAsync<LocationRow>('SELECT * FROM locations WHERE id = ?', [id]);
      return row ? rowToLocation(row) : null;
    },
    async upsertMany(locations) {
      const now = new Date().toISOString();
      for (const l of locations) {
        await db.runAsync(
          `INSERT INTO locations (id, name, updatedAt, syncedAt)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET name=excluded.name, updatedAt=excluded.updatedAt, syncedAt=excluded.syncedAt`,
          [l.id, l.name, l.updatedAt, now],
        );
      }
    },
    async deleteByIds(ids) {
      if (ids.length === 0) return;
      const placeholders = ids.map(() => '?').join(',');
      await db.runAsync(`DELETE FROM locations WHERE id IN (${placeholders})`, ids);
    },
  };
}
