import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AgendaKind, NewEvent } from '../lib/agenda';
import { addDays, capitalize, dayCount, formatClock, formatDate, toDayKey } from '../lib/dates';
import type { Colors } from '../theme';

/**
 * Le formulaire du bouton « + » de l'agenda : ajouter un rendez-vous ou un
 * chantier à la main, sans passer par la voix.
 */

type Props = {
  visible: boolean;
  kind: AgendaKind;
  colors: Colors;
  onCancel: () => void;
  onSave: (event: NewEvent) => void;
};

type Time = { hour: number; minute: number };

function tomorrow(): Date {
  const d = addDays(new Date(), 1);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function EventForm({ visible, kind, colors: c, onCancel, onSave }: Props) {
  const [title, setTitle] = useState('');
  const [day, setDay] = useState(tomorrow);
  const [endDay, setEndDay] = useState(tomorrow);
  const [time, setTime] = useState<Time | null>(null);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // Formulaire vide à chaque ouverture. Un rendez-vous a presque toujours une
  // heure (9 h par défaut, modifiable) ; un chantier, rarement.
  useEffect(() => {
    if (!visible) return;
    setTitle('');
    setDay(tomorrow());
    setEndDay(tomorrow());
    setTime(kind === 'rdv' ? { hour: 9, minute: 0 } : null);
    setAddress('');
    setNotes('');
  }, [visible, kind]);

  const isChantier = kind === 'chantier';

  function pickDate(current: Date, onPicked: (d: Date) => void, minimumDate?: Date) {
    DateTimePickerAndroid.open({
      value: current,
      mode: 'date',
      minimumDate,
      onChange: (event, picked) => {
        if (event.type === 'set' && picked) onPicked(new Date(picked.getFullYear(), picked.getMonth(), picked.getDate()));
      },
    });
  }

  function pickTime() {
    const base = new Date();
    base.setHours(time?.hour ?? 8, time?.minute ?? 0, 0, 0);
    DateTimePickerAndroid.open({
      value: base,
      mode: 'time',
      is24Hour: true,
      onChange: (event, picked) => {
        if (event.type === 'set' && picked) setTime({ hour: picked.getHours(), minute: picked.getMinutes() });
      },
    });
  }

  function onStartPicked(d: Date) {
    setDay(d);
    // Un chantier ne peut pas finir avant d'avoir commencé.
    if (toDayKey(endDay) < toDayKey(d)) setEndDay(d);
  }

  function save() {
    if (!title.trim()) return;
    onSave({
      kind,
      title: capitalize(title.trim()),
      day,
      endDay: isChantier ? endDay : undefined,
      hour: time?.hour,
      minute: time?.minute,
      address,
      notes,
    });
  }

  const fieldStyle = [styles.field, { backgroundColor: c.surface, color: c.text }];
  const tint = isChantier ? c.chantier : c.accent;
  const onTint = isChantier ? c.onChantier : c.onAccent;
  const days = dayCount(toDayKey(day), toDayKey(endDay));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel} statusBarTranslucent navigationBarTranslucent>
      <SafeAreaView style={[styles.screen, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
        <Text style={[styles.title, { color: c.text }]}>{isChantier ? 'Nouveau chantier' : 'Nouveau rendez-vous'}</Text>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={[styles.label, { color: c.text }]}>{isChantier ? 'Chantier' : 'Rendez-vous'}</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={isChantier ? 'Ex. : Salle de bain Dupont' : 'Ex. : Devis chez M. Martin'}
            placeholderTextColor={c.muted}
            style={fieldStyle}
            autoFocus
          />

          <Text style={[styles.label, { color: c.text }]}>{isChantier ? 'Début' : 'Date'}</Text>
          <Pressable onPress={() => pickDate(day, onStartPicked)} style={[styles.field, styles.pressField, { backgroundColor: c.surface }]}>
            <Text style={[styles.body, { color: c.text }]}>{capitalize(formatDate(day))}</Text>
          </Pressable>

          {isChantier && (
            <>
              <Text style={[styles.label, { color: c.text }]}>Fin</Text>
              <Pressable
                onPress={() => pickDate(endDay, setEndDay, day)}
                style={[styles.field, styles.pressField, { backgroundColor: c.surface }]}
              >
                <Text style={[styles.body, { color: c.text }]}>
                  {capitalize(formatDate(endDay))} · {days} jour{days > 1 ? 's' : ''}
                </Text>
              </Pressable>
            </>
          )}

          <Text style={[styles.label, { color: c.text }]}>{isChantier ? "Heure d'arrivée (facultatif)" : 'Heure'}</Text>
          <View style={styles.row}>
            <Pressable onPress={pickTime} style={[styles.field, styles.pressField, { backgroundColor: c.surface, flex: 1 }]}>
              <Text style={[styles.body, { color: time ? c.text : c.muted }]}>
                {time ? formatClock(time.hour, time.minute) : isChantier ? 'Choisir une heure' : 'Toute la journée'}
              </Text>
            </Pressable>
            {time && (
              <Pressable onPress={() => setTime(null)} style={styles.clear} accessibilityLabel="Retirer l'heure">
                <Text style={[styles.body, { color: c.muted }]}>✕</Text>
              </Pressable>
            )}
          </View>

          <Text style={[styles.label, { color: c.text }]}>Adresse (facultatif)</Text>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="Ex. : 12 rue des Lilas, Lyon"
            placeholderTextColor={c.muted}
            style={fieldStyle}
          />

          <Text style={[styles.label, { color: c.text }]}>Notes (facultatif)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder={isChantier ? 'Ex. : code portail 1234, prévoir l’échafaudage' : 'Ex. : apporter le devis'}
            placeholderTextColor={c.muted}
            style={[...fieldStyle, styles.multiline]}
            multiline
          />
        </ScrollView>

        <View style={styles.actions}>
          <Pressable onPress={onCancel} style={[styles.button, { backgroundColor: c.surface }]}>
            <Text style={[styles.buttonText, { color: c.text }]}>Annuler</Text>
          </Pressable>
          <Pressable
            onPress={save}
            disabled={!title.trim()}
            style={[styles.button, { backgroundColor: tint, opacity: title.trim() ? 1 : 0.4 }]}
          >
            <Text style={[styles.buttonText, { color: onTint }]}>Enregistrer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  title: { fontSize: 24, lineHeight: 32, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 8 },
  form: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600', marginTop: 8 },
  body: { fontSize: 16, lineHeight: 24 },
  field: { minHeight: 48, borderRadius: 12, paddingHorizontal: 16, fontSize: 16 },
  pressField: { justifyContent: 'center' },
  multiline: { minHeight: 96, paddingVertical: 12, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clear: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  button: { flex: 1, minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
});
