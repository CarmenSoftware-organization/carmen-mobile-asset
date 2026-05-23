import type { SqlExecutor } from '../db/types';
import type { MutationKind, PendingMutation } from './types';

interface PendingRow {
  id: string;
  idempotencyKey: string;
  kind: MutationKind;
  payload: string;
  createdAt: string;
  attempts: number;
  lastError: string | null;
  status: PendingMutation['status'];
}

function rowToMutation(r: PendingRow): PendingMutation {
  return {
    id: r.id,
    idempotencyKey: r.idempotencyKey,
    kind: r.kind,
    payload: JSON.parse(r.payload),
    createdAt: r.createdAt,
    attempts: r.attempts,
    lastError: r.lastError,
    status: r.status,
  };
}

function uuid(): string {
  return (
    Date.now().toString(16) +
    '-' +
    Math.random().toString(16).slice(2, 10) +
    '-' +
    Math.random().toString(16).slice(2, 10)
  );
}

export interface PendingMutationRepo {
  enqueue(input: { idempotencyKey: string; kind: MutationKind; payload: unknown }): Promise<string>;
  markInFlight(id: string): Promise<void>;
  listPending(): Promise<PendingMutation[]>;
  listFailed(): Promise<PendingMutation[]>;
  incrementAttempts(id: string, lastError: string): Promise<void>;
  markFailed(id: string, lastError: string): Promise<void>;
  markDone(id: string): Promise<void>;
  discard(id: string): Promise<void>;
}

export function createPendingMutationRepo(db: SqlExecutor): PendingMutationRepo {
  return {
    async enqueue({ idempotencyKey, kind, payload }) {
      const id = uuid();
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO pending_mutations (id, idempotencyKey, kind, payload, createdAt, attempts, lastError, status)
         VALUES (?, ?, ?, ?, ?, 0, NULL, 'pending')`,
        [id, idempotencyKey, kind, JSON.stringify(payload), now],
      );
      return id;
    },
    async listPending() {
      const rows = await db.getAllAsync<PendingRow>(
        "SELECT * FROM pending_mutations WHERE status = 'pending' ORDER BY createdAt",
      );
      return rows.map(rowToMutation);
    },
    async listFailed() {
      const rows = await db.getAllAsync<PendingRow>(
        "SELECT * FROM pending_mutations WHERE status = 'failed' ORDER BY createdAt",
      );
      return rows.map(rowToMutation);
    },
    async incrementAttempts(id, lastError) {
      await db.runAsync(
        "UPDATE pending_mutations SET attempts = attempts + 1, lastError = ?, status = 'pending' WHERE id = ?",
        [lastError, id],
      );
    },
    async markInFlight(id) {
      await db.runAsync("UPDATE pending_mutations SET status = 'in_flight' WHERE id = ?", [id]);
    },
    async markFailed(id, lastError) {
      await db.runAsync(
        "UPDATE pending_mutations SET status = 'failed', lastError = ? WHERE id = ?",
        [lastError, id],
      );
    },
    async markDone(id) {
      await db.runAsync('DELETE FROM pending_mutations WHERE id = ?', [id]);
    },
    async discard(id) {
      await db.runAsync('DELETE FROM pending_mutations WHERE id = ?', [id]);
    },
  };
}
