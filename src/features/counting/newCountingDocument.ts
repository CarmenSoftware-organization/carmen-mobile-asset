import { uuid } from '../../platform/id';
import type { Location } from '../../data/repos/types';
import type { CountingDocument } from '../../data/api/carmenApi';

export function newCountingDocument(input: {
  location: Location;
  createdBy: string;
  now?: Date;
}): CountingDocument {
  const now = input.now ?? new Date();
  return {
    id: uuid(),
    runningNumber: null, // assigned server-side on sync (spec §3.2)
    locationId: input.location.id,
    locationName: input.location.name,
    status: 'draft',
    countDate: now.toISOString().slice(0, 10), // YYYY-MM-DD
    commitDate: null,
    description: '',
    createdBy: input.createdBy,
    createdAt: now.toISOString(),
  };
}
