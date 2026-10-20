import AsyncStorage from '@react-native-async-storage/async-storage';

import { formatTimeKey, toDayKey, toTimeKey } from './dates';
import { cancelNotification, scheduleNotification } from './reminders';
import { normalize } from './text';

/**
 * L'agenda de l'appli. Il est indépendant de l'agenda du téléphone (Google
 * Agenda…) : rien n'y est lu ni écrit, tout reste dans l'appli.
 *
 * Une entrée tient sur un jour (souvent avec une heure) ou sur plusieurs
 * (vacances, séjour…).
 */

export type AgendaEvent = {
  id: string;
  title: string;
  /** Premier jour, "2026-10-20" */
  date: string;
  /** Dernier jour d'une entrée sur plusieurs jours ; absent = un seul jour. */
  endDate?: string;
  /** "14:00", absent = toute la journée */
  time?: string;
  address?: string;
  notes?: string;
  /** La notification d'alerte, pour pouvoir l'annuler si on supprime. */
  notificationId?: string;
};

export type NewEvent = {
  title: string;
  day: Date;
  endDay?: Date;
  hour?: number;
  minute?: number;
  address?: string;
  notes?: string;
};

const KEY = 'agenda';
/** Prévenir combien de minutes avant un rendez-vous à heure fixe. */
export const ALERT_MINUTES_BEFORE = 30;
/** Heure de l'alerte le jour même, quand l'entrée n'a pas d'heure. */
export const ALL_DAY_ALERT_HOUR = 8;

export const lastDay = (e: AgendaEvent) => e.endDate ?? e.date;

const sortKey = (e: AgendaEvent) => `${e.date} ${e.time ?? ''}`;
const byDate = (a: AgendaEvent, b: AgendaEvent) => sortKey(a).localeCompare(sortKey(b));

export async function loadEvents(): Promise<AgendaEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const events = raw ? (JSON.parse(raw) as AgendaEvent[]) : [];
    return events.sort(byDate);
  } catch {
    return [];
  }
}

async function save(events: AgendaEvent[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(events));
}

/** Les entrées qui touchent la période `from` (inclus) → `from + days` (exclu). */
export function eventsBetween(events: AgendaEvent[], from: Date, days: number): AgendaEvent[] {
  const start = toDayKey(from);
  const end = toDayKey(new Date(from.getFullYear(), from.getMonth(), from.getDate() + days));
  return events.filter((e) => e.date < end && lastDay(e) >= start);
}

/** Les entrées pas encore terminées (une entrée sur plusieurs jours en cours compte). */
export function upcomingEvents(events: AgendaEvent[], today: Date): AgendaEvent[] {
  const key = toDayKey(today);
  return events.filter((e) => lastDay(e) >= key);
}

export async function addEvent(input: NewEvent) {
  const event: AgendaEvent = {
    id: String(Date.now()),
    title: input.title.trim(),
    date: toDayKey(input.day),
    endDate: input.endDay && toDayKey(input.endDay) > toDayKey(input.day) ? toDayKey(input.endDay) : undefined,
    time: input.hour !== undefined ? toTimeKey(input.hour, input.minute ?? 0) : undefined,
    address: input.address?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
  };

  const alertAt = new Date(input.day);
  if (event.time) alertAt.setHours(input.hour!, (input.minute ?? 0) - ALERT_MINUTES_BEFORE);
  else alertAt.setHours(ALL_DAY_ALERT_HOUR, 0);

  let alert: 'scheduled' | 'denied' | 'tooLate' = 'tooLate';
  if (alertAt > new Date()) {
    const body = event.time ? `À ${formatTimeKey(event.time)} : ${event.title}` : `Aujourd'hui : ${event.title}`;
    const id = await scheduleNotification('Agenda', event.address ? `${body} — ${event.address}` : body, alertAt);
    if (id) event.notificationId = id;
    alert = id ? 'scheduled' : 'denied';
  }

  const events = [...(await loadEvents()), event].sort(byDate);
  await save(events);
  return { event, events, alert };
}

export async function deleteEvent(id: string): Promise<AgendaEvent[]> {
  const events = await loadEvents();
  const target = events.find((e) => e.id === id);
  if (target?.notificationId) await cancelNotification(target.notificationId);
  const next = events.filter((e) => e.id !== id);
  await save(next);
  return next;
}

/** Mots qui ne servent pas à reconnaître une entrée (« le rendez-vous chez… »). */
const STOPWORDS = new Set(['le', 'la', 'les', 'l', 'de', 'du', 'des', 'd', 'chez', 'avec', 'mon', 'ma', 'mes', 'pour', 'au', 'a', 'un', 'une', 'rendez', 'vous', 'rdv', 'evenement']);

export function keywords(query: string): string[] {
  return normalize(query).split(' ').filter((w) => w && !STOPWORDS.has(w));
}

/**
 * Retrouve les entrées pas encore terminées qui correspondent à « dentiste »,
 * « réunion d'équipe »… Tous les mots importants dits doivent apparaître dans
 * le titre ou l'adresse.
 */
export function findEvents(events: AgendaEvent[], query: string, day: Date | undefined, today: Date): AgendaEvent[] {
  const words = keywords(query);
  return upcomingEvents(events, today).filter((e) => {
    if (day && !(e.date <= toDayKey(day) && lastDay(e) >= toDayKey(day))) return false;
    const haystack = ` ${normalize(`${e.title} ${e.address ?? ''}`)} `;
    return words.every((w) => haystack.includes(w));
  });
}
