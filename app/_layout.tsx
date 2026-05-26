import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { initI18n } from '../src/platform/i18n';
import { openDatabase } from '../src/data/db';
import { DbProvider } from '../src/data/db/dbContext';
import { useDb } from '../src/data/db/dbContext';
import { createAuth, type AuthBundle } from '../src/features/auth/createAuth';
import { AuthBundleProvider, useAuthBundle } from '../src/features/auth/AuthBundleContext';
import { CarmenApiProvider } from '../src/data/api/carmenApiContext';
import { useAuthStore } from '../src/features/auth/authStore';
import { createMutationQueue } from '../src/data/sync/mutationQueue';
import { MutationQueueProvider, useMutationQueue } from '../src/data/sync/mutationQueueContext';
import { createPendingMutationRepo } from '../src/data/repos/pendingMutationRepo';
import { createSyncWorker } from '../src/data/sync/syncWorker';
import { createCatalogSync } from '../src/data/sync/catalogSync';
import { createAssetRepo } from '../src/data/repos/assetRepo';
import { createLocationRepo } from '../src/data/repos/locationRepo';
import { createMetaRepo } from '../src/data/repos/metaRepo';
import { useSyncStore } from '../src/data/sync/syncStore';
import { createCountingDocumentRepo } from '../src/data/repos/countingDocumentRepo';
import { createCountEntryRepo } from '../src/data/repos/countEntryRepo';
import { createPhotoRepo } from '../src/data/repos/photoRepo';
import { createSyncReconciler } from '../src/data/sync/syncReconciler';
import type { SqlExecutor } from '../src/data/db';

interface BootstrapResult {
  db: SqlExecutor;
  auth: AuthBundle;
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 0 } },
});

export default function RootLayout() {
  const [bootstrap, setBootstrap] = useState<BootstrapResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initI18n();
        const db = await openDatabase();
        const auth = await createAuth();
        if (cancelled) return;
        setBootstrap({ db, auth });
      } catch (err) {
        console.error('Bootstrap failed', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!bootstrap) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <AppProviders bootstrap={bootstrap} />;
}

function AppProviders({ bootstrap }: { bootstrap: BootstrapResult }) {
  const queue = useMemo(
    () => createMutationQueue(createPendingMutationRepo(bootstrap.db)),
    [bootstrap.db],
  );
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <QueryClientProvider client={queryClient}>
        <DbProvider value={bootstrap.db}>
          <CarmenApiProvider value={bootstrap.auth.api}>
            <MutationQueueProvider value={queue}>
              <AuthBundleProvider value={bootstrap.auth}>
                <SyncInfrastructure />
                <RouteGate />
              </AuthBundleProvider>
            </MutationQueueProvider>
          </CarmenApiProvider>
        </DbProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function SyncInfrastructure() {
  const session = useAuthStore((s) => s.session);
  const { api } = useAuthBundle();
  const db = useDb();
  const queue = useMutationQueue();

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    let online = true;
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      online = state.isConnected === true;
    });
    const reconcile = createSyncReconciler({
      countingDocumentRepo: createCountingDocumentRepo(db),
      countEntryRepo: createCountEntryRepo(db),
      photoRepo: createPhotoRepo(db),
    });
    const worker = createSyncWorker({ queue, api, isOnline: () => online, reconcile });
    const stopWorker = worker.start();
    const catalog = createCatalogSync({
      api,
      assetRepo: createAssetRepo(db),
      locationRepo: createLocationRepo(db),
      metaRepo: createMetaRepo(db),
    });
    useSyncStore.getState().setStatus('syncing');
    catalog
      .run()
      .then(() => {
        if (!cancelled) useSyncStore.getState().recordSuccess();
      })
      .catch((err) => {
        if (!cancelled) useSyncStore.getState().setStatus('error', err?.message ?? String(err));
      });
    return () => {
      cancelled = true;
      unsubscribeNet();
      stopWorker();
    };
  }, [session, api, db, queue]);

  return null;
}

function RouteGate() {
  const status = useAuthStore((s) => s.status);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    const inAuthGroup = segments[0] === 'auth';
    if (status === 'signedOut' && !inAuthGroup) {
      router.replace('/auth/sign-in');
    } else if (status === 'signedIn' && inAuthGroup) {
      router.replace('/');
    }
  }, [status, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth/sign-in" options={{ presentation: 'modal' }} />
      <Stack.Screen name="sync" options={{ presentation: 'modal' }} />
      <Stack.Screen name="documents/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="assets/index" />
      <Stack.Screen name="assets/[id]" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
