import type { Asset, Location } from '../repos/types';

export interface PasswordCredentials {
  username: string;
  password: string;
}

export interface Session {
  token: string;
  refreshToken: string;
  expiresAt: string;
  user: UserProfile;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email: string | null;
  roles: string[];
}

export interface ServerInfo {
  version: string;
  minClientVersion: string | null;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  /** Tombstone IDs for items deleted since `updatedSince`. */
  tombstones: string[];
}

export interface CountingDocument {
  id: string;
  runningNumber: string | null;
  locationId: string;
  locationName: string;
  status: 'draft' | 'committed' | 'void';
  countDate: string;
  commitDate: string | null;
  description: string;
  createdBy: string;
  createdAt: string;
}

export interface CountEntry {
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
  photoIds: string[];
  transferDate: string | null;
  scannedAt: string;
  updatedAt: string;
}

export interface PhotoUpload {
  id: string;
  uri: string;
  mimeType: string;
}

export interface CarmenApi {
  // Implemented in Plan 2 (mock + http):
  signIn(creds: PasswordCredentials): Promise<Session>;
  refresh(refreshToken: string): Promise<Session>;
  listAssets(opts: {
    updatedSince?: string;
    cursor?: string;
    limit?: number;
  }): Promise<Page<Asset>>;
  getAssetByCode(code: string): Promise<Asset | null>;
  getAsset(id: string): Promise<Asset | null>;
  listLocations(opts: { updatedSince?: string }): Promise<Location[]>;
  getMe(): Promise<UserProfile>;
  getServerInfo(): Promise<ServerInfo>;

  // Declared but not implemented in Plan 2 (HTTP throws 'not_implemented';
  // mock may implement them for later-plan tests):
  listCountingDocuments(opts: { status?: CountingDocument['status'] }): Promise<CountingDocument[]>;
  getCountingDocument(id: string): Promise<CountingDocument | null>;
  upsertCountingDocument(doc: CountingDocument, idempotencyKey?: string): Promise<CountingDocument>;
  upsertCountEntries(
    documentId: string,
    entries: CountEntry[],
    idempotencyKey?: string,
  ): Promise<void>;
  commitCountingDocument(id: string, idempotencyKey?: string): Promise<CountingDocument>;
  uploadPhoto(
    file: PhotoUpload,
    idempotencyKey?: string,
  ): Promise<{ photoId: string; remoteUrl: string }>;
}
