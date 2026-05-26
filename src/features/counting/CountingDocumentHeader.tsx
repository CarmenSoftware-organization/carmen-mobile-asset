import { StyleSheet, Text, View } from 'react-native';
import { useT } from '../../platform/i18n';
import type { CountingDocument } from '../../data/api/carmenApi';

const STATUS_STYLE: Record<CountingDocument['status'], { backgroundColor: string; color: string }> =
  {
    draft: { backgroundColor: '#e5e7eb', color: '#475569' },
    committed: { backgroundColor: '#dcfce7', color: '#166534' },
    void: { backgroundColor: '#fee2e2', color: '#991b1b' },
  };

export function CountingDocumentHeader({ document }: { document: CountingDocument }) {
  const t = useT();
  const badge = STATUS_STYLE[document.status];
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.running}>{document.runningNumber ?? t('documents.pending')}</Text>
        <View style={[styles.badge, { backgroundColor: badge.backgroundColor }]}>
          <Text style={[styles.badgeText, { color: badge.color }]}>
            {t(`documents.status.${document.status}`)}
          </Text>
        </View>
      </View>
      <Text style={styles.location}>{document.locationName}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>{t('documents.field.countDate')}</Text>
        <Text style={styles.metaValue}>{document.countDate}</Text>
      </View>
      {document.commitDate ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>{t('documents.field.commitDate')}</Text>
          <Text style={styles.metaValue}>{document.commitDate}</Text>
        </View>
      ) : null}
      {document.description ? <Text style={styles.description}>{document.description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: 16,
    gap: 4,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  running: { fontFamily: 'monospace', fontSize: 16, fontWeight: '700', color: '#0f172a' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  location: { fontSize: 15, color: '#0f172a', marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: 8 },
  metaLabel: { fontSize: 12, color: '#94a3b8' },
  metaValue: { fontSize: 12, color: '#475569' },
  description: { fontSize: 13, color: '#475569', marginTop: 4 },
});
