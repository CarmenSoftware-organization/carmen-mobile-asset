import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useT } from '../../src/platform/i18n';
import { useLocations } from '../../src/features/counting/useLocations';
import { useCreateCountingDocument } from '../../src/features/counting/useCreateCountingDocument';

export default function NewCountingDocumentScreen() {
  const t = useT();
  const router = useRouter();
  const { data: locations, isLoading } = useLocations();
  const create = useCreateCountingDocument();

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: t('documents.new.title') }} />
      <Text style={styles.subtitle}>{t('documents.new.subtitle')}</Text>
      {create.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={locations ?? []}
          keyExtractor={(l) => l.id}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              style={styles.row}
              onPress={() => {
                create.mutate(item, {
                  onSuccess: (doc) => router.replace(`/documents/${doc.id}`),
                });
              }}
            >
              <Text style={styles.rowText}>{item.name}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.empty}>
                {isLoading ? t('documents.loading') : t('documents.new.empty')}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  subtitle: { fontSize: 14, color: '#64748b', padding: 16, paddingBottom: 8 },
  row: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  rowText: { fontSize: 16, color: '#0f172a' },
  center: { padding: 32, alignItems: 'center' },
  empty: { color: '#94a3b8' },
});
