import { render, screen, fireEvent } from '@testing-library/react-native';
import { initI18n, setLocale } from '../../../platform/i18n';
import { AssetCountListItem } from '../AssetCountListItem';
import type { AssetCountRow } from '../filterSortAssetCounts';
import type { Asset } from '../../../data/repos/types';

const asset: Asset = {
  id: 'a1',
  code: 'AST001',
  name: 'Desktop Computer',
  category: 'IT Equipment',
  department: 'Finance',
  locationId: 'loc1',
  locationName: 'Building A Floor 1',
  quantity: 1,
  remainQty: 9,
  price: null,
  currency: null,
  totalAmount: null,
  inputDate: '2024-01-15',
  acquireDate: '2024-01-10',
  assetLife: '2y 4m',
  remark: null,
  imageUrl: null,
  serialNo: null,
  specification: null,
  updatedAt: '2026-05-22T10:00:00Z',
};
const row: AssetCountRow = { asset, countedQty: 2 };

describe('AssetCountListItem', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
    await setLocale('en');
  });

  it('renders asset fields, catalog metadata, and the current counted qty', () => {
    render(<AssetCountListItem row={row} onChangeQty={() => {}} />);
    expect(screen.getByText('AST001')).toBeOnTheScreen();
    expect(screen.getByText('Desktop Computer')).toBeOnTheScreen();
    expect(screen.getByText('IT Equipment')).toBeOnTheScreen();
    expect(screen.getByText('Finance')).toBeOnTheScreen();
    expect(screen.getByText(/Remain Qty: 9/)).toBeOnTheScreen();
    expect(screen.getByText(/Input Date: 2024-01-15/)).toBeOnTheScreen();
    expect(screen.getByLabelText('counted quantity').props.value).toBe('2');
  });

  it('reports the asset id and new qty when incremented', () => {
    const onChangeQty = jest.fn();
    render(<AssetCountListItem row={row} onChangeQty={onChangeQty} />);
    fireEvent.press(screen.getByLabelText('increment'));
    expect(onChangeQty).toHaveBeenCalledWith('a1', 3);
  });

  it('disables the stepper when locked', () => {
    const onChangeQty = jest.fn();
    render(<AssetCountListItem row={row} onChangeQty={onChangeQty} disabled />);
    fireEvent.press(screen.getByLabelText('increment'));
    expect(onChangeQty).not.toHaveBeenCalled();
  });
});
