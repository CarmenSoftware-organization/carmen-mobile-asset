import { render, screen } from '@testing-library/react-native';
import { initI18n, setLocale } from '../../../platform/i18n';
import { AssetDetailView } from '../AssetDetailView';
import type { Asset } from '../../../data/repos/types';

const sample: Asset = {
  id: 'a1',
  code: 'AST001',
  name: 'Desktop Computer',
  category: 'IT Equipment',
  department: 'Finance',
  locationId: 'loc1',
  locationName: 'Building A Floor 1',
  quantity: 1,
  remainQty: 1,
  price: 1200,
  currency: 'USD',
  totalAmount: 1200,
  inputDate: '2024-01-15',
  acquireDate: '2024-01-10',
  assetLife: '2 ปี 4 เดือน',
  remark: 'In good condition',
  imageUrl: null,
  updatedAt: '2026-05-22T10:00:00Z',
};

describe('AssetDetailView', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
    await setLocale('en');
  });

  it('renders every defined field', () => {
    render(<AssetDetailView asset={sample} />);
    expect(screen.getByText('AST001')).toBeOnTheScreen();
    expect(screen.getByText('Desktop Computer')).toBeOnTheScreen();
    expect(screen.getByText('Finance')).toBeOnTheScreen();
    expect(screen.getByText('Building A Floor 1')).toBeOnTheScreen();
    expect(screen.getByText('2 ปี 4 เดือน')).toBeOnTheScreen();
    expect(screen.getAllByText('USD 1200').length).toBeGreaterThan(0);
    expect(screen.getByText('In good condition')).toBeOnTheScreen();
  });

  it('omits rows for null fields', () => {
    const minimal: Asset = { ...sample, remark: null, category: null };
    render(<AssetDetailView asset={minimal} />);
    expect(screen.queryByText('Remark')).toBeNull();
    expect(screen.queryByText('Category')).toBeNull();
  });
});
