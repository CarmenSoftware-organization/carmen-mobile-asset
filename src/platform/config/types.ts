export type AuthStrategyKind = 'password' | 'oidc';

export interface CustomerConfig {
  customerSlug: string;
  brandName: string;
  serverBaseUrl: string;
  primaryColor: string;
  authStrategy: AuthStrategyKind;
  featureFlags: {
    scannerTestPage: boolean;
  };
}

export interface ConfigEnv {
  APP_CUSTOMER?: string;
  APP_SERVER_BASE_URL?: string;
}
