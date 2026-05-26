import type { Migration } from './types';

const SCHEMA_V1 = `
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  department TEXT,
  locationId TEXT,
  locationName TEXT,
  quantity INTEGER,
  remainQty INTEGER,
  price REAL,
  currency TEXT,
  totalAmount REAL,
  inputDate TEXT,
  acquireDate TEXT,
  assetLife TEXT,
  remark TEXT,
  imageUrl TEXT,
  updatedAt TEXT NOT NULL,
  syncedAt TEXT NOT NULL
);
CREATE INDEX idx_assets_code ON assets(code);
CREATE INDEX idx_assets_locationId ON assets(locationId);

CREATE TABLE locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  syncedAt TEXT NOT NULL
);

CREATE TABLE pending_mutations (
  id TEXT PRIMARY KEY,
  idempotencyKey TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  lastError TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX idx_pending_status ON pending_mutations(status, createdAt);

CREATE TABLE _meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

const SCHEMA_V2 = `
ALTER TABLE assets ADD COLUMN serialNo TEXT;
ALTER TABLE assets ADD COLUMN specification TEXT;

CREATE TABLE counting_document (
  id TEXT PRIMARY KEY,
  runningNumber TEXT,
  locationId TEXT NOT NULL,
  locationName TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  countDate TEXT NOT NULL,
  commitDate TEXT,
  description TEXT NOT NULL DEFAULT '',
  createdBy TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  syncedAt TEXT
);
CREATE INDEX idx_counting_document_status ON counting_document(status, countDate);

CREATE TABLE count_entry (
  id TEXT PRIMARY KEY,
  documentId TEXT NOT NULL,
  assetId TEXT,
  unknownCode TEXT,
  countQty INTEGER NOT NULL DEFAULT 0,
  location TEXT,
  observedSerialNo TEXT,
  observedSpecification TEXT,
  observedRemark TEXT,
  comment TEXT NOT NULL DEFAULT '',
  photoIds TEXT NOT NULL DEFAULT '[]',
  transferDate TEXT,
  scannedAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  syncedAt TEXT
);
CREATE INDEX idx_count_entry_documentId ON count_entry(documentId);
CREATE UNIQUE INDEX idx_count_entry_doc_asset ON count_entry(documentId, assetId);

CREATE TABLE photo (
  id TEXT PRIMARY KEY,
  entryId TEXT NOT NULL,
  localUri TEXT NOT NULL,
  remoteUrl TEXT,
  capturedAt TEXT NOT NULL,
  uploadStatus TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  lastError TEXT
);
CREATE INDEX idx_photo_entryId ON photo(entryId);
`;

export const migrations: Migration[] = [
  {
    version: 1,
    async up(db) {
      await db.execAsync(SCHEMA_V1);
    },
  },
  {
    version: 2,
    async up(db) {
      await db.execAsync(SCHEMA_V2);
    },
  },
];
