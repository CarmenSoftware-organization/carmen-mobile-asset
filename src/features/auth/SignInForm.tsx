import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useT } from '../../platform/i18n';

interface Props {
  onSubmit: (creds: { username: string; password: string }) => Promise<void>;
  errorCode?: string;
}

export function SignInForm({ onSubmit, errorCode }: Props) {
  const t = useT();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!username || !password) {
      setLocalError('auth.error.missingFields');
      return;
    }
    setLocalError(null);
    setSubmitting(true);
    try {
      await onSubmit({ username, password });
    } finally {
      setSubmitting(false);
    }
  }

  const errorKey = localError ?? errorCode ?? null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('auth.title')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('auth.username')}
        autoCapitalize="none"
        autoCorrect={false}
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder={t('auth.password')}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {errorKey ? <Text style={styles.error}>{t(errorKey)}</Text> : null}
      <Pressable
        accessibilityRole="button"
        style={[styles.button, submitting && styles.buttonDisabled]}
        onPress={submitting ? undefined : handleSubmit}
      >
        {submitting ? (
          <View style={styles.row}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.buttonText}>{t('auth.signingIn')}</Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>{t('auth.signIn')}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  error: { color: '#dc2626', fontSize: 14 },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { backgroundColor: '#94a3b8' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
