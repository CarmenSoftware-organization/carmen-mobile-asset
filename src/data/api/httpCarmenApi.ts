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

  async listCountingDocuments(opts: {
    status?: CountingDocument['status'];
  }): Promise<CountingDocument[]> {
    return this.client.request<CountingDocument[]>(
      'GET',
      `/counting-documents${qs({ status: opts.status })}`,
    );
  }

  async getCountingDocument(id: string): Promise<CountingDocument | null> {
    try {
      return await this.client.request<CountingDocument>(
        'GET',
        `/counting-documents/${encodeURIComponent(id)}`,
      );
    } catch (err) {
      if (err instanceof CarmenApiError && err.code === 'not_found') return null;
      throw err;
    }
  }

  async upsertCountingDocument(
    doc: CountingDocument,
    idempotencyKey?: string,
  ): Promise<CountingDocument> {
    return this.client.request<CountingDocument>('POST', '/counting-documents', {
      body: doc,
      idempotencyKey,
    });
  }

  async upsertCountEntries(
    documentId: string,
    entries: CountEntry[],
    idempotencyKey?: string,
  ): Promise<void> {
    await this.client.request<void>(
      'PUT',
      `/counting-documents/${encodeURIComponent(documentId)}/entries`,
      { body: { entries }, idempotencyKey },
    );
  }

  async commitCountingDocument(id: string, idempotencyKey?: string): Promise<CountingDocument> {
    return this.client.request<CountingDocument>(
      'POST',
      `/counting-documents/${encodeURIComponent(id)}/commit`,
      { idempotencyKey },
    );
  }

  async uploadPhoto(
    file: PhotoUpload,
    idempotencyKey?: string,
  ): Promise<{ photoId: string; remoteUrl: string }> {
    const form = new FormData();
    form.append('file', {
      uri: file.uri,
      name: file.id,
      type: file.mimeType,
    } as unknown as Blob);
    return this.client.request<{ photoId: string; remoteUrl: string }>('POST', '/uploads', {
      body: form,
      idempotencyKey,
    });
  }
}
