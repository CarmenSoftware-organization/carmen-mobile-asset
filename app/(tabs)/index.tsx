import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useT } from '../../src/platform/i18n';

export default function HomeScreen() {
  const t = useT();
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{t('home.title')}</Text>
      <View style={styles.body}>
        <Text>{t('home.scanQr')}</Text>
        <Text>{t('home.newDocument')}</Text>
        <Text>{t('home.viewDocuments')}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  title: {
    fontSize: 22,
    fontWeight: '700',
    padding: 16,
    color: '#fff',
    backgroundColor: '#2563eb',
  },
  body: { padding: 16, gap: 8 },
});
