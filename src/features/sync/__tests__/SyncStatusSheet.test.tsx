import { fireEvent, render, screen } from '@testing-library/react-native';
import { useSyncStore } from '../../../data/sync/syncStore';
import { initI18n, setLocale } from '../../../platform/i18n';
import { SyncStatusSheet } from '../SyncStatusSheet';

describe('SyncStatusSheet', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
    await setLocale('en');
  });

  beforeEach(() => {
    useSyncStore.setState({ status: 'idle', queued: 0, lastSuccessAt: null, lastError: null });
  });

  it('shows "Never" when no successful sync recorded', () => {
    render(<SyncStatusSheet onSyncNow={() => {}} />);
    expect(screen.getByText('Never')).toBeOnTheScreen();
  });

  it('shows queued count and last error when present', () => {
    useSyncStore.setState({ status: 'error', queued: 3, lastSuccessAt: null, lastError: 'boom' });
    render(<SyncStatusSheet onSyncNow={() => {}} />);
    expect(screen.getByText('3')).toBeOnTheScreen();
    expect(screen.getByText('boom')).toBeOnTheScreen();
  });

  it('disables the sync button while syncing', () => {
    useSyncStore.setState({ status: 'syncing', queued: 0, lastSuccessAt: null, lastError: null });
    const onSyncNow = jest.fn();
    render(<SyncStatusSheet onSyncNow={onSyncNow} />);
    fireEvent.press(screen.getByText('Syncing…'));
    expect(onSyncNow).not.toHaveBeenCalled();
  });

  it('calls onSyncNow when tapped while idle', () => {
    const onSyncNow = jest.fn();
    render(<SyncStatusSheet onSyncNow={onSyncNow} />);
    fireEvent.press(screen.getByText('Sync now'));
    expect(onSyncNow).toHaveBeenCalled();
  });
});
