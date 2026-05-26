import { makeMigratedTestDb, type TestDb } from '../../db/__tests__/testDb';
import { createPhotoRepo } from '../photoRepo';
import type { Photo } from '../types';

const photo: Photo = {
  id: 'p1',
  entryId: 'e1',
  localUri: 'file:///tmp/p1.jpg',
  remoteUrl: null,
  capturedAt: '2025-06-01T09:05:00Z',
  uploadStatus: 'queued',
  attempts: 0,
  lastError: null,
};

describe('photoRepo', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
  });
  afterEach(() => db.close());

  it('inserts and lists photos by entry', async () => {
    const repo = createPhotoRepo(db);
    await repo.insert(photo);
    const list = await repo.listByEntry('e1');
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 'p1', uploadStatus: 'queued', remoteUrl: null });
  });

  it('markUploaded sets remoteUrl and status done', async () => {
    const repo = createPhotoRepo(db);
    await repo.insert(photo);
    await repo.markUploaded('p1', 'https://cdn/p1.jpg');
    const found = await repo.findById('p1');
    expect(found).toMatchObject({ remoteUrl: 'https://cdn/p1.jpg', uploadStatus: 'done' });
  });
});
