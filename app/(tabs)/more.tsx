import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useT } from '../../src/platform/i18n';
import { useAuthBundle } from '../../src/features/auth/AuthBundleContext';

export default function MoreScreen() {
  const t = useT();
  const bundle = useAuthBundle();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <Pressable
          accessibilityRole="button"
          style={styles.danger}
          onPress={() => {
            void bundle.signOut();
          }}
        >
          <Text style={styles.dangerText}>{t('more.signOut')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  body: { padding: 16, gap: 12 },
  danger: { backgroundColor: '#dc2626', borderRadius: 8, padding: 16, alignItems: 'center' },
  dangerText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
