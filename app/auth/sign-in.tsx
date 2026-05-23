import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SignInForm } from '../../src/features/auth/SignInForm';
import { useAuthBundle } from '../../src/features/auth/AuthBundleContext';
import { CarmenApiError } from '../../src/data/api/errors';

export default function SignInScreen() {
  const bundle = useAuthBundle();
  const router = useRouter();
  const [errorCode, setErrorCode] = useState<string | undefined>();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <SignInForm
          errorCode={errorCode}
          onSubmit={async (creds) => {
            setErrorCode(undefined);
            try {
              await bundle.signIn(creds);
              router.replace('/');
            } catch (err) {
              if (err instanceof CarmenApiError) {
                if (err.code === 'unauthenticated') setErrorCode('auth.error.invalid');
                else if (err.code === 'network_error') setErrorCode('auth.error.network');
                else setErrorCode('auth.error.generic');
              } else {
                setErrorCode('auth.error.generic');
              }
            }
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  body: { flex: 1, justifyContent: 'center' },
});
