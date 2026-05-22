import { View, Text, StyleSheet } from 'react-native';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  return (
    <View style={styles.bar}>
      <Text style={styles.title}>{title}</Text>
      <View accessibilityLabel="sync-status" style={styles.indicator}>
        <Text style={styles.indicatorText}>●</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '600' },
  indicator: { paddingHorizontal: 6 },
  indicatorText: { color: '#bbf7d0', fontSize: 14 },
});
