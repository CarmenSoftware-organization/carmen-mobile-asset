import type { Migration, SqlExecutor } from './types';

export async function runMigrations(db: SqlExecutor, migrations: Migration[]): Promise<void> {
  for (let i = 1; i < migrations.length; i++) {
    if (migrations[i].version <= migrations[i - 1].version) {
      throw new Error(
        `Migrations must be in strictly ascending version order (saw ${migrations[i].version} after ${migrations[i - 1].version})`,
      );
    }
  }

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (const m of migrations) {
    if (m.version > current) {
      await m.up(db);
      await db.execAsync(`PRAGMA user_version = ${m.version}`);
    }
  }
}
