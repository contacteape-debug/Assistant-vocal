import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { NewEvent } from '../lib/agenda';
import { addDays, capitalize, formatClock, formatDate } from '../lib/dates';
import type { Colors } from '../theme';

/**
 * Le formulaire du bouton « Ajouter » de l'agenda : ajouter un rendez-vous à
 * la main, sans passer par la voix.
 */

type Props = {
  visible: boolean;
  colors: Colors;
  onCancel: () => void;
  onSave: (event: NewEvent) => void;
};

type Time = { hour: number; minute: number };

function tomorrow(): Date {
  const d = addDays(new Date(), 1);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function EventForm({ visible, colors: c, onCancel, onSave }: Props) {
  const [title, setTitle] = useState('');
  const [day, setDay] = useState(tomorrow);
  const [time, setTime] = useState<Time | null>(null);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // Formulaire vide à chaque ouverture. Un rendez-vous a presque toujours une
  // heure : 9 h par défaut, modifiable.
  useEffect(() => {
    if (!visible) return;
    setTitle('');
    setDay(tomorrow());
    setTime({ hour: 9, minute: 0 });
    setAddress('');
    setNotes('');
  }, [visible]);

  function pickDate() {
    DateTimePickerAndroid.open({
      value: day,
      mode: 'date',
      onChange: (event, picked) => {
        if (event.type === 'set' && picked) setDay(new Date(picked.getFullYear(), picked.getMonth(), picked.getDate()));
      },
    });
  }

  function pickTime() {
    const base = new Date();
    base.setHours(time?.hour ?? 9, time?.minute ?? 0, 0, 0);
    DateTimePickerAndroid.open({
      value: base,
      mode: 'time',
      is24Hour: true,
      onChange: (event, picked) => {
        if (event.type === 'set' && picked) setTime({ hour: picked.getHours(), minute: picked.getMinutes() });
      },
    });
  }

  function save() {
    if (!title.trim()) return;
    onSave({
      title: capitalize(title.trim()),
      day,
      hour: time?.hour,
      minute: time?.minute,
      address,
      notes,
    });
  }

  const box = { backgroundColor: c.surface, borderColor: c.border };
  const fieldStyle = [styles.field, box, { color: c.text }];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel} statusBarTranslucent navigationBarTranslucent>
      <SafeAreaView style={[styles.screen, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
        <Text style={[styles.title, { color: c.text }]}>Nouveau rendez-vous</Text>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={[styles.label, { color: c.muted }]}>Quoi ?</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Ex. : Dentiste, dîner chez Marc…"
            placeholderTextColor={c.muted}
            style={fieldStyle}
            autoFocus
          />

          <Text style={[styles.label, { color: c.muted }]}>Quand ?</Text>
          <View style={styles.row}>
            <Pressable onPress={pickDate} style={[styles.field, styles.pressField, box, { flex: 2 }]}>
              <Text style={[styles.body, { color: c.text }]}>📅 {capitalize(formatDate(day))}</Text>
            </Pressable>
            <Pressable onPress={pickTime} style={[styles.field, styles.pressField, box, { flex: 1 }]}>
              <Text style={[styles.body, { color: time ? c.text : c.muted }]}>
                🕐 {time ? formatClock(time.hour, time.minute) : 'Journée'}
              </Text>
            </Pressable>
          </View>
          {time && (
            <Pressable onPress={() => setTime(null)} style={styles.link} accessibilityRole="button">
              <Text style={[styles.small, { color: c.accentText }]}>Toute la journée, sans heure</Text>
            </Pressable>
          )}

          <Text style={[styles.label, { color: c.muted }]}>Où ? (facultatif)</Text>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="Ex. : 12 rue des Lilas, Lyon"
            placeholderTextColor={c.muted}
            style={fieldStyle}
          />

          <Text style={[styles.label, { color: c.muted }]}>Notes (facultatif)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Ex. : apporter la carte Vitale"
            placeholderTextColor={c.muted}
            style={[...fieldStyle, styles.multiline]}
            multiline
          />
        </ScrollView>

        <View style={styles.actions}>
          <Pressable onPress={onCancel} style={[styles.button, { backgroundColor: c.surfaceAlt }]}>
            <Text style={[styles.buttonText, { color: c.text }]}>Annuler</Text>
          </Pressable>
          <Pressable
            onPress={save}
            disabled={!title.trim()}
            style={[styles.button, { backgroundColor: c.accent, opacity: title.trim() ? 1 : 0.4 }]}
          >
            <Text style={[styles.buttonText, { color: c.onAccent }]}>Enregistrer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  title: { fontSize: 26, lineHeight: 34, fontWeight: '800', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  form: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '700', marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
  body: { fontSize: 16, lineHeight: 24 },
  small: { fontSize: 14, lineHeight: 20 },
  field: { minHeight: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, fontSize: 16 },
  pressField: { justifyContent: 'center' },
  multiline: { minHeight: 96, paddingVertical: 12, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 8 },
  link: { minHeight: 40, justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 12 },
  button: { flex: 1, minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
});
