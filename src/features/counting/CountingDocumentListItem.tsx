import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../../platform/i18n';
import type { CountingDocument } from '../../data/api/carmenApi';

interface Props {
  document: CountingDocument;
  countedTotal: number;
  /** When provided (drafts only), renders a void/trash action. */
  onVoid?: (doc: CountingDocument) => void;
  /** When provided, renders a view (eye) action for any status. */
  onView?: (doc: CountingDocument) => void;
}

const STATUS_STYLE: Record<CountingDocument['status'], object> = {
  draft: { backgroundColor: '#e5e7eb', color: '#475569' },
  committed: { backgroundColor: '#dcfce7', color: '#166534' },
  void: { backgroundColor: '#fee2e2', color: '#991b1b' },
};

export function CountingDocumentListItem({ document, countedTotal, onVoid, onView }: Props) {
  const t = useT();
  const status = document.status;
  const badge = STATUS_STYLE[status] as { backgroundColor: string; color: string };
  return (
    <View style={styles.row}>
      <View style={styles.main}>
        <View style={styles.headRow}>
          <Text style={styles.running}>{document.runningNumber ?? t('documents.pending')}</Text>
          <View style={[styles.badge, { backgroundColor: badge.backgroundColor }]}>
            <Text style={[styles.badgeText, { color: badge.color }]}>
              {t(`documents.status.${status}`)}
            </Text>
          </View>
        </View>
        <Text style={styles.location}>{document.locationName}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{document.countDate}</Text>
          <View style={styles.countedWrap}>
            <Text style={styles.meta}>{t('documents.counted')}:</Text>
            <Text style={styles.meta}>{countedTotal}</Text>
          </View>
        </View>
      </View>
      <View style={styles.actions}>
        {onView ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('documents.view')}
            style={styles.actionBtn}
            onPress={() => onView(document)}
          >
            <Text style={styles.actionIcon}>👁</Text>
          </Pressable>
        ) : null}
        {onVoid && status === 'draft' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('documents.void.action')}
            style={styles.actionBtn}
            onPress={() => onVoid(document)}
          >
            <Text style={styles.actionIcon}>🗑</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  main: { flex: 1, gap: 2 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  running: { fontFamily: 'monospace', fontSize: 14, color: '#0f172a', fontWeight: '600' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  location: { fontSize: 15, color: '#0f172a' },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 2, alignItems: 'center' },
  countedWrap: { flexDirection: 'row', gap: 4 },
  meta: { fontSize: 12, color: '#64748b' },
  actions: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  actionBtn: { paddingHorizontal: 8, paddingVertical: 8 },
  actionIcon: { fontSize: 18 },
});
