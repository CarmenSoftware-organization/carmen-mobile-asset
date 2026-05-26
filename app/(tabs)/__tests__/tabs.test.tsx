import { render, screen } from '@testing-library/react-native';
import { initI18n, setLocale } from '../../../src/platform/i18n';
import HomeScreen from '../index';

describe('Home tab', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
    await setLocale('en');
  });

  it('renders the localized title', () => {
    render(<HomeScreen />);
    expect(screen.getByText('Asset Checker')).toBeOnTheScreen();
  });

  it('renders the three counting actions', () => {
    render(<HomeScreen />);
    expect(screen.getByText('Scan QR Code')).toBeOnTheScreen();
    expect(screen.getByText('Create New Counting Document')).toBeOnTheScreen();
    expect(screen.getByText('View All Counting Documents')).toBeOnTheScreen();
  });
});
