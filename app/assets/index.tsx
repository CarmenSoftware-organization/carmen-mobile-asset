import { useState, useCallback } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useT } from '../../src/platform/i18n';
import { useAssets } from '../../src/features/asset/useAssets';
import { AssetListItem } from '../../src/features/asset/AssetListItem';
import { useDb } from '../../src/data/db/dbContext';
import { useCarmenApi } from '../../src/data/api/carmenApiContext';
import { createCatalogSync } from '../../src/data/sync/catalogSync';
import { createAssetRepo } from '../../src/data/repos/assetRepo';
import { createLocationRepo } from '../../src/data/repos/locationRepo';
import { createMetaRepo } from '../../src/data/repos/metaRepo';
import { useSyncStore } from '../../src/data/sync/syncStore';

export default function AssetsListScreen() {
  const t = useT();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useAssets(search);
  const qc = useQueryClient();
  const db = useDb();
  const api = useCarmenApi();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
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
      await qc.invalidateQueries({ queryKey: ['assets'] });
    } catch (err) {
      useSyncStore.getState().setStatus('error', err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
    }
  }, [api, db, qc]);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: t('assets.title') }} />
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder={t('assets.search')}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <FlatList
        data={data ?? []}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/assets/${item.id}`)}>
            <AssetListItem asset={item} />
          </Pressable>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {isLoading ? t('assets.loading') : t('assets.empty')}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  searchWrap: { padding: 12 },
  search: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { color: '#94a3b8' },
});
