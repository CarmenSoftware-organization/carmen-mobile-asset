import { defaultConfig } from './config.default';
import type { ConfigEnv, CustomerConfig } from './types';

const REGISTRY: Record<string, CustomerConfig> = {
  default: defaultConfig,
};

export function loadConfig(env: ConfigEnv = process.env as ConfigEnv): CustomerConfig {
  const slug = env.APP_CUSTOMER ?? 'default';
  const base = REGISTRY[slug];
  if (!base) {
    throw new Error(`Unknown customer slug: ${slug}`);
  }
  return {
    ...base,
    serverBaseUrl: env.APP_SERVER_BASE_URL ?? base.serverBaseUrl,
  };
}

export type { CustomerConfig } from './types';
