import { uuid } from '../id';

describe('uuid', () => {
  it('returns a non-empty string', () => {
    expect(typeof uuid()).toBe('string');
    expect(uuid().length).toBeGreaterThan(0);
  });

  it('returns distinct values across calls', () => {
    expect(uuid()).not.toBe(uuid());
  });
});
