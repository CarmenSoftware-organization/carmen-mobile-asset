import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useT } from '../../../src/platform/i18n';
import { useCountingDocument } from '../../../src/features/counting/useCountingDocument';
import { useAssetCountList } from '../../../src/features/counting/useAssetCountList';
import { useSetCountedQty } from '../../../src/features/counting/useSetCountedQty';
import { CountingDocumentHeader } from '../../../src/features/counting/CountingDocumentHeader';
import { CountFilterChips } from '../../../src/features/counting/CountFilterChips';
import { AssetCountToolbar } from '../../../src/features/counting/AssetCountToolbar';
import { AssetCountListItem } from '../../../src/features/counting/AssetCountListItem';
import {
  filterSortAssetCounts,
  type CountFilter,
  type AssetSort,
} from '../../../src/features/counting/filterSortAssetCounts';

export default function CountingDocumentDetailScreen() {
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const documentId = id ?? '';
  const { data: document, isLoading: docLoading } = useCountingDocument(documentId);
  const { data: rows, isLoading: listLoading } = useAssetCountList(
    documentId,
    document?.locationId ?? '',
    document?.locationName ?? '',
  );
  const setQty = useSetCountedQty(documentId);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CountFilter>('all');
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<AssetSort>('code');

  const locked = document ? document.status !== 'draft' : false;

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows ?? []) if (r.asset.category) set.add(r.asset.category);
    return [...set].sort();
  }, [rows]);

  const visible = useMemo(
    () => filterSortAssetCounts(rows ?? [], { search, filter, category, sort }),
    [rows, search, filter, category, sort],
  );

  if (docLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: t('documents.title') }} />
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }
  if (!document) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: t('documents.title') }} />
        <View style={styles.center}>
          <Text style={styles.empty}>{t('documents.empty')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: document.runningNumber ?? t('documents.pending') }} />
      <FlatList
        data={visible}
        keyExtractor={(r) => r.asset.id}
        ListHeaderComponent={
          <View>
            <CountingDocumentHeader document={document} />
            <CountFilterChips value={filter} onChange={setFilter} />
            <AssetCountToolbar
              search={search}
              onSearchChange={setSearch}
              sort={sort}
              onSortChange={setSort}
              category={category}
              onCategoryChange={setCategory}
              categories={categories}
            />
            {!locked ? (
              <Pressable
                accessibilityRole="button"
                style={styles.scanBtn}
                onPress={() => router.push(`/documents/${documentId}/scan`)}
              >
                <Text style={styles.scanText}>{t('scan.title')}</Text>
              </Pressable>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <AssetCountListItem
            row={item}
            disabled={locked}
            onChangeQty={(assetId, qty) => setQty.mutate({ assetId, qty })}
            onView={(assetId) => router.push(`/documents/${documentId}/assets/${assetId}`)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.empty}>
              {listLoading ? t('documents.loading') : t('documents.detail.empty')}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  center: { padding: 32, alignItems: 'center' },
  empty: { color: '#94a3b8' },
  scanBtn: {
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  scanText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
