import { StyleSheet, Text, View } from 'react-native';

import type { Colors } from '../theme';

/** Un écran vide accueillant : une grosse icône, un titre, une idée de phrase à dire. */
export function EmptyState({ icon, title, hint, colors: c }: { icon: string; title: string; hint: string; colors: Colors }) {
  return (
    <View style={styles.box}>
      <View style={[styles.bubble, { backgroundColor: c.accentSoft }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      <Text style={[styles.hint, { color: c.muted }]}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48, gap: 8 },
  bubble: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  icon: { fontSize: 40, lineHeight: 48 },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  hint: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
