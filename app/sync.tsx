import { Stack } from 'expo-router';
import { useDb } from '../src/data/db/dbContext';
import { useCarmenApi } from '../src/data/api/carmenApiContext';
import { createCatalogSync } from '../src/data/sync/catalogSync';
import { createAssetRepo } from '../src/data/repos/assetRepo';
import { createLocationRepo } from '../src/data/repos/locationRepo';
import { createMetaRepo } from '../src/data/repos/metaRepo';
import { useSyncStore } from '../src/data/sync/syncStore';
import { SyncStatusSheet } from '../src/features/sync/SyncStatusSheet';

export default function SyncRoute() {
  const db = useDb();
  const api = useCarmenApi();

  async function syncNow() {
    useSyncStore.getState().setStatus('syncing');
    try {
      const catalog = createCatalogSync({
        api,
        assetRepo: createAssetRepo(db),
        locationRepo: createLocationRepo(db),
        metaRepo: createMetaRepo(db),
      });
      await catalog.run();
      useSyncStore.getState().recordSuccess();
    } catch (err) {
      useSyncStore.getState().setStatus('error', err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
      <Stack.Screen options={{ presentation: 'modal', title: 'Sync' }} />
      <SyncStatusSheet onSyncNow={syncNow} />
    </>
  );
}
