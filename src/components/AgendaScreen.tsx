import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { lastDay, upcomingEvents, type AgendaEvent } from '../lib/agenda';
import { capitalize, formatDay, formatShortDate, formatTimeKey, fromDayKey, toDayKey } from '../lib/dates';
import type { Colors } from '../theme';
import { EmptyState } from './EmptyState';

/**
 * L'onglet Agenda : les entrées à venir, regroupées par jour. Le bouton
 * « Ajouter » ouvre le formulaire.
 */

type Props = {
  events: AgendaEvent[];
  colors: Colors;
  onAdd: () => void;
  onDelete: (event: AgendaEvent) => void;
};

function openItinerary(address: string) {
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`);
}

export function AgendaScreen({ events, colors: c, onAdd, onDelete }: Props) {
  const items = upcomingEvents(events, new Date());
  const todayKey = toDayKey(new Date());
  // Une entrée sur plusieurs jours déjà commencée se range sous « aujourd'hui ».
  const dayOf = (e: AgendaEvent) => (e.date < todayKey ? todayKey : e.date);
  const days = [...new Set(items.map(dayOf))].sort();

  return (
    <View style={styles.screen}>
      <View style={styles.toolbar}>
        <Text style={[styles.heading, { color: c.text }]}>À venir</Text>
        <Pressable
          onPress={onAdd}
          style={({ pressed }) => [styles.add, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Ajouter un rendez-vous"
        >
          <Text style={[styles.addText, { color: c.onAccent }]}>＋ Ajouter</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {items.length === 0 ? (
          <EmptyState
            icon="📅"
            title="Rien de prévu"
            hint="Touche « Ajouter » ou dis « Rendez-vous chez le dentiste mardi à 14 h »."
            colors={c}
          />
        ) : (
          days.map((day) => (
            <View key={day} style={styles.group}>
              <Text style={[styles.groupTitle, { color: c.muted }]}>{capitalize(formatDay(fromDayKey(day)))}</Text>
              {items
                .filter((e) => dayOf(e) === day)
                .map((e) => (
                  <EventCard key={e.id} event={e} colors={c} onDelete={onDelete} />
                ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function EventCard({ event: e, colors: c, onDelete }: { event: AgendaEvent; colors: Colors; onDelete: (e: AgendaEvent) => void }) {
  const range = e.endDate
    ? `${formatShortDate(fromDayKey(e.date))} → ${formatShortDate(fromDayKey(lastDay(e)))}`
    : undefined;
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={[styles.timeChip, { backgroundColor: c.accentSoft }]}>
        <Text style={[styles.time, { color: c.accentText }]}>{e.time ? formatTimeKey(e.time) : 'Journée'}</Text>
      </View>
      <View style={styles.details}>
        <Text style={[styles.cardTitle, { color: c.text }]}>{e.title}</Text>
        {range ? <Text style={[styles.small, { color: c.muted }]}>{range}</Text> : null}
        {e.address ? (
          <Pressable
            onPress={() => openItinerary(e.address!)}
            style={styles.address}
            hitSlop={{ top: 8, bottom: 8 }}
            accessibilityRole="link"
            accessibilityHint="Ouvre l'itinéraire"
          >
            <Text style={[styles.small, { color: c.accentText }]}>📍 {e.address}</Text>
          </Pressable>
        ) : null}
        {e.notes ? <Text style={[styles.small, { color: c.muted }]}>{e.notes}</Text> : null}
      </View>
      <Pressable
        onPress={() => onDelete(e)}
        style={styles.delete}
        accessibilityRole="button"
        accessibilityLabel={`Supprimer ${e.title}`}
      >
        <Text style={[styles.deleteIcon, { color: c.muted }]}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  heading: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  add: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  addText: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  list: { padding: 16, paddingHorizontal: 20, gap: 8, flexGrow: 1 },
  group: { gap: 8, marginBottom: 12 },
  groupTitle: { fontSize: 13, lineHeight: 18, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
  },
  timeChip: { minWidth: 64, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12, alignItems: 'center' },
  time: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  details: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  small: { fontSize: 14, lineHeight: 20 },
  address: { minHeight: 28, justifyContent: 'center' },
  delete: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  deleteIcon: { fontSize: 16, lineHeight: 20 },
});
