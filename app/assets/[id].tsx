import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { AssetDetailView } from '../../src/features/asset/AssetDetailView';
import { useAsset } from '../../src/features/asset/useAsset';
import { useT } from '../../src/platform/i18n';

export default function AssetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const { data: asset, isLoading } = useAsset(id ?? '');

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: asset?.code ?? t('assets.title') }} />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : !asset ? (
        <View style={styles.center}>
          <Text>{t('assets.empty')}</Text>
        </View>
      ) : (
        <AssetDetailView asset={asset} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
