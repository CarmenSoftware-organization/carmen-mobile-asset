import type { CustomerConfig } from './types';

export const defaultConfig: CustomerConfig = {
  customerSlug: 'default',
  brandName: 'Carmen Asset',
  serverBaseUrl: 'http://localhost:4000',
  primaryColor: '#2563eb',
  authStrategy: 'password',
  featureFlags: {
    scannerTestPage: true,
  },
};
