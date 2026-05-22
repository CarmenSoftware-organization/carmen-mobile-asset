import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useT } from '../../src/platform/i18n';
import { Header } from '../../src/ui/Header';

export default function HomeScreen() {
  const t = useT();
  return (
    <SafeAreaView style={styles.container}>
      <Header title={t('home.title')} />
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
  body: { padding: 16, gap: 8 },
});
