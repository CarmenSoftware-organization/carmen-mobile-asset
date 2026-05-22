import type { SqlExecutor } from '../db/types';

export interface MetaRepo {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export function createMetaRepo(db: SqlExecutor): MetaRepo {
  return {
    async get(key) {
      const row = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM _meta WHERE key = ?',
        [key],
      );
      return row?.value ?? null;
    },
    async set(key, value) {
      await db.runAsync(
        'INSERT INTO _meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [key, value],
      );
    },
    async delete(key) {
      await db.runAsync('DELETE FROM _meta WHERE key = ?', [key]);
    },
  };
}
