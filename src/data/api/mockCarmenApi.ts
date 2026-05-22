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

  constructor(opts: MockOptions = {}) {
    this.latencyMs = opts.latencyMs ?? 150;
  }

  setOnline(online: boolean) {
    this.online = online;
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

  async listCountingDocuments(): Promise<CountingDocument[]> {
    return this.network(() => []);
  }

  async getCountingDocument(): Promise<CountingDocument | null> {
    return this.network(() => null);
  }

  async upsertCountingDocument(doc: CountingDocument): Promise<CountingDocument> {
    return this.network(() => ({ ...doc, runningNumber: doc.runningNumber ?? 'CNT-MOCK-001' }));
  }

  async upsertCountEntries(_documentId: string, _entries: CountEntry[]): Promise<void> {
    return this.network(() => undefined);
  }

  async commitCountingDocument(id: string): Promise<CountingDocument> {
    return this.network(() => ({
      id,
      runningNumber: 'CNT-MOCK-001',
      locationId: 'loc1',
      locationName: 'Building A Floor 1',
      status: 'committed',
      countDate: new Date().toISOString(),
      commitDate: new Date().toISOString(),
      description: '',
      createdBy: 'mock-user',
      createdAt: new Date().toISOString(),
    }));
  }

  async uploadPhoto(_file: PhotoUpload): Promise<{ photoId: string; remoteUrl: string }> {
    return this.network(() => ({ photoId: 'mock-photo-' + Date.now(), remoteUrl: 'mock://photo' }));
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
