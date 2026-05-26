import { render, screen, fireEvent } from '@testing-library/react-native';
import { initI18n, setLocale } from '../../../platform/i18n';
import { StatusFilterChips } from '../StatusFilterChips';

describe('StatusFilterChips', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
    await setLocale('en');
  });

  it('renders all three status chips', () => {
    render(<StatusFilterChips value="draft" onChange={() => {}} />);
    expect(screen.getByText('Draft')).toBeOnTheScreen();
    expect(screen.getByText('Committed')).toBeOnTheScreen();
    expect(screen.getByText('Void')).toBeOnTheScreen();
  });

  it('calls onChange with the chosen status', () => {
    const onChange = jest.fn();
    render(<StatusFilterChips value="draft" onChange={onChange} />);
    fireEvent.press(screen.getByText('Committed'));
    expect(onChange).toHaveBeenCalledWith('committed');
  });

  it('marks the active chip as selected', () => {
    render(<StatusFilterChips value="void" onChange={() => {}} />);
    expect(screen.getByLabelText('Void').props.accessibilityState).toEqual({ selected: true });
  });
});
