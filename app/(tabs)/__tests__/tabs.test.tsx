import { render, screen } from '@testing-library/react-native';
import { initI18n } from '../../../src/platform/i18n';
import HomeScreen from '../index';

describe('Home tab', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
  });

  it('renders the localized title', () => {
    render(<HomeScreen />);
    expect(screen.getByText('Asset Checker')).toBeOnTheScreen();
  });
});
