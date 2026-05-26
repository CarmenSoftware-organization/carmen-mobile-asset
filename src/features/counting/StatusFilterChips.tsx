import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../../platform/i18n';
import type { CountingDocument } from '../../data/api/carmenApi';

type Status = CountingDocument['status'];
const ORDER: Status[] = ['draft', 'committed', 'void'];

interface Props {
  value: Status;
  onChange: (status: Status) => void;
}

export function StatusFilterChips({ value, onChange }: Props) {
  const t = useT();
  return (
    <View style={styles.row}>
      {ORDER.map((status) => {
        const active = status === value;
        const label = t(`documents.status.${status}`);
        return (
          <Pressable
            key={status}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(status)}
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
