import { render, screen } from '@testing-library/react-native';
import { initI18n, setLocale } from '../../platform/i18n';
import { useSyncStore } from '../../data/sync/syncStore';
import { Header } from '../Header';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

describe('Header', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
    await setLocale('en');
  });

  beforeEach(() => {
    useSyncStore.setState({
      status: 'idle',
      queued: 0,
      lastSuccessAt: null,
      lastError: null,
    });
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
