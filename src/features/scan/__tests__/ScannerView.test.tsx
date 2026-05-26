import { render, screen, fireEvent } from '@testing-library/react-native';
import { initI18n, setLocale } from '../../../platform/i18n';
import { ScannerView } from '../ScannerView';

jest.mock('expo-camera', () => ({
  CameraView: () => null,
  useCameraPermissions: () => [{ granted: true }, jest.fn()],
}));

describe('ScannerView', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
    await setLocale('en');
  });

  it('reports a manually entered code and clears the field', () => {
    const onScan = jest.fn();
    render(<ScannerView onScan={onScan} />);
    fireEvent.changeText(screen.getByLabelText('Asset code'), 'AST001');
    fireEvent.press(screen.getByLabelText('Find'));
    expect(onScan).toHaveBeenCalledWith('AST001');
    expect(screen.getByLabelText('Asset code').props.value).toBe('');
  });

  it('does not submit a blank code', () => {
    const onScan = jest.fn();
    render(<ScannerView onScan={onScan} />);
    fireEvent.press(screen.getByLabelText('Find'));
    expect(onScan).not.toHaveBeenCalled();
  });
});
