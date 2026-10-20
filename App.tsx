import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AgendaScreen } from './src/components/AgendaScreen';
import { EmptyState } from './src/components/EmptyState';
import { EventForm } from './src/components/EventForm';
import { addedReply, EXAMPLES, runCommand, type Screen } from './src/lib/actions';
import { addEvent, deleteEvent, loadEvents, upcomingEvents, type AgendaEvent, type NewEvent } from './src/lib/agenda';
import { capitalize, formatDate } from './src/lib/dates';
import { deleteNote, loadNotes, type Note } from './src/lib/notes';
import { parseCommand } from './src/lib/parser';
import { setupNotifications } from './src/lib/reminders';
import { isFrenchAvailableOffline, say, startListening, stopListening } from './src/lib/speech';
import { confirm, useColors, type Colors } from './src/theme';

type Message = { id: number; from: 'me' | 'assistant'; text: string };
type Status = 'idle' | 'listening' | 'working';

/** L'utilisateur a-t-il accepté que la voix passe par le service en ligne ? */
const ONLINE_OK_KEY = 'onlineRecognitionAccepted';

/** La démo dans le navigateur : pas de micro, ni d'appels, ni d'alarmes. */
const IS_WEB = Platform.OS === 'web';

setupNotifications();

export default function App() {
  return (
    <SafeAreaProvider>
      <Assistant />
    </SafeAreaProvider>
  );
}

function greeting(now: Date) {
  const h = now.getHours();
  if (h < 5) return 'Bonne nuit 🌙';
  if (h < 18) return 'Bonjour 👋';
  return 'Bonsoir 🌙';
}

function Assistant() {
  const c = useColors();
  const [status, setStatus] = useState<Status>('idle');
  const [partial, setPartial] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, from: 'assistant', text: 'Appuie sur le micro et parle-moi. Dis « aide » pour savoir ce que je sais faire.' },
  ]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [screen, setScreen] = useState<Screen>('chat');
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
    if (IS_WEB) {
      push('assistant', "Ici, c'est la démo web : la voix fonctionne dans l'appli Android. Écris ta commande en bas, ou touche un exemple.");
      return;
    }
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
    if (await confirm('Supprimer ce rendez-vous ?', event.title, 'Supprimer')) setEvents(await deleteEvent(event.id));
  }

  async function onSaveForm(input: NewEvent) {
    setFormOpen(false);
    const { event, events: next, alert } = await addEvent(input);
    setEvents(next);
    push('assistant', addedReply(event, alert));
  }

  const now = new Date();
  const lastReply = [...messages].reverse().find((m) => m.from === 'assistant')?.text;
  const agendaCount = upcomingEvents(events, now).length;

  const micLabel =
    status === 'listening' ? "Je t'écoute… touche pour arrêter" : status === 'working' ? 'Un instant…' : 'Touche pour parler';

  const tabs = [
    { key: 'chat', icon: '💬', label: 'Discussion', count: 0 },
    { key: 'notes', icon: '📝', label: 'Notes', count: notes.length },
    { key: 'agenda', icon: '📅', label: 'Agenda', count: agendaCount },
  ] as const;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
      <StatusBar style={c.dark ? 'light' : 'dark'} />

      <View style={styles.header}>
        <Text style={[styles.date, { color: c.muted }]}>{capitalize(formatDate(now))}</Text>
        <Text style={[styles.title, { color: c.text }]}>{greeting(now)}</Text>
      </View>

      {IS_WEB && (
        <View style={[styles.webBanner, { backgroundColor: c.accentSoft }]}>
          <Text style={[styles.small, { color: c.accentText }]}>
            Démo web : écris tes commandes. La voix, les appels et les alarmes marchent dans l'appli Android.
          </Text>
        </View>
      )}

      <View style={[styles.tabs, { backgroundColor: c.surfaceAlt }]} accessibilityRole="tablist">
        {tabs.map(({ key, icon, label, count }) => {
          const selected = screen === key;
          return (
            <Pressable
              key={key}
              onPress={() => setScreen(key)}
              style={[styles.tab, selected && [styles.tabSelected, { backgroundColor: c.raised }]]}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={count ? `${label}, ${count}` : label}
            >
              <Text style={styles.tabIcon}>{icon}</Text>
              <Text style={[styles.tabText, { color: selected ? c.text : c.muted }]}>{label}</Text>
              {count > 0 && (
                <View style={[styles.badge, { backgroundColor: selected ? c.accent : c.border }]}>
                  <Text style={[styles.badgeText, { color: selected ? c.onAccent : c.text }]}>{count}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {screen === 'agenda' ? (
        <AgendaScreen events={events} colors={c} onAdd={() => setFormOpen(true)} onDelete={onDeleteEvent} />
      ) : screen === 'notes' ? (
        <ScrollView contentContainerStyle={styles.list}>
          {notes.length === 0 ? (
            <EmptyState icon="📝" title="Aucune note" hint="Dis « Note : acheter du pain » et je la garde ici." colors={c} />
          ) : (
            notes.map((n) => (
              <View key={n.id} style={[styles.note, { backgroundColor: c.surface, borderColor: c.border }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.body, { color: c.text }]}>{n.text}</Text>
                  <Text style={[styles.small, { color: c.muted }]}>
                    {new Date(n.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Pressable
                  onPress={() => onDeleteNote(n.id)}
                  style={styles.deleteButton}
                  accessibilityRole="button"
                  accessibilityLabel="Supprimer la note"
                >
                  <Text style={[styles.deleteIcon, { color: c.muted }]}>✕</Text>
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.list}
          // Pas au premier affichage : on laisse voir le message d'accueil et les exemples.
          onContentSizeChange={() => messages.length > 1 && scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((m) =>
            m.from === 'me' ? (
              <View key={m.id} style={[styles.bubble, styles.bubbleMe, { backgroundColor: c.accent }]}>
                <Text style={[styles.body, { color: c.onAccent }]}>{m.text}</Text>
              </View>
            ) : (
              <View key={m.id} style={[styles.bubble, styles.bubbleBot, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Text style={[styles.body, { color: c.text }]}>{m.text}</Text>
              </View>
            ),
          )}
          {partial ? (
            <View style={[styles.bubble, styles.bubbleMe, { backgroundColor: c.accentSoft }]}>
              <Text style={[styles.body, { color: c.accentText, fontStyle: 'italic' }]}>{partial}…</Text>
            </View>
          ) : null}
          {messages.length === 1 && (
            <View style={styles.examples}>
              <Text style={[styles.sectionTitle, { color: c.muted }]}>Essaie par exemple</Text>
              <View style={styles.chips}>
                {EXAMPLES.map((e) => (
                  <Pressable
                    key={e.text}
                    onPress={() => handle(e.text)}
                    style={({ pressed }) => [
                      styles.chip,
                      { backgroundColor: pressed ? c.accentSoft : c.surface, borderColor: c.border },
                    ]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.chipIcon}>{e.icon}</Text>
                    <Text style={[styles.chipText, { color: c.text }]}>{e.text}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      <View style={[styles.footer, { borderTopColor: c.border }]}>
        {screen !== 'chat' && lastReply ? (
          <Text style={[styles.small, { color: c.muted, textAlign: 'center' }]} numberOfLines={2}>
            {lastReply}
          </Text>
        ) : null}
        <MicButton status={status} label={micLabel} colors={c} onPress={onMicPress} />
        <Text style={[styles.small, { color: status === 'listening' ? c.accentText : c.muted }]}>{micLabel}</Text>

        <View style={[styles.inputRow, { backgroundColor: c.surface, borderColor: c.border }]}>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            onSubmitEditing={onSubmitTyped}
            placeholder="…ou écris une commande"
            placeholderTextColor={c.muted}
            returnKeyType="send"
            style={[styles.input, { color: c.text }]}
          />
          {typed.trim() ? (
            <Pressable
              onPress={onSubmitTyped}
              style={[styles.send, { backgroundColor: c.accent }]}
              accessibilityRole="button"
              accessibilityLabel="Envoyer"
            >
              <Text style={[styles.sendIcon, { color: c.onAccent }]}>↑</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <EventForm visible={formOpen} colors={c} onCancel={() => setFormOpen(false)} onSave={onSaveForm} />
    </SafeAreaView>
  );
}

/** Le gros bouton micro, entouré d'un halo qui « respire » pendant l'écoute. */
function MicButton({ status, label, colors: c, onPress }: { status: Status; label: string; colors: Colors; onPress: () => void }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const listening = status === 'listening';

  useEffect(() => {
    if (!listening) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [listening, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });

  return (
    <View style={styles.micWrap}>
      <Animated.View style={[styles.halo, { backgroundColor: c.accentSoft, transform: [{ scale }] }]} />
      <Pressable
        onPress={onPress}
        disabled={status === 'working'}
        style={({ pressed }) => [
          styles.mic,
          { backgroundColor: c.accent, opacity: status === 'working' ? 0.6 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={styles.micIcon}>{listening ? '⏹️' : '🎙️'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 },
  date: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  title: { fontSize: 30, lineHeight: 38, fontWeight: '800' },
  webBanner: { marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14 },
  tabs: { flexDirection: 'row', marginHorizontal: 16, borderRadius: 22, padding: 4, gap: 4 },
  tab: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  tabSelected: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tabIcon: { fontSize: 15, lineHeight: 20 },
  tabText: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  list: { padding: 16, paddingHorizontal: 20, gap: 8, flexGrow: 1 },
  bubble: { maxWidth: '85%', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 22 },
  bubbleMe: { alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  bubbleBot: { alignSelf: 'flex-start', borderBottomLeftRadius: 6, borderWidth: 1 },
  body: { fontSize: 16, lineHeight: 24 },
  small: { fontSize: 14, lineHeight: 20 },
  sectionTitle: { fontSize: 13, lineHeight: 18, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  examples: { marginTop: 20, gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    maxWidth: '100%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: 1,
  },
  chipIcon: { fontSize: 16, lineHeight: 22 },
  chipText: { fontSize: 15, lineHeight: 21, flexShrink: 1 },
  note: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingVertical: 12, borderRadius: 18, borderWidth: 1, gap: 8 },
  deleteButton: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  deleteIcon: { fontSize: 16, lineHeight: 20 },
  footer: { alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth },
  micWrap: { width: 112, height: 112, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 112, height: 112, borderRadius: 56 },
  mic: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  micIcon: { fontSize: 32, lineHeight: 40 },
  inputRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    borderRadius: 25,
    borderWidth: 1,
    paddingLeft: 18,
    paddingRight: 5,
    marginTop: 4,
  },
  input: { flex: 1, minHeight: 48, fontSize: 16 },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sendIcon: { fontSize: 20, lineHeight: 24, fontWeight: '800' },
});
