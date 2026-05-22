import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SyncIndicator } from '../features/sync/SyncIndicator';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const router = useRouter();
  return (
    <View style={styles.bar}>
      <Text style={styles.title}>{title}</Text>
      <SyncIndicator onPress={() => router.push('/sync')} />
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
});
