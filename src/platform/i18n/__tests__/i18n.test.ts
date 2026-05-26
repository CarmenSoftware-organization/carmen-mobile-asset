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

  it('resolves the new documents keys', () => {
    expect(t('documents.title')).toBe('Counting Documents');
    expect(t('documents.status.draft')).toBe('Draft');
    expect(t('documents.void.confirm')).toBe('Void');
  });

  it('resolves the detail-list keys', () => {
    expect(t('documents.countFilter.uncounted')).toBe('Uncounted');
    expect(t('documents.sort.name')).toBe('Name');
    expect(t('documents.view')).toBe('View');
  });

  it('resolves the asset-information entry keys', () => {
    expect(t('documents.entry.save')).toBe('Save Asset Count');
    expect(t('documents.entry.discard')).toBe('Discard');
    expect(t('documents.entry.serialNo')).toBe('Serial No');
  });

  it('interpolates values and resolves scan keys', () => {
    expect(t('scan.submit')).toBe('Find');
    expect(t('scan.notFoundInLocation', { location: 'Warehouse A' })).toBe(
      'Not found Asset in location: Warehouse A',
    );
  });

  it('resolves the photos + commit keys', () => {
    expect(t('documents.entry.takePhoto')).toBe('Take Photo');
    expect(t('documents.commit.action')).toBe('Commit Count');
    expect(t('documents.commit.confirm')).toBe('Commit');
  });
});
