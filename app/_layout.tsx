import { useEffect, useState } from 'react';
import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { initI18n } from '../src/platform/i18n';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initI18n().then(() => setReady(true));
  }, []);

  if (!ready) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Slot />
    </SafeAreaProvider>
  );
}
