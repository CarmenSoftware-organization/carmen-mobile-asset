import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../../platform/i18n';
import type { Location } from '../../data/repos/types';

interface Props {
  value: string;
  options: Location[];
  onChange: (name: string) => void;
  disabled?: boolean;
}

export function LocationSelect({ value, options, onChange, disabled }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('documents.entry.location')}
        disabled={disabled}
        style={[styles.trigger, disabled && styles.triggerDisabled]}
        onPress={() => setOpen(true)}
      >
        <Text style={styles.value}>{value || t('documents.entry.selectLocation')}</Text>
      </Pressable>
      {open ? (
        <Modal transparent animationType="fade" visible onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <View style={styles.sheet}>
              {options.map((loc) => (
                <Pressable
                  key={loc.id}
                  accessibilityRole="button"
                  style={styles.option}
                  onPress={() => {
                    onChange(loc.name);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.optionText}>{loc.name}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  triggerDisabled: { backgroundColor: '#f1f5f9' },
  value: { fontSize: 15, color: '#0f172a' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 8 },
  option: { paddingVertical: 14, paddingHorizontal: 16 },
  optionText: { fontSize: 16, color: '#0f172a' },
});
