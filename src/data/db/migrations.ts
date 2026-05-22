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

export const migrations: Migration[] = [
  {
    version: 1,
    async up(db) {
      await db.execAsync(SCHEMA_V1);
    },
  },
];
