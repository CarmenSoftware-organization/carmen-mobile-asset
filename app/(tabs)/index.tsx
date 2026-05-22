import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useT } from '../../src/platform/i18n';
import { Header } from '../../src/ui/Header';

export default function HomeScreen() {
  const t = useT();
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container}>
      <Header title={t('home.title')} />
      <View style={styles.body}>
        <Pressable
          accessibilityRole="button"
          style={styles.primary}
          onPress={() => router.push('/assets')}
        >
          <Text style={styles.primaryText}>{t('home.browseAssets')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  body: { padding: 16, gap: 12 },
  primary: { backgroundColor: '#2563eb', borderRadius: 8, padding: 16, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
