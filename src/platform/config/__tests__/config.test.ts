import { loadConfig } from '../index';

describe('loadConfig', () => {
  it('returns default config when APP_CUSTOMER is unset', () => {
    const cfg = loadConfig({ APP_CUSTOMER: undefined });
    expect(cfg.customerSlug).toBe('default');
    expect(cfg.serverBaseUrl).toBe('http://localhost:4000');
    expect(cfg.brandName).toBe('Carmen Asset');
    expect(cfg.apiImpl).toBe('mock');
  });

  it('overrides serverBaseUrl from env', () => {
    const cfg = loadConfig({
      APP_CUSTOMER: 'default',
      APP_SERVER_BASE_URL: 'https://api.example.com',
    });
    expect(cfg.serverBaseUrl).toBe('https://api.example.com');
  });

  it('overrides apiImpl from env', () => {
    const cfg = loadConfig({ APP_API_IMPL: 'http' });
    expect(cfg.apiImpl).toBe('http');
  });

  it('throws on unknown customer slug', () => {
    expect(() => loadConfig({ APP_CUSTOMER: 'nonexistent' })).toThrow(/Unknown customer/);
  });
});
