import { initialCountQty } from '../initialCountQty';

describe('initialCountQty', () => {
  it('defaults to the saved value (or 1) when not accumulating', () => {
    expect(initialCountQty(null, false)).toBe(1);
    expect(initialCountQty(3, false)).toBe(3);
    expect(initialCountQty(0, false)).toBe(0);
  });

  it('adds one on top of the saved value when accumulating', () => {
    expect(initialCountQty(null, true)).toBe(1);
    expect(initialCountQty(3, true)).toBe(4);
    expect(initialCountQty(0, true)).toBe(1);
  });
});
