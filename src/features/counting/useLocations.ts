import { useQuery } from '@tanstack/react-query';
import { useDb } from '../../data/db/dbContext';
import { createLocationRepo } from '../../data/repos/locationRepo';

export function useLocations() {
  const db = useDb();
  return useQuery({
    queryKey: ['locations'],
    queryFn: () => createLocationRepo(db).list(),
  });
}
