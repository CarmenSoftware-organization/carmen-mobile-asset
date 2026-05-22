import { StyleSheet, Text, View } from 'react-native';
import type { Asset } from '../../data/repos/types';

interface Props {
  asset: Asset;
}

export function AssetListItem({ asset }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.headRow}>
        <Text style={styles.code}>{asset.code}</Text>
        <Text style={styles.qty}>x{asset.remainQty ?? asset.quantity ?? 1}</Text>
      </View>
      <Text style={styles.name}>{asset.name}</Text>
      <View style={styles.meta}>
        {asset.category ? <Text style={styles.metaText}>{asset.category}</Text> : null}
        {asset.department ? <Text style={styles.metaText}>{asset.department}</Text> : null}
      </View>
      {asset.locationName ? <Text style={styles.location}>{asset.locationName}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  headRow: { flexDirection: 'row', justifyContent: 'space-between' },
  code: { fontFamily: 'monospace', fontSize: 13, color: '#475569' },
  qty: { fontSize: 13, color: '#94a3b8' },
  name: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginTop: 2 },
  meta: { flexDirection: 'row', gap: 8, marginTop: 4 },
  metaText: { fontSize: 12, color: '#64748b' },
  location: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
});
