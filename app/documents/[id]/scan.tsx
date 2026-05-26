import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useT } from '../../../src/platform/i18n';
import { Header } from '../../../src/ui/Header';
import { ScannerView } from '../../../src/features/scan/ScannerView';
import { useCodeResolver } from '../../../src/features/scan/useCodeResolver';
import { useCountingDocument } from '../../../src/features/counting/useCountingDocument';

export default function InDocumentScanScreen() {
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const documentId = id ?? '';
  const { data: document } = useCountingDocument(documentId);
  const resolver = useCodeResolver();
  const [notFound, setNotFound] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <Header title={t('scan.title')} />
      <ScannerView
        onScan={async (code) => {
          const asset = await resolver.resolve(code);
          if (asset && document && asset.locationId === document.locationId) {
            router.push(`/documents/${documentId}/assets/${asset.id}?accumulate=1`);
          } else {
            setNotFound(true);
          }
        }}
      />
      {notFound && document ? (
        <Modal transparent animationType="fade" visible onRequestClose={() => setNotFound(false)}>
          <View style={styles.backdrop}>
            <View style={styles.dialog}>
              <Text style={styles.dialogText}>
                {t('scan.notFoundInLocation', { location: document.locationName })}
              </Text>
              <Pressable
                accessibilityRole="button"
                style={styles.okBtn}
                onPress={() => setNotFound(false)}
              >
                <Text style={styles.okText}>{t('scan.ok')}</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: '#fff', borderRadius: 12, padding: 20, gap: 12 },
  dialogText: { fontSize: 15, color: '#0f172a' },
  okBtn: {
    alignSelf: 'flex-end',
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  okText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
