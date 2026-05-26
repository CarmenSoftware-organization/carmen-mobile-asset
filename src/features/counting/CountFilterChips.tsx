import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../../platform/i18n';
import type { CountFilter } from './filterSortAssetCounts';

const ORDER: CountFilter[] = ['all', 'counted', 'uncounted'];

interface Props {
  value: CountFilter;
  onChange: (filter: CountFilter) => void;
}

export function CountFilterChips({ value, onChange }: Props) {
  const t = useT();
  return (
    <View style={styles.row}>
      {ORDER.map((filter) => {
        const active = filter === value;
        const label = t(`documents.countFilter.${filter}`);
        return (
          <Pressable
            key={filter}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(filter)}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  chip: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#e5e7eb' },
  chipActive: { backgroundColor: '#2563eb' },
  chipText: { fontSize: 13, color: '#475569', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
});
