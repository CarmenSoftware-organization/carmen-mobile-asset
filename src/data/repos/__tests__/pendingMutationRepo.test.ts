import { makeMigratedTestDb, type TestDb } from '../../db/__tests__/testDb';
import { createPendingMutationRepo } from '../pendingMutationRepo';

describe('pendingMutationRepo', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
  });
  afterEach(() => db.close());

  it('enqueue persists a new mutation with status=pending and attempts=0', async () => {
    const repo = createPendingMutationRepo(db);
    const id = await repo.enqueue({
      idempotencyKey: 'key-1',
      kind: 'document.upsert',
      payload: { hello: 'world' },
    });
    expect(typeof id).toBe('string');
    const all = await repo.listPending();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      id,
      idempotencyKey: 'key-1',
      kind: 'document.upsert',
      payload: { hello: 'world' },
      attempts: 0,
      status: 'pending',
      lastError: null,
    });
  });

  it('listPending returns only pending in createdAt order', async () => {
    const repo = createPendingMutationRepo(db);
    const a = await repo.enqueue({ idempotencyKey: 'a', kind: 'document.upsert', payload: {} });
    const b = await repo.enqueue({ idempotencyKey: 'b', kind: 'entry.upsert', payload: {} });
    await repo.markFailed(a, 'boom');
    expect((await repo.listPending()).map((m) => m.id)).toEqual([b]);
  });

  it('listFailed returns only failed', async () => {
    const repo = createPendingMutationRepo(db);
    const a = await repo.enqueue({ idempotencyKey: 'a', kind: 'document.upsert', payload: {} });
    await repo.markFailed(a, 'boom');
    const failed = await repo.listFailed();
    expect(failed).toHaveLength(1);
    expect(failed[0].lastError).toBe('boom');
  });

  it('incrementAttempts bumps the counter', async () => {
    const repo = createPendingMutationRepo(db);
    const id = await repo.enqueue({ idempotencyKey: 'a', kind: 'document.upsert', payload: {} });
    await repo.incrementAttempts(id, 'transient');
    const [{ attempts, lastError }] = await repo.listPending();
    expect(attempts).toBe(1);
    expect(lastError).toBe('transient');
  });

  it('markDone deletes the row', async () => {
    const repo = createPendingMutationRepo(db);
    const id = await repo.enqueue({ idempotencyKey: 'a', kind: 'document.upsert', payload: {} });
    await repo.markDone(id);
    expect(await repo.listPending()).toEqual([]);
    expect(await repo.listFailed()).toEqual([]);
  });

  it('discard deletes a failed row', async () => {
    const repo = createPendingMutationRepo(db);
    const id = await repo.enqueue({ idempotencyKey: 'a', kind: 'document.upsert', payload: {} });
    await repo.markFailed(id, 'boom');
    await repo.discard(id);
    expect(await repo.listFailed()).toEqual([]);
  });
});
