import { makeMigratedTestDb, type TestDb } from '../../db/__tests__/testDb';
import { createPendingMutationRepo } from '../../repos/pendingMutationRepo';
import { createMutationQueue } from '../mutationQueue';

describe('mutationQueue', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
  });
  afterEach(() => db.close());

  it('enqueue stores a mutation with a unique idempotency key', async () => {
    const repo = createPendingMutationRepo(db);
    const q = createMutationQueue(repo);
    const id = await q.enqueue('document.upsert', { x: 1 });
    const pending = await q.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(id);
    expect(pending[0].kind).toBe('document.upsert');
    expect(typeof pending[0].idempotencyKey).toBe('string');
    expect(pending[0].idempotencyKey.length).toBeGreaterThan(8);
  });

  it('notifies subscribers on enqueue', async () => {
    const repo = createPendingMutationRepo(db);
    const q = createMutationQueue(repo);
    const events: string[] = [];
    const unsubscribe = q.subscribe(() => events.push('changed'));
    await q.enqueue('document.upsert', {});
    expect(events).toEqual(['changed']);
    unsubscribe();
    await q.enqueue('entry.upsert', {});
    expect(events).toEqual(['changed']);
  });

  it('discard removes a failed mutation', async () => {
    const repo = createPendingMutationRepo(db);
    const q = createMutationQueue(repo);
    const id = await q.enqueue('document.upsert', {});
    await repo.markFailed(id, 'boom');
    await q.discard(id);
    expect(await q.listFailed()).toEqual([]);
  });
});
