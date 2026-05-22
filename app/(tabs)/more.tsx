import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useT } from '../../src/platform/i18n';

export default function MoreScreen() {
  const t = useT();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <Text>{t('tabs.more')} — placeholder</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  body: { padding: 16 },
});
