import { render, screen } from '@testing-library/react-native';
import { initI18n, setLocale } from '../../platform/i18n';
import { Header } from '../Header';

describe('Header', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
    await setLocale('en');
  });

  it('renders the title', () => {
    render(<Header title="Asset Checker" />);
    expect(screen.getByText('Asset Checker')).toBeOnTheScreen();
  });

  it('renders the sync indicator placeholder', () => {
    render(<Header title="Asset Checker" />);
    expect(screen.getByLabelText('sync-status')).toBeOnTheScreen();
  });
});
