import defaultConfig from './customers/default.json';
import type { ApiImplKind, ConfigEnv, CustomerConfig } from './types';

const REGISTRY: Record<string, CustomerConfig> = {
  default: defaultConfig as CustomerConfig,
};

export function loadConfig(env: ConfigEnv = process.env as ConfigEnv): CustomerConfig {
  const slug = env.APP_CUSTOMER ?? 'default';
  const base = REGISTRY[slug];
  if (!base) {
    throw new Error(`Unknown customer slug: ${slug}`);
  }
  const apiImplOverride = env.APP_API_IMPL as ApiImplKind | undefined;
  return {
    ...base,
    serverBaseUrl: env.APP_SERVER_BASE_URL ?? base.serverBaseUrl,
    apiImpl: apiImplOverride ?? base.apiImpl,
  };
}

export type { CustomerConfig } from './types';
