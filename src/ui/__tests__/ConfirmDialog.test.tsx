import { render, screen, fireEvent } from '@testing-library/react-native';
import { ConfirmDialog } from '../ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders nothing when not visible', () => {
    render(
      <ConfirmDialog
        visible={false}
        title="Void this document?"
        confirmLabel="Void"
        cancelLabel="Cancel"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.queryByText('Void this document?')).toBeNull();
  });

  it('shows title/message and fires the right callbacks', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    render(
      <ConfirmDialog
        visible
        title="Void this document?"
        message="This cannot be undone."
        confirmLabel="Void"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText('Void this document?')).toBeOnTheScreen();
    expect(screen.getByText('This cannot be undone.')).toBeOnTheScreen();

    fireEvent.press(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByText('Void'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
