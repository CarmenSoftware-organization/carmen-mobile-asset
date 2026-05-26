import { CarmenApiError } from './errors';
import { seedAssets, seedLocations } from './seedData';
import type {
  CarmenApi,
  CountEntry,
  CountingDocument,
  Page,
  PasswordCredentials,
  PhotoUpload,
  ServerInfo,
  Session,
  UserProfile,
} from './carmenApi';
import type { Asset, Location } from '../repos/types';

interface MockOptions {
  latencyMs?: number;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class MockCarmenApi implements CarmenApi {
  private online = true;
  private latencyMs: number;
  private assets: Asset[] = seedAssets.map((a) => ({ ...a }));
  private locations: Location[] = seedLocations.map((l) => ({ ...l }));
  private documents = new Map<string, CountingDocument>();
  // Stored by upsertCountEntries; read by a later slice's listCountEntries.
  private entries = new Map<string, CountEntry[]>();
  private monthSeq = new Map<string, number>();

  constructor(opts: MockOptions = {}) {
    this.latencyMs = opts.latencyMs ?? 150;
  }

  setOnline(online: boolean) {
    this.online = online;
  }

  private assignRunningNumber(countDate: string): string {
    const d = new Date(countDate);
    const yy = String(d.getUTCFullYear()).slice(-2);
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const key = `${yy}${mm}`;
    const next = (this.monthSeq.get(key) ?? 0) + 1;
    this.monthSeq.set(key, next);
    return `CD${yy}${mm}${String(next).padStart(4, '0')}`;
  }

  private async network<T>(work: () => T): Promise<T> {
    await delay(this.latencyMs);
    if (!this.online) {
      throw new CarmenApiError('network_error', 'mock is offline');
    }
    return work();
  }

  async signIn(creds: PasswordCredentials): Promise<Session> {
    return this.network(() => makeSession(creds.username));
  }

  async refresh(_refreshToken: string): Promise<Session> {
    return this.network(() => makeSession('mock-user'));
  }

  async listAssets(_opts: {
    updatedSince?: string;
    cursor?: string;
    limit?: number;
  }): Promise<Page<Asset>> {
    return this.network(() => ({
      items: this.assets.map((a) => ({ ...a })),
      nextCursor: null,
      tombstones: [],
    }));
  }

  async getAssetByCode(code: string): Promise<Asset | null> {
    return this.network(() => this.assets.find((a) => a.code === code) ?? null);
  }

  async getAsset(id: string): Promise<Asset | null> {
    return this.network(() => this.assets.find((a) => a.id === id) ?? null);
  }

  async listLocations(_opts: { updatedSince?: string }): Promise<Location[]> {
    return this.network(() => this.locations.map((l) => ({ ...l })));
  }

  async getMe(): Promise<UserProfile> {
    return this.network(() => makeUser('mock-user'));
  }

  async getServerInfo(): Promise<ServerInfo> {
    return this.network(() => ({ version: '0.0.0-mock', minClientVersion: null }));
  }

  async listCountingDocuments(opts: {
    status?: 'draft' | 'committed' | 'void';
  }): Promise<CountingDocument[]> {
    return this.network(() => {
      const all = [...this.documents.values()];
      return (opts.status ? all.filter((d) => d.status === opts.status) : all).map((d) => ({
        ...d,
      }));
    });
  }

  async getCountingDocument(id: string): Promise<CountingDocument | null> {
    return this.network(() => {
      const d = this.documents.get(id);
      return d ? { ...d } : null;
    });
  }

  async upsertCountingDocument(doc: CountingDocument, _idempotencyKey?: string): Promise<CountingDocument> {
    return this.network(() => {
      const existing = this.documents.get(doc.id);
      const runningNumber =
        doc.runningNumber ?? existing?.runningNumber ?? this.assignRunningNumber(doc.countDate);
      const saved: CountingDocument = { ...doc, runningNumber };
      this.documents.set(saved.id, saved);
      return { ...saved };
    });
  }

  async upsertCountEntries(documentId: string, entries: CountEntry[], _idempotencyKey?: string): Promise<void> {
    return this.network(() => {
      this.entries.set(
        documentId,
        entries.map((e) => ({ ...e, photoIds: [...e.photoIds] })),
      );
    });
  }

  async commitCountingDocument(id: string, _idempotencyKey?: string): Promise<CountingDocument> {
    return this.network(() => {
      const existing = this.documents.get(id);
      if (!existing) {
        throw new CarmenApiError('not_found', `document ${id} not found`);
      }
      const committed: CountingDocument = {
        ...existing,
        status: 'committed',
        commitDate: new Date().toISOString(),
      };
      this.documents.set(id, committed);
      return { ...committed };
    });
  }

  async uploadPhoto(file: PhotoUpload, _idempotencyKey?: string): Promise<{ photoId: string; remoteUrl: string }> {
    return this.network(() => ({ photoId: file.id, remoteUrl: `mock://photo/${file.id}` }));
  }
}

function makeSession(username: string): Session {
  return {
    token: 'mock-token-' + Date.now(),
    refreshToken: 'mock-refresh-' + Date.now(),
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    user: makeUser(username),
  };
}

function makeUser(displayName: string): UserProfile {
  return {
    id: 'mock-user-1',
    displayName,
    email: 'mock@example.test',
    roles: ['staff'],
  };
}
