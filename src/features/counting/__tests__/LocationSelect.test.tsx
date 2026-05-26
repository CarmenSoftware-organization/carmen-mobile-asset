import { render, screen, fireEvent } from '@testing-library/react-native';
import { initI18n, setLocale } from '../../../platform/i18n';
import { LocationSelect } from '../LocationSelect';
import type { Location } from '../../../data/repos/types';

const locations: Location[] = [
  { id: 'loc1', name: 'Building A Floor 1', updatedAt: '2026-05-22T10:00:00Z' },
  { id: 'wh-a', name: 'Warehouse A', updatedAt: '2026-05-22T10:00:00Z' },
];

describe('LocationSelect', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
    await setLocale('en');
  });

  it('shows the current value and reports a new selection', () => {
    const onChange = jest.fn();
    render(<LocationSelect value="Building A Floor 1" options={locations} onChange={onChange} />);
    expect(screen.getByText('Building A Floor 1')).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('Location'));
    fireEvent.press(screen.getByText('Warehouse A'));
    expect(onChange).toHaveBeenCalledWith('Warehouse A');
  });

  it('does not open when disabled', () => {
    const onChange = jest.fn();
    render(<LocationSelect value="Building A Floor 1" options={locations} onChange={onChange} disabled />);
    fireEvent.press(screen.getByLabelText('Location'));
    expect(screen.queryByText('Warehouse A')).toBeNull();
  });
});
