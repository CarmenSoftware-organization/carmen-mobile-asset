import type { SqlExecutor } from '../db/types';
import type { CountingDocument } from '../api/carmenApi';

interface DocRow extends CountingDocument {
  updatedAt: string;
  syncedAt: string | null;
}

function rowToDoc(r: DocRow): CountingDocument {
  return {
    id: r.id,
    runningNumber: r.runningNumber,
    locationId: r.locationId,
    locationName: r.locationName,
    status: r.status,
    countDate: r.countDate,
    commitDate: r.commitDate,
    description: r.description,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
  };
}

async function writeDoc(db: SqlExecutor, doc: CountingDocument, syncedAt: string | null) {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO counting_document (
       id, runningNumber, locationId, locationName, status, countDate,
       commitDate, description, createdBy, createdAt, updatedAt, syncedAt
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       runningNumber=excluded.runningNumber, locationId=excluded.locationId,
       locationName=excluded.locationName, status=excluded.status,
       countDate=excluded.countDate, commitDate=excluded.commitDate,
       description=excluded.description, updatedAt=excluded.updatedAt,
       syncedAt=excluded.syncedAt`,
    [
      doc.id,
      doc.runningNumber,
      doc.locationId,
      doc.locationName,
      doc.status,
      doc.countDate,
      doc.commitDate,
      doc.description,
      doc.createdBy,
      doc.createdAt,
      now,
      syncedAt,
    ],
  );
}

export interface CountingDocumentRepo {
  upsert(doc: CountingDocument): Promise<void>;
  markSynced(doc: CountingDocument): Promise<void>;
  list(opts?: { status?: CountingDocument['status'] }): Promise<CountingDocument[]>;
  findById(id: string): Promise<CountingDocument | null>;
}

export function createCountingDocumentRepo(db: SqlExecutor): CountingDocumentRepo {
  return {
    upsert: (doc) => writeDoc(db, doc, null),
    markSynced: (doc) => writeDoc(db, doc, new Date().toISOString()),
    async list(opts) {
      if (opts?.status) {
        const rows = await db.getAllAsync<DocRow>(
          'SELECT * FROM counting_document WHERE status = ? ORDER BY countDate DESC, createdAt DESC',
          [opts.status],
        );
        return rows.map(rowToDoc);
      }
      const rows = await db.getAllAsync<DocRow>(
        'SELECT * FROM counting_document ORDER BY countDate DESC, createdAt DESC',
      );
      return rows.map(rowToDoc);
    },
    async findById(id) {
      const row = await db.getFirstAsync<DocRow>('SELECT * FROM counting_document WHERE id = ?', [
        id,
      ]);
      return row ? rowToDoc(row) : null;
    },
  };
}
