import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../../platform/i18n';
import { useSyncStatus } from './useSyncStatus';

interface Props {
  onSyncNow: () => void;
}

function formatRelative(date: Date | null): string | null {
  if (!date) return null;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleString();
}

export function SyncStatusSheet({ onSyncNow }: Props) {
  const t = useT();
  const { status, queued, lastSuccessAt, lastError } = useSyncStatus();
  const lastSyncLabel = formatRelative(lastSuccessAt) ?? t('sync.never');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('sync.title')}</Text>

      <View style={styles.row}>
        <Text style={styles.label}>{t('sync.lastSync')}</Text>
        <Text style={styles.value}>{lastSyncLabel}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>{t('sync.queued')}</Text>
        <Text style={styles.value}>{String(queued)}</Text>
      </View>

      {lastError ? (
        <View style={styles.row}>
          <Text style={styles.label}>{t('sync.lastError')}</Text>
          <Text style={[styles.value, styles.error]}>{lastError}</Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        style={[styles.button, status === 'syncing' && styles.buttonDisabled]}
        onPress={status === 'syncing' ? undefined : onSyncNow}
      >
        <Text style={styles.buttonText}>
          {status === 'syncing' ? t('sync.syncing') : t('sync.syncNow')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12, backgroundColor: '#fff', flex: 1 },
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  label: { color: '#64748b', fontSize: 14 },
  value: { color: '#0f172a', fontSize: 14, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  error: { color: '#dc2626' },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: { backgroundColor: '#94a3b8' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
