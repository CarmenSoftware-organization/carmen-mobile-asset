import { initI18n, t, setLocale } from '../index';

describe('i18n', () => {
  beforeAll(() => initI18n({ defaultLocale: 'en' }));
  afterEach(async () => {
    await setLocale('en');
  });

  it('returns English string by default', () => {
    expect(t('home.title')).toBe('Asset Checker');
  });

  it('switches to Thai', async () => {
    await setLocale('th');
    expect(t('home.title')).toBe('ตรวจนับสินทรัพย์');
  });

  it('falls back to key when missing', async () => {
    await setLocale('en');
    expect(t('does.not.exist')).toBe('does.not.exist');
  });
});
