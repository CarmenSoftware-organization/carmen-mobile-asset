import { render, screen, fireEvent } from '@testing-library/react-native';
import { QtyStepper } from '../QtyStepper';

describe('QtyStepper', () => {
  it('increments and decrements', () => {
    const onChange = jest.fn();
    render(<QtyStepper value={2} onChange={onChange} />);
    fireEvent.press(screen.getByLabelText('increment'));
    expect(onChange).toHaveBeenCalledWith(3);
    fireEvent.press(screen.getByLabelText('decrement'));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('does not decrement below zero', () => {
    const onChange = jest.fn();
    render(<QtyStepper value={0} onChange={onChange} />);
    fireEvent.press(screen.getByLabelText('decrement'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('accepts direct numeric input', () => {
    const onChange = jest.fn();
    render(<QtyStepper value={1} onChange={onChange} />);
    fireEvent.changeText(screen.getByLabelText('counted quantity'), '7');
    expect(onChange).toHaveBeenCalledWith(7);
  });

  it('does not fire when disabled', () => {
    const onChange = jest.fn();
    render(<QtyStepper value={3} onChange={onChange} disabled />);
    fireEvent.press(screen.getByLabelText('increment'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
