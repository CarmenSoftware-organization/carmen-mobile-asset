import { Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useT } from '../../src/platform/i18n';
import { Header } from '../../src/ui/Header';
import { ScannerView } from '../../src/features/scan/ScannerView';
import { useCodeResolver } from '../../src/features/scan/useCodeResolver';

export default function ScanScreen() {
  const t = useT();
  const router = useRouter();
  const resolver = useCodeResolver();
  return (
    <SafeAreaView style={styles.container}>
      <Header title={t('scan.title')} />
      <ScannerView
        onScan={async (code) => {
          const asset = await resolver.resolve(code);
          if (asset) router.push(`/assets/${asset.id}`);
          else Alert.alert(t('scan.notFound', { code }));
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
});
