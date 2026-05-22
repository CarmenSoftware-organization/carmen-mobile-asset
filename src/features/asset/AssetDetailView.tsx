import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useT } from '../../platform/i18n';
import type { Asset } from '../../data/repos/types';

interface Props {
  asset: Asset;
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (value == null || value === '') return null;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function formatMoney(price: number | null, currency: string | null): string | null {
  if (price == null) return null;
  return currency ? `${currency} ${price}` : `${price}`;
}

export function AssetDetailView({ asset }: Props) {
  const t = useT();
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.code}>{asset.code}</Text>
      <Text style={styles.name}>{asset.name}</Text>
      <View style={styles.list}>
        <Row label={t('assets.field.category')} value={asset.category} />
        <Row label={t('assets.field.department')} value={asset.department} />
        <Row label={t('assets.field.location')} value={asset.locationName} />
        <Row
          label={t('assets.field.quantity')}
          value={asset.quantity != null ? String(asset.quantity) : null}
        />
        <Row
          label={t('assets.field.remainQty')}
          value={asset.remainQty != null ? String(asset.remainQty) : null}
        />
        <Row label={t('assets.field.price')} value={formatMoney(asset.price, asset.currency)} />
        <Row
          label={t('assets.field.totalAmount')}
          value={formatMoney(asset.totalAmount, asset.currency)}
        />
        <Row label={t('assets.field.inputDate')} value={asset.inputDate} />
        <Row label={t('assets.field.acquireDate')} value={asset.acquireDate} />
        <Row label={t('assets.field.assetLife')} value={asset.assetLife} />
        <Row label={t('assets.field.remark')} value={asset.remark} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 16, gap: 4 },
  code: { fontFamily: 'monospace', fontSize: 13, color: '#475569' },
  name: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  list: { backgroundColor: '#fff', borderRadius: 8, padding: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  label: { color: '#64748b', fontSize: 13 },
  value: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
});
