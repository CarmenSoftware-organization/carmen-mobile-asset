import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useT } from '../../platform/i18n';
import type { AssetSort } from './filterSortAssetCounts';

const SORTS: AssetSort[] = ['code', 'name', 'department'];

interface Props {
  search: string;
  onSearchChange: (s: string) => void;
  sort: AssetSort;
  onSortChange: (s: AssetSort) => void;
  category: string | null;
  onCategoryChange: (c: string | null) => void;
  categories: string[];
}

export function AssetCountToolbar({
  search,
  onSearchChange,
  sort,
  onSortChange,
  category,
  onCategoryChange,
  categories,
}: Props) {
  const t = useT();
  return (
    <View style={styles.wrap}>
      <TextInput
        style={styles.search}
        value={search}
        onChangeText={onSearchChange}
        placeholder={t('documents.detail.search')}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.sortRow}>
        <Text style={styles.label}>{t('documents.sort.label')}</Text>
        {SORTS.map((s) => {
          const active = s === sort;
          const label = t(`documents.sort.${s}`);
          return (
            <Pressable
              key={s}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
              style={[styles.sortBtn, active && styles.sortBtnActive]}
              onPress={() => onSortChange(s)}
            >
              <Text style={[styles.sortText, active && styles.sortTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      {categories.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRow}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: category === null }}
            style={[styles.cat, category === null && styles.catActive]}
            onPress={() => onCategoryChange(null)}
          >
            <Text style={[styles.catText, category === null && styles.catTextActive]}>
              {t('documents.category.all')}
            </Text>
          </Pressable>
          {categories.map((c) => {
            const active = c === category;
            return (
              <Pressable
                key={c}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.cat, active && styles.catActive]}
                onPress={() => onCategoryChange(c)}
              >
                <Text style={[styles.catText, active && styles.catTextActive]}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  search: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 12, color: '#94a3b8' },
  sortBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
  },
  sortBtnActive: { backgroundColor: '#2563eb' },
  sortText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  sortTextActive: { color: '#fff' },
  catRow: { gap: 8, paddingRight: 12 },
  cat: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#f1f5f9' },
  catActive: { backgroundColor: '#0f172a' },
  catText: { fontSize: 12, color: '#475569' },
  catTextActive: { color: '#fff' },
});
