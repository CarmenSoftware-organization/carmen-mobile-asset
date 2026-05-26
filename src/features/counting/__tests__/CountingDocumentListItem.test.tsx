import { render, screen, fireEvent } from '@testing-library/react-native';
import { initI18n, setLocale } from '../../../platform/i18n';
import { CountingDocumentListItem } from '../CountingDocumentListItem';
import type { CountingDocument } from '../../../data/api/carmenApi';

const base: CountingDocument = {
  id: 'd1',
  runningNumber: null,
  locationId: 'loc1',
  locationName: 'Building A Floor 1',
  status: 'draft',
  countDate: '2026-05-26',
  commitDate: null,
  description: '',
  createdBy: 'u-1',
  createdAt: '2026-05-26T08:00:00Z',
};

describe('CountingDocumentListItem', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
    await setLocale('en');
  });

  it('shows "Pending" + a void button for a draft without a running number', () => {
    const onVoid = jest.fn();
    render(<CountingDocumentListItem document={base} countedTotal={3} onVoid={onVoid} />);
    expect(screen.getByText('Pending')).toBeOnTheScreen();
    expect(screen.getByText('Building A Floor 1')).toBeOnTheScreen();
    expect(screen.getByText('2026-05-26')).toBeOnTheScreen();
    expect(screen.getByText('Draft')).toBeOnTheScreen();
    expect(screen.getByText('3')).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('Void'));
    expect(onVoid).toHaveBeenCalledWith(base);
  });

  it('shows the running number and no void button for a committed document', () => {
    const committed: CountingDocument = {
      ...base,
      status: 'committed',
      runningNumber: 'CD26050001',
    };
    render(<CountingDocumentListItem document={committed} countedTotal={0} />);
    expect(screen.getByText('CD26050001')).toBeOnTheScreen();
    expect(screen.getByText('Committed')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Void')).toBeNull();
  });

  it('renders a view button that fires onView for any status', () => {
    const onView = jest.fn();
    const committed: CountingDocument = { ...base, status: 'committed', runningNumber: 'CD26050001' };
    render(<CountingDocumentListItem document={committed} countedTotal={0} onView={onView} />);
    fireEvent.press(screen.getByLabelText('View'));
    expect(onView).toHaveBeenCalledWith(committed);
  });
});
