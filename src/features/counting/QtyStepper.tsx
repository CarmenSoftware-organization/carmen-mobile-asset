import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

interface Props {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}

export function QtyStepper({ value, onChange, disabled }: Props) {
  const minusDisabled = disabled || value <= 0;
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="decrement"
        disabled={minusDisabled}
        style={[styles.btn, minusDisabled && styles.btnDisabled]}
        onPress={() => onChange(Math.max(0, value - 1))}
      >
        <Text style={styles.btnText}>–</Text>
      </Pressable>
      <TextInput
        style={styles.input}
        editable={!disabled}
        keyboardType="number-pad"
        value={String(value)}
        accessibilityLabel="counted quantity"
        onChangeText={(txt) => {
          const n = parseInt(txt.replace(/[^0-9]/g, ''), 10);
          onChange(Number.isNaN(n) ? 0 : n);
        }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="increment"
        disabled={disabled}
        style={[styles.btn, disabled && styles.btnDisabled]}
        onPress={() => onChange(value + 1)}
      >
        <Text style={styles.btnText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { backgroundColor: '#cbd5e1' },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  input: {
    minWidth: 44,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 15,
  },
});
