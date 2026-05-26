import { StyleSheet, Text, View } from 'react-native';
import { useT } from '../../platform/i18n';
import { QtyStepper } from './QtyStepper';
import type { AssetCountRow } from './filterSortAssetCounts';

interface Props {
  row: AssetCountRow;
  onChangeQty: (assetId: string, qty: number) => void;
  disabled?: boolean;
}

export function AssetCountListItem({ row, onChangeQty, disabled }: Props) {
  const t = useT();
  const { asset, countedQty } = row;
  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.code}>{asset.code}</Text>
        <Text style={styles.name}>{asset.name}</Text>
        <View style={styles.meta}>
          {asset.category ? <Text style={styles.metaText}>{asset.category}</Text> : null}
          {asset.department ? <Text style={styles.metaText}>{asset.department}</Text> : null}
        </View>
        <Text style={styles.metaText}>
          {t('assets.field.remainQty')}: {asset.remainQty ?? '-'}
          {asset.assetLife ? ` · ${asset.assetLife}` : ''}
        </Text>
        {asset.inputDate || asset.acquireDate ? (
          <Text style={styles.metaText}>
            {asset.inputDate ? `${t('assets.field.inputDate')}: ${asset.inputDate}` : ''}
            {asset.inputDate && asset.acquireDate ? '   ' : ''}
            {asset.acquireDate ? `${t('assets.field.acquireDate')}: ${asset.acquireDate}` : ''}
          </Text>
        ) : null}
      </View>
      <QtyStepper
        value={countedQty}
        disabled={disabled}
        onChange={(n) => onChangeQty(asset.id, n)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  info: { flex: 1, gap: 2 },
  code: { fontFamily: 'monospace', fontSize: 12, color: '#475569' },
  name: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  meta: { flexDirection: 'row', gap: 8 },
  metaText: { fontSize: 12, color: '#64748b' },
});
