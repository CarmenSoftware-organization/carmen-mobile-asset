import { Tabs } from 'expo-router';
import { useT } from '../../src/platform/i18n';

export default function TabsLayout() {
  const t = useT();
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="scan" options={{ title: t('tabs.scan') }} />
      <Tabs.Screen name="documents" options={{ title: t('tabs.documents') }} />
      <Tabs.Screen name="more" options={{ title: t('tabs.more') }} />
    </Tabs>
  );
}
