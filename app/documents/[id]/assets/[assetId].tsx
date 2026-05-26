import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useT } from '../../../../src/platform/i18n';
import { useAsset } from '../../../../src/features/asset/useAsset';
import { useCountingDocument } from '../../../../src/features/counting/useCountingDocument';
import { useCountEntryForAsset } from '../../../../src/features/counting/useCountEntryForAsset';
import { useSaveCountEntry } from '../../../../src/features/counting/useSaveCountEntry';
import { useLocations } from '../../../../src/features/counting/useLocations';
import {
  CountEntryForm,
  type CountEntryFormValues,
} from '../../../../src/features/counting/CountEntryForm';
import { initialCountQty } from '../../../../src/features/counting/initialCountQty';

export default function AssetInformationScreen() {
  const t = useT();
  const router = useRouter();
  const { id, assetId, accumulate } = useLocalSearchParams<{
    id: string;
    assetId: string;
    accumulate?: string;
  }>();
  const documentId = id ?? '';
  const assetKey = assetId ?? '';

  const { data: document, isLoading: docLoading } = useCountingDocument(documentId);
  const { data: asset, isLoading: assetLoading } = useAsset(assetKey);
  const { data: entry, isLoading: entryLoading } = useCountEntryForAsset(documentId, assetKey);
  const { data: locations } = useLocations();
  const save = useSaveCountEntry(documentId);

  const loading = docLoading || assetLoading || entryLoading;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: t('assets.title') }} />
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }
  if (!asset || !document) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: t('assets.title') }} />
        <View style={styles.center}>
          <Text style={styles.empty}>{t('assets.empty')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const initial: CountEntryFormValues = {
    countQty: initialCountQty(entry?.countQty ?? null, accumulate === '1'),
    location: entry?.location ?? document.locationName,
    observedSerialNo: entry?.observedSerialNo ?? asset.serialNo ?? '',
    observedSpecification: entry?.observedSpecification ?? asset.specification ?? '',
    observedRemark: entry?.observedRemark ?? '',
    comment: entry?.comment ?? '',
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: asset.code }} />
      <CountEntryForm
        asset={asset}
        transferDate={entry?.transferDate ?? null}
        initial={initial}
        locations={locations ?? []}
        locked={document.status !== 'draft'}
        onSave={(values) =>
          save.mutate({ assetId: assetKey, ...values }, { onSuccess: () => router.back() })
        }
        onBack={() => router.back()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: '#94a3b8' },
});
