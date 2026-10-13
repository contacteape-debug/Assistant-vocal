import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { kindOf, lastDay, upcomingEvents, type AgendaEvent, type AgendaKind } from '../lib/agenda';
import { capitalize, dayCount, formatDay, formatShortDate, formatTimeKey, fromDayKey, toDayKey } from '../lib/dates';
import type { Colors } from '../theme';

/**
 * L'onglet Agenda, séparé en deux : les rendez-vous pro, et le planning des
 * chantiers. Le « + » ouvre le formulaire pour la partie affichée.
 */

type Props = {
  events: AgendaEvent[];
  kind: AgendaKind;
  colors: Colors;
  onKindChange: (kind: AgendaKind) => void;
  onAdd: () => void;
  onDelete: (event: AgendaEvent) => void;
};

function openItinerary(address: string) {
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`);
}

export function AgendaScreen({ events, kind, colors: c, onKindChange, onAdd, onDelete }: Props) {
  const today = new Date();
  const rdv = upcomingEvents(events, today, 'rdv');
  const chantiers = upcomingEvents(events, today, 'chantier');
  const isChantier = kind === 'chantier';
  const tint = isChantier ? c.chantier : c.accent;

  return (
    <View style={styles.screen}>
      <View style={styles.toolbar}>
        <View style={[styles.segments, { backgroundColor: c.surface }]} accessibilityRole="tablist">
          {(
            [
              ['rdv', `Rendez-vous (${rdv.length})`, c.accent, c.onAccent],
              ['chantier', `Chantiers (${chantiers.length})`, c.chantier, c.onChantier],
            ] as const
          ).map(([key, label, color, onColor]) => {
            const selected = kind === key;
            return (
              <Pressable
                key={key}
                onPress={() => onKindChange(key)}
                style={[styles.segment, selected && { backgroundColor: color }]}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.segmentText, { color: selected ? onColor : c.text }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={onAdd}
          style={({ pressed }) => [styles.add, { backgroundColor: tint, opacity: pressed ? 0.8 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={isChantier ? 'Ajouter un chantier' : 'Ajouter un rendez-vous'}
        >
          <Text style={[styles.addText, { color: isChantier ? c.onChantier : c.onAccent }]}>+</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {isChantier ? (
          <ChantierList items={chantiers} colors={c} onDelete={onDelete} />
        ) : (
          <RdvList items={rdv} colors={c} onDelete={onDelete} />
        )}
      </ScrollView>
    </View>
  );
}

function RdvList({ items, colors: c, onDelete }: { items: AgendaEvent[]; colors: Colors; onDelete: (e: AgendaEvent) => void }) {
  if (items.length === 0) {
    return (
      <Text style={[styles.empty, { color: c.muted }]}>
        Aucun rendez-vous. Touche « + » ou dis « Rendez-vous chez le comptable lundi à 9 h ».
      </Text>
    );
  }
  const days = [...new Set(items.map((e) => e.date))];
  return (
    <>
      {days.map((day) => (
        <View key={day} style={styles.group}>
          <Text style={[styles.groupTitle, { color: c.text }]}>{capitalize(formatDay(fromDayKey(day)))}</Text>
          {items
            .filter((e) => e.date === day)
            .map((e) => (
              <View key={e.id} style={[styles.card, { backgroundColor: c.surface }]}>
                <Text style={[styles.time, { color: c.accentText }]}>{e.time ? formatTimeKey(e.time) : 'Journée'}</Text>
                <Details event={e} colors={c} />
                <DeleteButton event={e} colors={c} onDelete={onDelete} />
              </View>
            ))}
        </View>
      ))}
    </>
  );
}

function ChantierList({ items, colors: c, onDelete }: { items: AgendaEvent[]; colors: Colors; onDelete: (e: AgendaEvent) => void }) {
  if (items.length === 0) {
    return (
      <Text style={[styles.empty, { color: c.muted }]}>
        Aucun chantier prévu. Touche « + » ou dis « Chantier salle de bain Dupont du 20 au 24 octobre ».
      </Text>
    );
  }
  const todayKey = toDayKey(new Date());
  const ongoing = items.filter((e) => e.date <= todayKey);
  const next = items.filter((e) => e.date > todayKey);
  const sections = [
    { label: 'En cours', list: ongoing },
    { label: 'À venir', list: next },
  ].filter((section) => section.list.length > 0);
  return (
    <>
      {sections.map(({ label, list }) => (
        <View key={label} style={styles.group}>
          <Text style={[styles.groupTitle, { color: c.text }]}>{label}</Text>
          {list.map((e) => {
            const range = e.endDate
              ? `${formatShortDate(fromDayKey(e.date))} → ${formatShortDate(fromDayKey(lastDay(e)))} · ${dayCount(e.date, e.endDate)} jours`
              : capitalize(formatDay(fromDayKey(e.date)));
            return (
              <View key={e.id} style={[styles.card, styles.chantierCard, { backgroundColor: c.surface, borderLeftColor: c.chantier }]}>
                <View style={styles.details}>
                  <Text style={[styles.cardTitle, { color: c.text }]}>{e.title}</Text>
                  <Text style={[styles.small, { color: c.chantier }]}>
                    {range}
                    {e.time ? ` · arrivée ${formatTimeKey(e.time)}` : ''}
                  </Text>
                  <Extras event={e} colors={c} />
                </View>
                <DeleteButton event={e} colors={c} onDelete={onDelete} />
              </View>
            );
          })}
        </View>
      ))}
    </>
  );
}

function Details({ event: e, colors: c }: { event: AgendaEvent; colors: Colors }) {
  return (
    <View style={styles.details}>
      <Text style={[styles.body, { color: c.text }]}>{e.title}</Text>
      <Extras event={e} colors={c} />
    </View>
  );
}

/** L'adresse (touche = itinéraire) et les notes, s'il y en a. */
function Extras({ event: e, colors: c }: { event: AgendaEvent; colors: Colors }) {
  return (
    <>
      {e.address ? (
        <Pressable
          onPress={() => openItinerary(e.address!)}
          style={styles.address}
          hitSlop={{ top: 8, bottom: 8 }}
          accessibilityRole="link"
          accessibilityHint="Ouvre l'itinéraire"
        >
          <Text style={[styles.small, { color: c.accentText, textDecorationLine: 'underline' }]}>📍 {e.address}</Text>
        </Pressable>
      ) : null}
      {e.notes ? <Text style={[styles.small, { color: c.muted }]}>{e.notes}</Text> : null}
    </>
  );
}

function DeleteButton({ event, colors: c, onDelete }: { event: AgendaEvent; colors: Colors; onDelete: (e: AgendaEvent) => void }) {
  return (
    <Pressable
      onPress={() => onDelete(event)}
      style={styles.delete}
      accessibilityLabel={`Supprimer ${kindOf(event) === 'chantier' ? 'le chantier' : 'le rendez-vous'} ${event.title}`}
    >
      <Text style={[styles.body, { color: c.danger }]}>Suppr.</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  segments: { flex: 1, flexDirection: 'row', borderRadius: 24, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 48, borderRadius: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  segmentText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  add: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  addText: { fontSize: 32, lineHeight: 36, fontWeight: '500' },
  list: { padding: 16, gap: 8 },
  empty: { fontSize: 16, lineHeight: 24, textAlign: 'center', marginTop: 32 },
  group: { gap: 8, marginBottom: 8 },
  groupTitle: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  card: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingVertical: 8, borderRadius: 12, gap: 12 },
  chantierCard: { borderLeftWidth: 4 },
  details: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  time: { fontSize: 14, lineHeight: 20, fontWeight: '700', minWidth: 56 },
  body: { fontSize: 16, lineHeight: 24 },
  small: { fontSize: 14, lineHeight: 20 },
  address: { minHeight: 32, justifyContent: 'center' },
  delete: { minHeight: 48, minWidth: 64, alignItems: 'center', justifyContent: 'center' },
});
