export type AuthStrategyKind = 'password' | 'oidc';
export type ApiImplKind = 'mock' | 'http';

export interface CustomerConfig {
  customerSlug: string;
  brandName: string;
  serverBaseUrl: string;
  primaryColor: string;
  authStrategy: AuthStrategyKind;
  apiImpl: ApiImplKind;
  featureFlags: {
    scannerTestPage: boolean;
    devApiToggle: boolean;
  };
}

export interface ConfigEnv {
  APP_CUSTOMER?: string;
  APP_SERVER_BASE_URL?: string;
  APP_API_IMPL?: string;
}
