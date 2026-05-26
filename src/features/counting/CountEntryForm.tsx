import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useT } from '../../platform/i18n';
import { QtyStepper } from './QtyStepper';
import { LocationSelect } from './LocationSelect';
import type { Asset, Location } from '../../data/repos/types';

export interface CountEntryFormValues {
  countQty: number;
  location: string;
  observedSerialNo: string;
  observedSpecification: string;
  observedRemark: string;
  comment: string;
}

interface Props {
  asset: Asset;
  transferDate: string | null;
  initial: CountEntryFormValues;
  locations: Location[];
  locked?: boolean;
  onSave: (values: CountEntryFormValues) => void;
  onBack: () => void;
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export function CountEntryForm({
  asset,
  transferDate,
  initial,
  locations,
  locked,
  onSave,
  onBack,
}: Props) {
  const t = useT();
  const [values, setValues] = useState<CountEntryFormValues>(initial);
  const [showDiscard, setShowDiscard] = useState(false);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  const set = (patch: Partial<CountEntryFormValues>) => setValues((v) => ({ ...v, ...patch }));

  const handleBack = () => {
    if (dirty && !locked) setShowDiscard(true);
    else onBack();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.code}>{asset.code}</Text>
        <Text style={styles.name}>{asset.name}</Text>
        <View style={styles.infoCard}>
          <InfoRow label={t('assets.field.category')} value={asset.category} />
          <InfoRow label={t('assets.field.inputDate')} value={asset.inputDate} />
          <InfoRow label={t('assets.field.acquireDate')} value={asset.acquireDate} />
          <InfoRow
            label={t('assets.field.remainQty')}
            value={asset.remainQty != null ? String(asset.remainQty) : null}
          />
          <InfoRow label={t('documents.entry.transferDate')} value={transferDate} />
        </View>

        <Text style={styles.fieldLabel}>{t('documents.entry.location')}</Text>
        <LocationSelect
          value={values.location}
          options={locations}
          disabled={locked}
          onChange={(name) => set({ location: name })}
        />

        <Text style={styles.fieldLabel}>{t('documents.entry.serialNo')}</Text>
        <TextInput
          style={styles.input}
          accessibilityLabel={t('documents.entry.serialNo')}
          editable={!locked}
          value={values.observedSerialNo}
          onChangeText={(text) => set({ observedSerialNo: text })}
        />

        <Text style={styles.fieldLabel}>{t('documents.entry.specification')}</Text>
        <TextInput
          style={styles.input}
          accessibilityLabel={t('documents.entry.specification')}
          editable={!locked}
          value={values.observedSpecification}
          onChangeText={(text) => set({ observedSpecification: text })}
        />

        <Text style={styles.fieldLabel}>{t('documents.entry.remark')}</Text>
        <TextInput
          style={styles.input}
          accessibilityLabel={t('documents.entry.remark')}
          editable={!locked}
          value={values.observedRemark}
          onChangeText={(text) => set({ observedRemark: text })}
        />

        <Text style={styles.fieldLabel}>{t('documents.entry.comment')}</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          accessibilityLabel={t('documents.entry.comment')}
          editable={!locked}
          multiline
          value={values.comment}
          onChangeText={(text) => set({ comment: text })}
        />

        <Text style={styles.fieldLabel}>{t('documents.counted')}</Text>
        <QtyStepper
          value={values.countQty}
          disabled={locked}
          onChange={(n) => set({ countQty: n })}
        />
      </ScrollView>

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" style={styles.backBtn} onPress={handleBack}>
          <Text style={styles.backText}>{t('documents.entry.back')}</Text>
        </Pressable>
        {!locked ? (
          <Pressable
            accessibilityRole="button"
            style={styles.saveBtn}
            onPress={() => onSave(values)}
          >
            <Text style={styles.saveText}>{t('documents.entry.save')}</Text>
          </Pressable>
        ) : null}
      </View>

      {showDiscard ? (
        <Modal
          transparent
          animationType="fade"
          visible
          onRequestClose={() => setShowDiscard(false)}
        >
          <View style={styles.backdrop}>
            <View style={styles.dialog}>
              <Text style={styles.dialogTitle}>{t('documents.entry.discardTitle')}</Text>
              <Text style={styles.dialogMessage}>{t('documents.entry.discardMessage')}</Text>
              <View style={styles.dialogActions}>
                <Pressable
                  accessibilityRole="button"
                  style={styles.dialogCancel}
                  onPress={() => setShowDiscard(false)}
                >
                  <Text style={styles.dialogCancelText}>{t('common.cancel')}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  style={styles.dialogConfirm}
                  onPress={() => {
                    setShowDiscard(false);
                    onBack();
                  }}
                >
                  <Text style={styles.dialogConfirmText}>{t('documents.entry.discard')}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 16, gap: 6 },
  code: { fontFamily: 'monospace', fontSize: 13, color: '#475569' },
  name: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  infoCard: { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  infoLabel: { color: '#64748b', fontSize: 13 },
  infoValue: { color: '#0f172a', fontSize: 13, fontWeight: '500' },
  fieldLabel: { fontSize: 12, color: '#94a3b8', marginTop: 6 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0f172a',
  },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  backBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
  },
  backText: { color: '#475569', fontSize: 15, fontWeight: '600' },
  saveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: '#fff', borderRadius: 12, padding: 20, gap: 8 },
  dialogTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  dialogMessage: { fontSize: 14, color: '#475569' },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  dialogCancel: { paddingVertical: 10, paddingHorizontal: 16 },
  dialogCancelText: { color: '#475569', fontSize: 15, fontWeight: '600' },
  dialogConfirm: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#dc2626',
  },
  dialogConfirmText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
