import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AgendaScreen } from './src/components/AgendaScreen';
import { EventForm } from './src/components/EventForm';
import { addedReply, EXAMPLES, runCommand, type Screen } from './src/lib/actions';
import {
  addEvent,
  deleteEvent,
  kindOf,
  loadEvents,
  upcomingEvents,
  type AgendaEvent,
  type AgendaKind,
  type NewEvent,
} from './src/lib/agenda';
import { deleteNote, loadNotes, type Note } from './src/lib/notes';
import { parseCommand } from './src/lib/parser';
import { setupNotifications } from './src/lib/reminders';
import { isFrenchAvailableOffline, say, startListening, stopListening } from './src/lib/speech';
import { confirm, useColors } from './src/theme';

type Message = { id: number; from: 'me' | 'assistant'; text: string };
type Status = 'idle' | 'listening' | 'working';

/** L'utilisateur a-t-il accepté que la voix passe par le service en ligne ? */
const ONLINE_OK_KEY = 'onlineRecognitionAccepted';

setupNotifications();

export default function App() {
  return (
    <SafeAreaProvider>
      <Assistant />
    </SafeAreaProvider>
  );
}

function Assistant() {
  const c = useColors();
  const [status, setStatus] = useState<Status>('idle');
  const [partial, setPartial] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, from: 'assistant', text: 'Bonjour ! Appuie sur le micro et parle-moi. Dis « aide » pour savoir ce que je sais faire.' },
  ]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [screen, setScreen] = useState<Screen>('chat');
  const [agendaKind, setAgendaKind] = useState<AgendaKind>('rdv');
  const [formOpen, setFormOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const nextId = useRef(1);

  useEffect(() => {
    loadNotes().then(setNotes);
    loadEvents().then(setEvents);
  }, []);

  function push(from: Message['from'], text: string) {
    setMessages((prev) => [...prev, { id: nextId.current++, from, text }]);
  }

  async function handle(sentence: string) {
    if (!sentence.trim()) return;
    push('me', sentence);
    setStatus('working');
    try {
      const result = await runCommand(parseCommand(sentence), { confirm });
      push('assistant', result.reply);
      say(result.reply);
      if (result.notes) setNotes(result.notes);
      if (result.events) setEvents(result.events);
      if (result.show) setScreen(result.show);
      if (result.agendaKind) setAgendaKind(result.agendaKind);
    } catch (e) {
      const reply = "Oups, ça n'a pas marché sur ce téléphone.";
      push('assistant', reply);
      say(reply);
      console.warn(e);
    } finally {
      setStatus('idle');
    }
  }

  // --- Reconnaissance vocale ------------------------------------------------
  useSpeechRecognitionEvent('start', () => setStatus('listening'));
  useSpeechRecognitionEvent('end', () => {
    setPartial('');
    setStatus((s) => (s === 'listening' ? 'idle' : s));
  });
  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript ?? '';
    if (event.isFinal) {
      setPartial('');
      handle(text);
    } else {
      setPartial(text);
    }
  });
  useSpeechRecognitionEvent('error', (event) => {
    setStatus('idle');
    setPartial('');
    if (event.error === 'aborted') return; // arrêt volontaire
    const reply =
      event.error === 'no-speech' || event.error === 'speech-timeout'
        ? "Je n'ai rien entendu. Réessaie en parlant après le bip."
        : event.error === 'language-not-supported'
          ? "Le français n'est pas disponible pour la reconnaissance vocale sur ce téléphone."
          : 'La reconnaissance vocale a échoué. Réessaie.';
    push('assistant', reply);
  });

  async function onMicPress() {
    if (status === 'listening') {
      stopListening();
      return;
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      push('assistant', "J'ai besoin du micro pour t'écouter. Autorise-le dans les paramètres du téléphone.");
      return;
    }
    if (await isFrenchAvailableOffline()) {
      startListening({ onDevice: true });
      return;
    }
    // Pas de pack hors ligne : on demande une seule fois, puis on retient la réponse.
    if ((await AsyncStorage.getItem(ONLINE_OK_KEY)) === 'yes') {
      startListening({ onDevice: false });
      return;
    }
    Alert.alert(
      'Reconnaissance en ligne',
      "La reconnaissance vocale hors ligne n'est pas installée sur ce téléphone. Si tu continues, ta voix " +
        'sera envoyée au service de reconnaissance de Google pour être transcrite.\n\n' +
        'Pour tout garder sur le téléphone : Paramètres → Google → Saisie vocale → Reconnaissance vocale hors connexion → Français.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Continuer',
          onPress: async () => {
            await AsyncStorage.setItem(ONLINE_OK_KEY, 'yes');
            startListening({ onDevice: false });
          },
        },
      ],
    );
  }

  function onSubmitTyped() {
    const text = typed;
    setTyped('');
    handle(text);
  }

  async function onDeleteNote(id: string) {
    setNotes(await deleteNote(id));
  }

  async function onDeleteEvent(event: AgendaEvent) {
    const what = kindOf(event) === 'chantier' ? 'ce chantier' : 'ce rendez-vous';
    if (await confirm(`Supprimer ${what} ?`, event.title, 'Supprimer')) setEvents(await deleteEvent(event.id));
  }

  async function onSaveForm(input: NewEvent) {
    setFormOpen(false);
    const { event, events: next, alert } = await addEvent(input);
    setEvents(next);
    push('assistant', addedReply(event, alert));
  }

  const lastReply = [...messages].reverse().find((m) => m.from === 'assistant')?.text;
  const agendaCount = upcomingEvents(events, new Date()).length;

  const micLabel =
    status === 'listening' ? 'Je t\'écoute… (touche pour arrêter)' : status === 'working' ? 'Un instant…' : 'Touche pour parler';

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
      <StatusBar style={c.dark ? 'light' : 'dark'} />

      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>Assistant vocal</Text>
      </View>

      <View style={[styles.tabs, { backgroundColor: c.surface }]} accessibilityRole="tablist">
        {(
          [
            ['chat', 'Discussion'],
            ['notes', `Notes (${notes.length})`],
            ['agenda', `Agenda (${agendaCount})`],
          ] as const
        ).map(([key, label]) => {
          const selected = screen === key;
          return (
            <Pressable
              key={key}
              onPress={() => setScreen(key)}
              style={[styles.tab, selected && { backgroundColor: c.accent }]}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.chipText, { color: selected ? c.onAccent : c.text }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {screen === 'agenda' ? (
        <AgendaScreen
          events={events}
          kind={agendaKind}
          colors={c}
          onKindChange={setAgendaKind}
          onAdd={() => setFormOpen(true)}
          onDelete={onDeleteEvent}
        />
      ) : screen === 'notes' ? (
        <ScrollView contentContainerStyle={styles.list}>
          {notes.length === 0 && (
            <Text style={[styles.muted, { color: c.muted }]}>Aucune note. Dis « Note : acheter du pain ».</Text>
          )}
          {notes.map((n) => (
            <View key={n.id} style={[styles.note, { backgroundColor: c.surface }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.body, { color: c.text }]}>{n.text}</Text>
                <Text style={[styles.small, { color: c.muted }]}>
                  {new Date(n.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <Pressable onPress={() => onDeleteNote(n.id)} style={styles.deleteButton} accessibilityLabel="Supprimer la note">
                <Text style={[styles.body, { color: c.danger }]}>Suppr.</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((m) => (
            <View
              key={m.id}
              style={[
                styles.bubble,
                m.from === 'me'
                  ? { alignSelf: 'flex-end', backgroundColor: c.accent }
                  : { alignSelf: 'flex-start', backgroundColor: c.surface },
              ]}
            >
              <Text style={[styles.body, { color: m.from === 'me' ? c.onAccent : c.text }]}>{m.text}</Text>
            </View>
          ))}
          {partial ? (
            <View style={[styles.bubble, { alignSelf: 'flex-end', backgroundColor: c.surface }]}>
              <Text style={[styles.body, { color: c.muted, fontStyle: 'italic' }]}>{partial}…</Text>
            </View>
          ) : null}
          {messages.length === 1 && (
            <View style={styles.examples}>
              <Text style={[styles.small, { color: c.muted }]}>Exemples (touche pour essayer) :</Text>
              {EXAMPLES.map((e) => (
                <Pressable key={e} onPress={() => handle(e)} style={[styles.example, { borderColor: c.surface }]}>
                  <Text style={[styles.body, { color: c.text }]}>« {e} »</Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <View style={styles.footer}>
        {screen !== 'chat' && lastReply ? (
          <Text style={[styles.small, { color: c.muted, textAlign: 'center' }]} numberOfLines={2}>
            {lastReply}
          </Text>
        ) : null}
        <Pressable
          onPress={onMicPress}
          disabled={status === 'working'}
          style={({ pressed }) => [
            styles.mic,
            { backgroundColor: status === 'listening' ? c.danger : c.accent, opacity: pressed ? 0.8 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={micLabel}
        >
          <Text style={styles.micIcon}>{status === 'listening' ? '■' : '🎤'}</Text>
        </Pressable>
        <Text style={[styles.small, { color: c.muted }]}>{micLabel}</Text>

        <TextInput
          value={typed}
          onChangeText={setTyped}
          onSubmitEditing={onSubmitTyped}
          placeholder="…ou écris une commande"
          placeholderTextColor={c.muted}
          returnKeyType="send"
          style={[styles.input, { backgroundColor: c.surface, color: c.text }]}
        />
      </View>

      <EventForm
        visible={formOpen}
        kind={agendaKind}
        colors={c}
        onCancel={() => setFormOpen(false)}
        onSave={onSaveForm}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  title: { fontSize: 24, lineHeight: 32, fontWeight: '700' },
  tabs: { flexDirection: 'row', marginHorizontal: 16, borderRadius: 24, padding: 4, gap: 4 },
  tab: { flex: 1, minHeight: 48, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  list: { padding: 16, gap: 8 },
  bubble: { maxWidth: '85%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  body: { fontSize: 16, lineHeight: 24 },
  small: { fontSize: 14, lineHeight: 20 },
  muted: { fontSize: 16, lineHeight: 24, textAlign: 'center', marginTop: 32 },
  examples: { marginTop: 16, gap: 8 },
  example: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12, borderWidth: 1 },
  note: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, gap: 12 },
  deleteButton: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  footer: { alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  mic: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  micIcon: { fontSize: 36, lineHeight: 44, color: '#ffffff' },
  input: { alignSelf: 'stretch', minHeight: 48, borderRadius: 24, paddingHorizontal: 16, fontSize: 16 },
});
