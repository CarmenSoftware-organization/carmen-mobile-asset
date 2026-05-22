import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { initI18n, setLocale } from '../../../platform/i18n';
import { SignInForm } from '../SignInForm';

describe('SignInForm', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
    await setLocale('en');
  });

  it('shows missing-fields error when submitted empty', async () => {
    const onSubmit = jest.fn();
    render(<SignInForm onSubmit={onSubmit} />);
    fireEvent.press(screen.getByText('Sign in'));
    await waitFor(() => {
      expect(screen.getByText('Please enter both username and password')).toBeOnTheScreen();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with credentials when filled', async () => {
    const onSubmit = jest.fn(async () => undefined);
    render(<SignInForm onSubmit={onSubmit} />);
    fireEvent.changeText(screen.getByPlaceholderText('Username'), 'alice');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'secret');
    fireEvent.press(screen.getByText('Sign in'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ username: 'alice', password: 'secret' });
    });
  });

  it('shows signing-in state while pending', async () => {
    let resolve: () => void = () => {};
    const onSubmit = jest.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );
    render(<SignInForm onSubmit={onSubmit} />);
    fireEvent.changeText(screen.getByPlaceholderText('Username'), 'a');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'b');
    fireEvent.press(screen.getByText('Sign in'));
    await waitFor(() => {
      expect(screen.getByText('Signing in…')).toBeOnTheScreen();
    });
    resolve();
  });

  it('shows the provided errorCode message when present', async () => {
    render(<SignInForm onSubmit={jest.fn()} errorCode="auth.error.invalid" />);
    expect(screen.getByText('Invalid username or password')).toBeOnTheScreen();
  });
});
