import Database from 'better-sqlite3';
import { runMigrations } from '../migrate';
import { migrations } from '../migrations';
import type { SqlExecutor } from '../types';

export interface TestDb extends SqlExecutor {
  close: () => void;
}

export function makeTestExecutor(): TestDb {
  const db = new Database(':memory:');
  return {
    async execAsync(sql) {
      db.exec(sql);
    },
    async getAllAsync(sql, params = []) {
      return db.prepare(sql).all(...(params as unknown[])) as never;
    },
    async getFirstAsync(sql, params = []) {
      const row = db.prepare(sql).get(...(params as unknown[]));
      return (row ?? null) as never;
    },
    async runAsync(sql, params = []) {
      const info = db.prepare(sql).run(...(params as unknown[]));
      return { changes: Number(info.changes), lastInsertRowId: Number(info.lastInsertRowid) };
    },
    close: () => db.close(),
  };
}

export async function makeMigratedTestDb(): Promise<TestDb> {
  const ex = makeTestExecutor();
  await runMigrations(ex, migrations);
  return ex;
}
