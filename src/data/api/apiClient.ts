import { CarmenApiError, type CarmenApiErrorCode } from './errors';

interface ApiClientOptions {
  baseUrl: string;
  getToken: () => string | null;
  fetchImpl?: typeof fetch;
  /** Returns a new token on 401, or null/throw to abort. */
  onUnauthenticated?: () => Promise<string | null>;
}

interface RequestOptions {
  body?: unknown;
  idempotencyKey?: string;
}

function mapStatusToCode(status: number, bodyCode?: string): CarmenApiErrorCode {
  if (status === 401) return 'unauthenticated';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 501) return 'not_implemented';
  if (bodyCode === 'asset.not_found' || bodyCode === 'document.not_found') return 'not_found';
  if (status >= 500) return 'server_error';
  return 'unknown';
}

export class ApiClient {
  constructor(private readonly opts: ApiClientOptions) {}

  async request<T = unknown>(method: string, path: string, rOpts: RequestOptions = {}): Promise<T> {
    return this.doRequest<T>(method, path, rOpts, /*retried*/ false);
  }

  private async doRequest<T>(
    method: string,
    path: string,
    rOpts: RequestOptions,
    retried: boolean,
  ): Promise<T> {
    const fetchImpl = this.opts.fetchImpl ?? fetch;
    const url = `${this.opts.baseUrl}${path}`;
    const isFormData = typeof FormData !== 'undefined' && rOpts.body instanceof FormData;
    const headers: Record<string, string> = {};
    if (!isFormData) headers['Content-Type'] = 'application/json';
    const token = this.opts.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (rOpts.idempotencyKey) headers['Idempotency-Key'] = rOpts.idempotencyKey;

    let requestBody: BodyInit | undefined;
    if (rOpts.body !== undefined) {
      requestBody = isFormData ? (rOpts.body as FormData) : JSON.stringify(rOpts.body);
    }

    let response: Response;
    try {
      response = await fetchImpl(url, { method, headers, body: requestBody });
    } catch (err) {
      throw new CarmenApiError('network_error', (err as Error).message, err);
    }

    if (response.status === 401 && !retried && this.opts.onUnauthenticated) {
      const newToken = await this.opts.onUnauthenticated();
      if (newToken) {
        return this.doRequest<T>(method, path, rOpts, true);
      }
    }

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // empty body
    }

    if (response.ok) {
      return body as T;
    }

    const bodyAsRecord = (body ?? {}) as { code?: string; message?: string; details?: unknown };
    throw new CarmenApiError(
      mapStatusToCode(response.status, bodyAsRecord.code),
      bodyAsRecord.message ?? `HTTP ${response.status}`,
      bodyAsRecord.details,
    );
  }
}
