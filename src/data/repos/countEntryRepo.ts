import type { SqlExecutor } from '../db/types';
import type { CountEntry } from '../api/carmenApi';

interface EntryRow {
  id: string;
  documentId: string;
  assetId: string | null;
  unknownCode: string | null;
  countQty: number;
  location: string | null;
  observedSerialNo: string | null;
  observedSpecification: string | null;
  observedRemark: string | null;
  comment: string;
  photoIds: string;
  transferDate: string | null;
  scannedAt: string;
  updatedAt: string;
  syncedAt: string | null;
}

function rowToEntry(r: EntryRow): CountEntry {
  return {
    id: r.id,
    documentId: r.documentId,
    assetId: r.assetId,
    unknownCode: r.unknownCode,
    countQty: r.countQty,
    location: r.location,
    observedSerialNo: r.observedSerialNo,
    observedSpecification: r.observedSpecification,
    observedRemark: r.observedRemark,
    comment: r.comment,
    photoIds: JSON.parse(r.photoIds) as string[],
    transferDate: r.transferDate,
    scannedAt: r.scannedAt,
    updatedAt: r.updatedAt,
  };
}

export interface CountEntryRepo {
  upsert(entry: CountEntry): Promise<void>;
  listByDocument(documentId: string): Promise<CountEntry[]>;
  findById(id: string): Promise<CountEntry | null>;
  findByDocumentAndAsset(documentId: string, assetId: string): Promise<CountEntry | null>;
  markSynced(ids: string[]): Promise<void>;
}

export function createCountEntryRepo(db: SqlExecutor): CountEntryRepo {
  return {
    async upsert(e) {
      await db.runAsync(
        `INSERT INTO count_entry (
           id, documentId, assetId, unknownCode, countQty, location,
           observedSerialNo, observedSpecification, observedRemark, comment,
           photoIds, transferDate, scannedAt, updatedAt, syncedAt
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)
         ON CONFLICT(id) DO UPDATE SET
           assetId=excluded.assetId, unknownCode=excluded.unknownCode,
           countQty=excluded.countQty, location=excluded.location,
           observedSerialNo=excluded.observedSerialNo,
           observedSpecification=excluded.observedSpecification,
           observedRemark=excluded.observedRemark, comment=excluded.comment,
           photoIds=excluded.photoIds, transferDate=excluded.transferDate,
           updatedAt=excluded.updatedAt, syncedAt=NULL`,
        [
          e.id, e.documentId, e.assetId, e.unknownCode, e.countQty, e.location,
          e.observedSerialNo, e.observedSpecification, e.observedRemark, e.comment,
          JSON.stringify(e.photoIds), e.transferDate, e.scannedAt, e.updatedAt,
        ],
      );
    },
    async listByDocument(documentId) {
      const rows = await db.getAllAsync<EntryRow>(
        'SELECT * FROM count_entry WHERE documentId = ? ORDER BY scannedAt',
        [documentId],
      );
      return rows.map(rowToEntry);
    },
    async findById(id) {
      const row = await db.getFirstAsync<EntryRow>('SELECT * FROM count_entry WHERE id = ?', [id]);
      return row ? rowToEntry(row) : null;
    },
    async findByDocumentAndAsset(documentId, assetId) {
      const row = await db.getFirstAsync<EntryRow>(
        'SELECT * FROM count_entry WHERE documentId = ? AND assetId = ?',
        [documentId, assetId],
      );
      return row ? rowToEntry(row) : null;
    },
    async markSynced(ids) {
      if (ids.length === 0) return;
      const placeholders = ids.map(() => '?').join(',');
      await db.runAsync(
        `UPDATE count_entry SET syncedAt = ? WHERE id IN (${placeholders})`,
        [new Date().toISOString(), ...ids],
      );
    },
  };
}
