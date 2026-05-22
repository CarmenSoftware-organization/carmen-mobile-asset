import { ApiClient } from './apiClient';
import { CarmenApiError } from './errors';
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

interface HttpOptions {
  baseUrl: string;
  getToken: () => string | null;
  fetchImpl?: typeof fetch;
  onUnauthenticated?: () => Promise<string | null>;
}

function notImplemented(name: string): never {
  throw new CarmenApiError('not_implemented', `${name} is not implemented in Plan 2`);
}

function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return '';
  const search = new URLSearchParams(entries.map(([k, v]) => [k, String(v)]));
  return `?${search.toString()}`;
}

export class HttpCarmenApi implements CarmenApi {
  private client: ApiClient;

  constructor(opts: HttpOptions) {
    this.client = new ApiClient(opts);
  }

  async signIn(creds: PasswordCredentials): Promise<Session> {
    return this.client.request<Session>('POST', '/auth/token', { body: creds });
  }

  async refresh(refreshToken: string): Promise<Session> {
    return this.client.request<Session>('POST', '/auth/refresh', { body: { refreshToken } });
  }

  async listAssets(opts: {
    updatedSince?: string;
    cursor?: string;
    limit?: number;
  }): Promise<Page<Asset>> {
    return this.client.request<Page<Asset>>('GET', `/assets${qs(opts)}`);
  }

  async getAssetByCode(code: string): Promise<Asset | null> {
    try {
      return await this.client.request<Asset>('GET', `/assets/by-code/${encodeURIComponent(code)}`);
    } catch (err) {
      if (err instanceof CarmenApiError && err.code === 'not_found') return null;
      throw err;
    }
  }

  async getAsset(id: string): Promise<Asset | null> {
    try {
      return await this.client.request<Asset>('GET', `/assets/${encodeURIComponent(id)}`);
    } catch (err) {
      if (err instanceof CarmenApiError && err.code === 'not_found') return null;
      throw err;
    }
  }

  async listLocations(opts: { updatedSince?: string }): Promise<Location[]> {
    return this.client.request<Location[]>('GET', `/locations${qs(opts)}`);
  }

  async getMe(): Promise<UserProfile> {
    return this.client.request<UserProfile>('GET', '/me');
  }

  async getServerInfo(): Promise<ServerInfo> {
    return this.client.request<ServerInfo>('GET', '/server-info');
  }

  async listCountingDocuments(_opts: {
    status?: 'draft' | 'committed';
  }): Promise<CountingDocument[]> {
    return notImplemented('listCountingDocuments');
  }

  async getCountingDocument(_id: string): Promise<CountingDocument | null> {
    return notImplemented('getCountingDocument');
  }

  async upsertCountingDocument(_doc: CountingDocument): Promise<CountingDocument> {
    return notImplemented('upsertCountingDocument');
  }

  async upsertCountEntries(_d: string, _e: CountEntry[]): Promise<void> {
    return notImplemented('upsertCountEntries');
  }

  async commitCountingDocument(_id: string): Promise<CountingDocument> {
    return notImplemented('commitCountingDocument');
  }

  async uploadPhoto(_f: PhotoUpload): Promise<{ photoId: string; remoteUrl: string }> {
    return notImplemented('uploadPhoto');
  }
}
