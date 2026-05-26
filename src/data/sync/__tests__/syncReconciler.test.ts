import { makeMigratedTestDb, type TestDb } from '../../db/__tests__/testDb';
import { createCountingDocumentRepo } from '../../repos/countingDocumentRepo';
import { createCountEntryRepo } from '../../repos/countEntryRepo';
import { createPhotoRepo } from '../../repos/photoRepo';
import { createSyncReconciler } from '../syncReconciler';
import type { CountingDocument } from '../../api/carmenApi';

const doc: CountingDocument = {
  id: 'd1',
  runningNumber: null,
  locationId: 'loc1',
  locationName: 'Building A Floor 1',
  status: 'draft',
  countDate: '2025-06-01',
  commitDate: null,
  description: '',
  createdBy: 'u1',
  createdAt: '2025-06-01T08:00:00Z',
};

describe('syncReconciler', () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeMigratedTestDb();
  });
  afterEach(() => db.close());

  it('writes the server running number back to the local document', async () => {
    const docRepo = createCountingDocumentRepo(db);
    await docRepo.upsert(doc);
    const reconciler = createSyncReconciler({
      countingDocumentRepo: docRepo,
      countEntryRepo: createCountEntryRepo(db),
      photoRepo: createPhotoRepo(db),
    });
    await reconciler.onDocumentUpserted({ ...doc, runningNumber: 'CD25060001' });
    expect((await docRepo.findById('d1'))?.runningNumber).toBe('CD25060001');
  });

  it('patches a photo remoteUrl on upload', async () => {
    const photoRepo = createPhotoRepo(db);
    await photoRepo.insert({
      id: 'p1',
      entryId: 'e1',
      localUri: 'file://p1',
      remoteUrl: null,
      capturedAt: '2025-06-01T09:00:00Z',
      uploadStatus: 'queued',
      attempts: 0,
      lastError: null,
    });
    const reconciler = createSyncReconciler({
      countingDocumentRepo: createCountingDocumentRepo(db),
      countEntryRepo: createCountEntryRepo(db),
      photoRepo,
    });
    await reconciler.onPhotoUploaded('p1', { photoId: 'p1', remoteUrl: 'https://cdn/p1.jpg' });
    expect((await photoRepo.findById('p1'))?.remoteUrl).toBe('https://cdn/p1.jpg');
  });
});
