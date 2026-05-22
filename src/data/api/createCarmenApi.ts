import { loadConfig } from '../../platform/config';
import { HttpCarmenApi } from './httpCarmenApi';
import { MockCarmenApi } from './mockCarmenApi';
import type { CarmenApi } from './carmenApi';

export interface CreateCarmenApiOptions {
  getToken: () => string | null;
  onUnauthenticated?: () => Promise<string | null>;
}

export function createCarmenApi(opts: CreateCarmenApiOptions): CarmenApi {
  const cfg = loadConfig();
  if (cfg.apiImpl === 'http') {
    return new HttpCarmenApi({
      baseUrl: cfg.serverBaseUrl,
      getToken: opts.getToken,
      onUnauthenticated: opts.onUnauthenticated,
    });
  }
  return new MockCarmenApi();
}
