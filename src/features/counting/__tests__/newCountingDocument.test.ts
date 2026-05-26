import { newCountingDocument } from '../newCountingDocument';
import type { Location } from '../../../data/repos/types';

const location: Location = { id: 'loc1', name: 'Building A Floor 1', updatedAt: '2026-05-22T10:00:00Z' };

describe('newCountingDocument', () => {
  it('builds a draft document scoped to the location', () => {
    const now = new Date('2026-05-26T08:30:00Z');
    const doc = newCountingDocument({ location, createdBy: 'u-1', now });

    expect(doc.status).toBe('draft');
    expect(doc.runningNumber).toBeNull();
    expect(doc.commitDate).toBeNull();
    expect(doc.description).toBe('');
    expect(doc.locationId).toBe('loc1');
    expect(doc.locationName).toBe('Building A Floor 1');
    expect(doc.createdBy).toBe('u-1');
    expect(doc.countDate).toBe('2026-05-26');
    expect(doc.createdAt).toBe('2026-05-26T08:30:00.000Z');
    expect(doc.id).toMatch(/.+/);
  });

  it('generates a distinct id per call', () => {
    const a = newCountingDocument({ location, createdBy: 'u-1' });
    const b = newCountingDocument({ location, createdBy: 'u-1' });
    expect(a.id).not.toBe(b.id);
  });
});
