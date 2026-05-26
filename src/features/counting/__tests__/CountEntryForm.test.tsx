import { render, screen, fireEvent } from '@testing-library/react-native';
import { initI18n, setLocale } from '../../../platform/i18n';
import { CountEntryForm, type CountEntryFormValues } from '../CountEntryForm';
import type { Asset } from '../../../data/repos/types';
import type { Location } from '../../../data/repos/types';

const asset: Asset = {
  id: 'a1',
  code: 'AST001',
  name: 'Desktop Computer',
  category: 'IT Equipment',
  department: 'Finance',
  locationId: 'loc1',
  locationName: 'Building A Floor 1',
  quantity: 1,
  remainQty: 1,
  price: null,
  currency: null,
  totalAmount: null,
  inputDate: '2024-01-15',
  acquireDate: '2024-01-10',
  assetLife: '2y',
  remark: null,
  imageUrl: null,
  serialNo: 'SN-DC-1',
  specification: 'i5',
  updatedAt: '2026-05-22T10:00:00Z',
};
const locations: Location[] = [
  { id: 'loc1', name: 'Building A Floor 1', updatedAt: '2026-05-22T10:00:00Z' },
  { id: 'wh-a', name: 'Warehouse A', updatedAt: '2026-05-22T10:00:00Z' },
];
const initial: CountEntryFormValues = {
  countQty: 1,
  location: 'Building A Floor 1',
  observedSerialNo: 'SN-DC-1',
  observedSpecification: 'i5',
  observedRemark: '',
  comment: '',
};

function setup(over: Partial<React.ComponentProps<typeof CountEntryForm>> = {}) {
  const props = {
    asset,
    transferDate: null as string | null,
    initial,
    locations,
    locked: false,
    existingPhotoUris: [] as string[],
    onCapturePhoto: jest.fn(async () => ({ uri: 'file://new.jpg', mimeType: 'image/jpeg' })),
    onSave: jest.fn(),
    onBack: jest.fn(),
    ...over,
  };
  render(<CountEntryForm {...props} />);
  return props;
}

describe('CountEntryForm', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
    await setLocale('en');
  });

  it('renders asset info and prefilled editable values', () => {
    setup();
    expect(screen.getByText('AST001')).toBeOnTheScreen();
    expect(screen.getByText('Desktop Computer')).toBeOnTheScreen();
    expect(screen.getByLabelText('Serial No').props.value).toBe('SN-DC-1');
    expect(screen.getByLabelText('counted quantity').props.value).toBe('1');
  });

  it('saves the edited values', () => {
    const props = setup();
    fireEvent.changeText(screen.getByLabelText('Comment'), 'all good');
    fireEvent.press(screen.getByLabelText('increment'));
    fireEvent.press(screen.getByText('Save Asset Count'));
    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ comment: 'all good', countQty: 2 }),
      [],
    );
  });

  it('goes back directly when there are no edits', () => {
    const props = setup();
    fireEvent.press(screen.getByText('Back'));
    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Discard changes?')).toBeNull();
  });

  it('shows a discard confirm when leaving with unsaved edits', () => {
    const props = setup();
    fireEvent.changeText(screen.getByLabelText('Comment'), 'dirty');
    fireEvent.press(screen.getByText('Back'));
    expect(props.onBack).not.toHaveBeenCalled();
    expect(screen.getByText('Discard changes?')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Discard'));
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  it('hides Save and disables editing when locked', () => {
    const props = setup({ locked: true });
    expect(screen.queryByText('Save Asset Count')).toBeNull();
    fireEvent.press(screen.getByLabelText('increment'));
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('captures a photo, shows a thumbnail, and includes it on save', async () => {
    const props = setup();
    fireEvent.press(screen.getByLabelText('Take Photo'));
    await screen.findByLabelText('photo');
    expect(screen.getAllByLabelText('photo')).toHaveLength(1);
    fireEvent.press(screen.getByText('Save Asset Count'));
    expect(props.onSave).toHaveBeenCalledWith(expect.any(Object), [
      expect.objectContaining({ uri: 'file://new.jpg', mimeType: 'image/jpeg' }),
    ]);
  });

  it('shows existing photo thumbnails', () => {
    setup({ existingPhotoUris: ['file://a.jpg', 'file://b.jpg'] });
    expect(screen.getAllByLabelText('photo')).toHaveLength(2);
  });
});
