import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useT } from '../../src/platform/i18n';
import { Header } from '../../src/ui/Header';
import { StatusFilterChips } from '../../src/features/counting/StatusFilterChips';
import { CountingDocumentListItem } from '../../src/features/counting/CountingDocumentListItem';
import { useCountingDocuments } from '../../src/features/counting/useCountingDocuments';
import { useVoidCountingDocument } from '../../src/features/counting/useVoidCountingDocument';
import { ConfirmDialog } from '../../src/ui/ConfirmDialog';
import type { CountingDocument } from '../../src/data/api/carmenApi';

export default function DocumentsScreen() {
  const t = useT();
  const [status, setStatus] = useState<CountingDocument['status']>('draft');
  const { data, isLoading } = useCountingDocuments(status);
  const voidDoc = useVoidCountingDocument();
  const [pendingVoid, setPendingVoid] = useState<CountingDocument | null>(null);

  return (
    <SafeAreaView style={styles.container}>
      <Header title={t('documents.title')} />
      <StatusFilterChips value={status} onChange={setStatus} />
      <FlatList
        data={data ?? []}
        keyExtractor={(e) => e.document.id}
        renderItem={({ item }) => (
          <CountingDocumentListItem
            document={item.document}
            countedTotal={item.countedTotal}
            onVoid={item.document.status === 'draft' ? setPendingVoid : undefined}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {isLoading ? t('documents.loading') : t('documents.empty')}
            </Text>
          </View>
        }
      />
      <ConfirmDialog
        visible={pendingVoid !== null}
        title={t('documents.void.title')}
        message={t('documents.void.message')}
        confirmLabel={t('documents.void.confirm')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => {
          if (pendingVoid) voidDoc.mutate(pendingVoid);
          setPendingVoid(null);
        }}
        onCancel={() => setPendingVoid(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { color: '#94a3b8' },
});
