import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDb } from '../../data/db/dbContext';
import { useMutationQueue } from '../../data/sync/mutationQueueContext';
import { createCountEntryRepo } from '../../data/repos/countEntryRepo';
import { createPhotoRepo } from '../../data/repos/photoRepo';
import { uuid } from '../../platform/id';
import type { CountEntry } from '../../data/api/carmenApi';

export interface SaveCountEntryInput {
  assetId: string;
  countQty: number;
  location: string;
  observedSerialNo: string;
  observedSpecification: string;
  observedRemark: string;
  comment: string;
  photos?: { id: string; uri: string; mimeType: string }[];
}

export function useSaveCountEntry(documentId: string) {
  const db = useDb();
  const queue = useMutationQueue();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveCountEntryInput): Promise<void> => {
      const repo = createCountEntryRepo(db);
      const photoRepo = createPhotoRepo(db);
      const newPhotos = input.photos ?? [];
      const existing = await repo.findByDocumentAndAsset(documentId, input.assetId);
      const now = new Date().toISOString();
      const entryId = existing?.id ?? uuid();
      const entry: CountEntry = {
        id: entryId,
        documentId,
        assetId: input.assetId,
        unknownCode: null,
        countQty: input.countQty,
        location: input.location || null,
        observedSerialNo: input.observedSerialNo || null,
        observedSpecification: input.observedSpecification || null,
        observedRemark: input.observedRemark || null,
        comment: input.comment,
        photoIds: [...(existing?.photoIds ?? []), ...newPhotos.map((p) => p.id)],
        transferDate: now,
        scannedAt: existing?.scannedAt ?? now,
        updatedAt: now,
      };
      await repo.upsert(entry);
      for (const p of newPhotos) {
        await photoRepo.insert({
          id: p.id,
          entryId,
          localUri: p.uri,
          remoteUrl: null,
          capturedAt: now,
          uploadStatus: 'queued',
          attempts: 0,
          lastError: null,
        });
        await queue.enqueue('photo.upload', { id: p.id, uri: p.uri, mimeType: p.mimeType });
      }
      await queue.enqueue('entry.upsert', { documentId, entries: [entry] });
    },
    onSuccess: (_data, input) => {
      void qc.invalidateQueries({ queryKey: ['assetCountList', documentId] });
      void qc.invalidateQueries({ queryKey: ['countEntry', documentId, input.assetId] });
      void qc.invalidateQueries({ queryKey: ['countingDocuments'] });
      void qc.invalidateQueries({ queryKey: ['entryPhotos'] });
    },
  });
}
