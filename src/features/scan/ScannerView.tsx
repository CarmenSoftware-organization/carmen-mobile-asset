import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useT } from '../../platform/i18n';

const DEBOUNCE_MS = 1500;

interface Props {
  onScan: (code: string) => void;
}

export function ScannerView({ onScan }: Props) {
  const t = useT();
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const [torch, setTorch] = useState(false);
  const lastScanRef = useRef(0);

  const handleBarcode = (data: string) => {
    const now = Date.now();
    if (now - lastScanRef.current < DEBOUNCE_MS) return;
    lastScanRef.current = now;
    onScan(data);
  };

  const submitManual = () => {
    const code = manual.trim();
    if (!code) return;
    onScan(code);
    setManual('');
  };

  return (
    <View style={styles.container}>
      {permission?.granted ? (
        <View style={styles.cameraWrap}>
          <CameraView
            style={StyleSheet.absoluteFill}
            enableTorch={torch}
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'code128', 'code39'] }}
            onBarcodeScanned={({ data }) => handleBarcode(data)}
          />
          <View style={styles.reticle} pointerEvents="none" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={torch ? t('scan.torchOff') : t('scan.torchOn')}
            style={styles.torchBtn}
            onPress={() => setTorch((v) => !v)}
          >
            <Text style={styles.torchText}>{torch ? t('scan.torchOff') : t('scan.torchOn')}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.permission}>
          <Text style={styles.permissionText}>{t('scan.permissionMessage')}</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.grantBtn}
            onPress={() => void requestPermission()}
          >
            <Text style={styles.grantText}>{t('scan.grantPermission')}</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.manual}>
        <Text style={styles.manualLabel}>{t('scan.manualEntry')}</Text>
        <View style={styles.manualRow}>
          <TextInput
            style={styles.manualInput}
            value={manual}
            onChangeText={setManual}
            placeholder={t('scan.manualPlaceholder')}
            accessibilityLabel={t('scan.manualPlaceholder')}
            autoCapitalize="characters"
            autoCorrect={false}
            onSubmitEditing={submitManual}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('scan.submit')}
            style={styles.submitBtn}
            onPress={submitManual}
          >
            <Text style={styles.submitText}>{t('scan.submit')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  cameraWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  reticle: {
    width: 220,
    height: 220,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  torchBtn: {
    position: 'absolute',
    bottom: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  torchText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  permissionText: { color: '#fff', fontSize: 15, textAlign: 'center' },
  grantBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  grantText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  manual: { backgroundColor: '#fff', padding: 12, gap: 6 },
  manualLabel: { fontSize: 12, color: '#94a3b8' },
  manualRow: { flexDirection: 'row', gap: 8 },
  manualInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  submitBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
