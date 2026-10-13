/**
 * Dates en français, écrites à la main plutôt qu'avec `toLocaleDateString` :
 * le résultat est le même sur tous les téléphones, et ça se teste sur PC.
 */

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Date → "2026-10-20". Stocké tel quel : pas de fuseau horaire, pas de surprise. */
export function toDayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** "mardi 20 octobre" (+ l'année si ce n'est pas celle en cours). */
export function formatDate(day: Date, now: Date = new Date()): string {
  const year = day.getFullYear() !== now.getFullYear() ? ` ${day.getFullYear()}` : '';
  const date = day.getDate() === 1 ? '1er' : String(day.getDate());
  return `${WEEKDAYS[day.getDay()]} ${date} ${MONTHS[day.getMonth()]}${year}`;
}

/** "aujourd'hui", "demain", sinon "mardi 20 octobre". */
export function formatDay(day: Date, now: Date = new Date()): string {
  const key = toDayKey(day);
  if (key === toDayKey(now)) return "aujourd'hui";
  if (key === toDayKey(addDays(now, 1))) return 'demain';
  return formatDate(day, now);
}

/** "lun. 20 oct." — pour les cartes, où la place manque. */
export function formatShortDate(day: Date): string {
  return `${WEEKDAYS[day.getDay()].slice(0, 3)}. ${day.getDate()} ${SHORT_MONTHS[day.getMonth()]}`;
}

const SHORT_MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** Un jour, ou "du lundi 19 octobre au vendredi 23 octobre". */
export function formatRange(startKey: string, endKey?: string, now: Date = new Date()): string {
  if (!endKey || endKey === startKey) return formatDay(fromDayKey(startKey), now);
  return `du ${formatDate(fromDayKey(startKey), now)} au ${formatDate(fromDayKey(endKey), now)}`;
}

/** Nombre de jours d'une plage, bornes comprises. */
export function dayCount(startKey: string, endKey?: string): number {
  if (!endKey) return 1;
  return Math.round((fromDayKey(endKey).getTime() - fromDayKey(startKey).getTime()) / 86_400_000) + 1;
}

/** "mardi 13 octobre 2026" */
export function formatLongDate(day: Date): string {
  const date = day.getDate() === 1 ? '1er' : String(day.getDate());
  return `${WEEKDAYS[day.getDay()]} ${date} ${MONTHS[day.getMonth()]} ${day.getFullYear()}`;
}

export function formatClock(hour: number, minute: number): string {
  if (hour === 12 && minute === 0) return 'midi';
  if (hour === 0 && minute === 0) return 'minuit';
  return `${hour} h${minute ? ` ${pad(minute)}` : ''}`;
}

/** "14:05" → "14 h 05" */
export function formatTimeKey(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return formatClock(h, m);
}

export function toTimeKey(hour: number, minute: number): string {
  return `${pad(hour)}:${pad(minute)}`;
}

export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
