import { render, screen, fireEvent } from '@testing-library/react-native';
import { useSyncStore } from '../../../data/sync/syncStore';
import { SyncIndicator } from '../SyncIndicator';

describe('SyncIndicator', () => {
  beforeEach(() => {
    useSyncStore.setState({
      status: 'idle',
      queued: 0,
      lastSuccessAt: null,
      lastError: null,
    });
  });

  it('renders the sync-status accessibility label', () => {
    render(<SyncIndicator onPress={() => {}} />);
    expect(screen.getByLabelText('sync-status')).toBeOnTheScreen();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    render(<SyncIndicator onPress={onPress} />);
    fireEvent.press(screen.getByLabelText('sync-status'));
    expect(onPress).toHaveBeenCalled();
  });
});
