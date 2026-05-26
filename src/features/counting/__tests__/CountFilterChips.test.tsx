import { render, screen, fireEvent } from '@testing-library/react-native';
import { initI18n, setLocale } from '../../../platform/i18n';
import { CountFilterChips } from '../CountFilterChips';

describe('CountFilterChips', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
    await setLocale('en');
  });

  it('renders All / Counted / Uncounted', () => {
    render(<CountFilterChips value="all" onChange={() => {}} />);
    expect(screen.getByText('All')).toBeOnTheScreen();
    expect(screen.getByText('Counted')).toBeOnTheScreen();
    expect(screen.getByText('Uncounted')).toBeOnTheScreen();
  });

  it('calls onChange with the chosen filter', () => {
    const onChange = jest.fn();
    render(<CountFilterChips value="all" onChange={onChange} />);
    fireEvent.press(screen.getByText('Uncounted'));
    expect(onChange).toHaveBeenCalledWith('uncounted');
  });
});
