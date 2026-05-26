import { useQuery } from '@tanstack/react-query';
import { useDb } from '../../data/db/dbContext';
import { createPhotoRepo } from '../../data/repos/photoRepo';

export function useEntryPhotos(entryId: string) {
  const db = useDb();
  return useQuery({
    queryKey: ['entryPhotos', entryId],
    queryFn: () => createPhotoRepo(db).listByEntry(entryId),
    enabled: !!entryId,
  });
}
