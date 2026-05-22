import { render, screen } from '@testing-library/react-native';
import { initI18n, setLocale } from '../../../platform/i18n';
import { AssetListItem } from '../AssetListItem';
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
  remark: null,
  imageUrl: null,
  updatedAt: '2026-05-22T10:00:00Z',
};

describe('AssetListItem', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
    await setLocale('en');
  });

  it('renders code, name, category, and department', () => {
    render(<AssetListItem asset={sample} />);
    expect(screen.getByText('AST001')).toBeOnTheScreen();
    expect(screen.getByText('Desktop Computer')).toBeOnTheScreen();
    expect(screen.getByText('IT Equipment')).toBeOnTheScreen();
    expect(screen.getByText('Finance')).toBeOnTheScreen();
  });
});
