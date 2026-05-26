import type { CountingDocumentRepo } from '../repos/countingDocumentRepo';
import type { CountEntryRepo } from '../repos/countEntryRepo';
import type { PhotoRepo } from '../repos/photoRepo';
import type { SyncReconciler } from './syncWorker';

export interface SyncReconcilerDeps {
  countingDocumentRepo: CountingDocumentRepo;
  countEntryRepo: CountEntryRepo;
  photoRepo: PhotoRepo;
}

export function createSyncReconciler(deps: SyncReconcilerDeps): SyncReconciler {
  return {
    async onDocumentUpserted(doc) {
      await deps.countingDocumentRepo.markSynced(doc);
    },
    async onDocumentCommitted(doc) {
      await deps.countingDocumentRepo.markSynced(doc);
    },
    async onEntriesUpserted(_documentId, entries) {
      await deps.countEntryRepo.markSynced(entries.map((e) => e.id));
    },
    async onPhotoUploaded(localPhotoId, result) {
      await deps.photoRepo.markUploaded(localPhotoId, result.remoteUrl);
    },
  };
}
