import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSyncStatus } from './useSyncStatus';

const COLOR: Record<'idle' | 'syncing' | 'error', string> = {
  idle: '#22c55e',
  syncing: '#3b82f6',
  error: '#f59e0b',
};

interface Props {
  onPress: () => void;
}

export function SyncIndicator({ onPress }: Props) {
  const { status, queued } = useSyncStatus();
  return (
    <Pressable
      accessibilityLabel="sync-status"
      accessibilityRole="button"
      onPress={onPress}
      style={styles.wrap}
    >
      <View style={[styles.dot, { backgroundColor: COLOR[status] }]} />
      {queued > 0 ? <Text style={styles.queued}>{queued}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  queued: { color: '#fff', fontSize: 11, marginLeft: 2 },
});
