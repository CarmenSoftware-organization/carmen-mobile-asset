import * as SQLite from 'expo-sqlite';
import { loadConfig } from '../../platform/config';
import { runMigrations } from './migrate';
import { migrations } from './migrations';
import type { SqlExecutor } from './types';

interface InternalHandle {
  db: SQLite.SQLiteDatabase;
  executor: SqlExecutor;
}

let dbPromise: Promise<InternalHandle> | null = null;

function wrap(db: SQLite.SQLiteDatabase): SqlExecutor {
  return {
    execAsync: (sql) => db.execAsync(sql),
    getAllAsync: (sql, params = []) => db.getAllAsync(sql, params as SQLite.SQLiteBindParams),
    getFirstAsync: (sql, params = []) => db.getFirstAsync(sql, params as SQLite.SQLiteBindParams),
    runAsync: (sql, params = []) => db.runAsync(sql, params as SQLite.SQLiteBindParams),
  };
}

export function openDatabase(): Promise<SqlExecutor> {
  if (!dbPromise) {
    const { customerSlug } = loadConfig();
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(`carmen-${customerSlug}.db`);
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('PRAGMA foreign_keys = ON;');
      const executor = wrap(db);
      await runMigrations(executor, migrations);
      return { db, executor };
    })();
  }
  return dbPromise.then((h) => h.executor);
}

export async function closeDatabase(): Promise<void> {
  if (dbPromise) {
    const { db } = await dbPromise;
    await db.closeAsync();
    dbPromise = null;
  }
}

export type { SqlExecutor, Migration } from './types';
