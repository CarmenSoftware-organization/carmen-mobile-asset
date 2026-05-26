import type { SqlExecutor } from '../db/types';
import type { Photo } from './types';

export interface PhotoRepo {
  insert(photo: Photo): Promise<void>;
  listByEntry(entryId: string): Promise<Photo[]>;
  findById(id: string): Promise<Photo | null>;
  markUploaded(id: string, remoteUrl: string): Promise<void>;
}

export function createPhotoRepo(db: SqlExecutor): PhotoRepo {
  return {
    async insert(p) {
      await db.runAsync(
        `INSERT INTO photo (id, entryId, localUri, remoteUrl, capturedAt, uploadStatus, attempts, lastError)
         VALUES (?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET
           remoteUrl=excluded.remoteUrl, uploadStatus=excluded.uploadStatus,
           attempts=excluded.attempts, lastError=excluded.lastError`,
        [p.id, p.entryId, p.localUri, p.remoteUrl, p.capturedAt, p.uploadStatus, p.attempts, p.lastError],
      );
    },
    async listByEntry(entryId) {
      return db.getAllAsync<Photo>(
        'SELECT * FROM photo WHERE entryId = ? ORDER BY capturedAt',
        [entryId],
      );
    },
    async findById(id) {
      return db.getFirstAsync<Photo>('SELECT * FROM photo WHERE id = ?', [id]);
    },
    async markUploaded(id, remoteUrl) {
      await db.runAsync(
        "UPDATE photo SET remoteUrl = ?, uploadStatus = 'done', lastError = NULL WHERE id = ?",
        [remoteUrl, id],
      );
    },
  };
}
