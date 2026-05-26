import { render, screen } from '@testing-library/react-native';
import { initI18n, setLocale } from '../../../platform/i18n';
import { CountingDocumentHeader } from '../CountingDocumentHeader';
import type { CountingDocument } from '../../../data/api/carmenApi';

const base: CountingDocument = {
  id: 'd1',
  runningNumber: null,
  locationId: 'loc1',
  locationName: 'Building A Floor 1',
  status: 'draft',
  countDate: '2026-05-26',
  commitDate: null,
  description: 'Monthly count',
  createdBy: 'u-1',
  createdAt: '2026-05-26T08:00:00Z',
};

describe('CountingDocumentHeader', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
    await setLocale('en');
  });

  it('shows Pending, status, location, count date, description for a draft', () => {
    render(<CountingDocumentHeader document={base} />);
    expect(screen.getByText('Pending')).toBeOnTheScreen();
    expect(screen.getByText('Draft')).toBeOnTheScreen();
    expect(screen.getByText('Building A Floor 1')).toBeOnTheScreen();
    expect(screen.getByText('2026-05-26')).toBeOnTheScreen();
    expect(screen.getByText('Monthly count')).toBeOnTheScreen();
  });

  it('shows running number and commit date for a committed document', () => {
    const committed: CountingDocument = {
      ...base,
      status: 'committed',
      runningNumber: 'CD26050001',
      commitDate: '2026-05-27',
    };
    render(<CountingDocumentHeader document={committed} />);
    expect(screen.getByText('CD26050001')).toBeOnTheScreen();
    expect(screen.getByText('Committed')).toBeOnTheScreen();
    expect(screen.getByText('2026-05-27')).toBeOnTheScreen();
  });
});
