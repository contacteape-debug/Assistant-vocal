/**
 * Transforme une phrase dite à voix haute en commande.
 *
 * Tout se fait ici, sur le téléphone, avec des expressions régulières : pas
 * d'IA, pas de réseau, pas de coût. La contrepartie : l'app ne comprend que
 * les tournures prévues ci-dessous. Pour en ajouter une, c'est ici.
 *
 * Ce fichier n'importe rien de React Native exprès : il se teste sur
 * l'ordinateur avec `npm run test:parser`.
 */

export type Command =
  | { type: 'call'; contact: string }
  | { type: 'sms'; contact: string; body: string }
  | { type: 'openApp'; app: string }
  | { type: 'search'; query: string }
  | { type: 'navigate'; destination: string }
  | { type: 'alarm'; hour: number; minute: number }
  | { type: 'timer'; seconds: number }
  | { type: 'addNote'; text: string }
  | { type: 'readNotes' }
  | { type: 'clearNotes' }
  | { type: 'reminder'; text: string; at: Date }
  /** `endDay` : dernier jour d'un événement sur plusieurs jours (vacances…). */
  | { type: 'addEvent'; title: string; day: Date; endDay?: Date; hour?: number; minute?: number }
  /** `day` : un seul jour ; `week` / `nextWeek` : une semaine ; `upcoming` : les prochains. */
  | { type: 'readAgenda'; scope: 'day' | 'week' | 'nextWeek' | 'upcoming'; from: Date; days: number }
  | { type: 'deleteEvent'; query: string; day?: Date }
  | { type: 'show'; screen: 'notes' | 'agenda' }
  | { type: 'time' }
  | { type: 'date' }
  | { type: 'help' }
  | { type: 'unknown'; text: string; hint?: string };

// ---------------------------------------------------------------------------
// Nombres en toutes lettres → chiffres
// ---------------------------------------------------------------------------

const UNITS = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
];
const TENS: [string, number][] = [['vingt', 20], ['trente', 30], ['quarante', 40], ['cinquante', 50]];

/** "vingt et un" → 21, "dix sept" → 17… jusqu'à 59 (assez pour des heures et des minutes). */
const NUMBER_WORDS: Record<string, number> = (() => {
  const words: Record<string, number> = {};
  // « un » et « une » sont exclus : « envoie un SMS » deviendrait « envoie 1 SMS ».
  // Ils sont traités à part, seulement devant une unité de temps.
  UNITS.forEach((w, i) => { if (i > 1) words[w] = i; });
  words['zero'] = 0;
  for (const u of [7, 8, 9]) words[`dix ${UNITS[u]}`] = 10 + u;
  for (const [ten, value] of TENS) {
    words[ten] = value;
    words[`${ten} et un`] = value + 1;
    words[`${ten} et une`] = value + 1;
    for (let u = 2; u <= 9; u++) words[`${ten} ${UNITS[u]}`] = value + u;
  }
  return words;
})();

// Les plus longues d'abord, pour que « vingt deux » gagne sur « vingt ».
const NUMBER_RE = new RegExp(
  `\\b(${Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length).join('|')})\\b`,
  'gi',
);

function wordsToDigits(text: string): string {
  return text
    // « réveille-moi » → « réveille moi », « dix-sept » → « dix sept ». Pas tous
    // les traits d'union : « rendez-vous » et « Jean-Pierre » doivent rester intacts.
    .replace(/(\p{L})-(moi|toi|lui|leur|ce|il|elle|on|je|tu|nous)\b/giu, '$1 $2')
    .replace(/\b(dix|vingt|trente|quarante|cinquante)((?:-(?:et|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf))+)\b/gi,
      (_, ten: string, rest: string) => ten + rest.replace(/-/g, ' '))
    .replace(NUMBER_RE, (w) => String(NUMBER_WORDS[w.toLowerCase()]))
    .replace(/\b(un|une)\s+(heures?|minutes?|secondes?|jours?|semaines?|h\b|min\b)/gi, '1 $2')
    .replace(/\b(une\s+)?demi\s*heure\b/gi, '30 minutes')
    .replace(/\b(un\s+)?quart d'heure\b/gi, '15 minutes');
}

// ---------------------------------------------------------------------------
// Heures et durées
// ---------------------------------------------------------------------------

/** "7h30", "7 heures et demie", "19:15", "midi", "8 heures du soir" → { hour, minute }. */
const CLOCK_RE =
  // Le « midi » d'« après-midi » n'est pas une heure.
  /(?<!apr[eè]s[\s-])\b(midi|minuit|(\d{1,2})\s*(?:heures?|h|:)\s*(?:(\d{1,2})(?:\s*minutes?)?|et\s+(demie?|quart)|moins\s+le\s+quart)?)(\s*(?:du\s+matin|du\s+soir|de\s+l'apr[eè]s[\s-]midi|ce\s+soir))?/i;

export function parseClock(text: string): { hour: number; minute: number; match: string } | null {
  const m = text.match(CLOCK_RE);
  if (!m) return null;
  let hour: number;
  let minute = 0;
  const word = m[1].toLowerCase();
  if (word === 'midi') hour = 12;
  else if (word === 'minuit') hour = 0;
  else {
    hour = Number(m[2]);
    if (m[3]) minute = Number(m[3]);
    else if (m[4]) minute = m[4].toLowerCase().startsWith('demi') ? 30 : 15;
    else if (/moins\s+le\s+quart/i.test(m[1])) { hour -= 1; minute = 45; }
  }
  if (m[5] && /soir|midi/i.test(m[5]) && hour < 12) hour += 12;
  if (hour < 0) hour += 24;
  if (hour > 23 || minute > 59) return null;
  return { hour, minute, match: m[0] };
}

/** "10 minutes", "1 h 30", "2 heures et demie", "45 secondes" → secondes. */
export function parseDuration(text: string): { seconds: number; match: string } | null {
  let rest = text;
  let seconds = 0;
  const parts: string[] = [];

  const h = rest.match(/(\d+)\s*(?:heures?|h)\b(?:\s*et\s*(demie?|quart)|\s*(\d{1,2})\b(?!\s*s))?/i);
  if (h) {
    seconds += Number(h[1]) * 3600;
    if (h[2]) seconds += h[2].toLowerCase().startsWith('demi') ? 1800 : 900;
    if (h[3]) seconds += Number(h[3]) * 60;
    parts.push(h[0]);
    rest = rest.replace(h[0], ' ');
  }
  const min = rest.match(/(\d+)\s*(?:mn|min|minutes?)\b/i);
  if (min) {
    seconds += Number(min[1]) * 60;
    parts.push(min[0]);
    rest = rest.replace(min[0], ' ');
  }
  const sec = rest.match(/(\d+)\s*(?:s|sec|secondes?)\b/i);
  if (sec) {
    seconds += Number(sec[1]);
    parts.push(sec[0]);
  }
  if (seconds === 0) return null;
  // `match` sert à retirer la durée de la phrase (rappels) : on renvoie
  // l'étendue complète, de la première à la dernière partie trouvée.
  const starts = parts.map((p) => text.indexOf(p));
  const ends = parts.map((p, i) => starts[i] + p.length);
  return { seconds, match: text.slice(Math.min(...starts), Math.max(...ends)) };
}

// ---------------------------------------------------------------------------
// Rappels : "rappelle-moi de X dans 20 minutes / demain à 9h / à 18h"
// ---------------------------------------------------------------------------

function parseReminder(t: string, now: Date): Command {
  let body = t.replace(/^.*?\b(?:rappelle\s*moi|fais\s*moi\s*penser|n'oublie\s+pas\s+de\s+me\s+rappeler)\b/i, ' ');
  let at: Date | null = null;

  const inMatch = body.match(/\bdans\s+(.+?)(?=\s+(?:de\s|d'|que\s|qu')|$)/i);
  const duration = inMatch ? parseDuration(inMatch[1]) : null;
  if (inMatch && duration) {
    at = new Date(now.getTime() + duration.seconds * 1000);
    body = body.replace(inMatch[0], ' ');
  } else {
    const tomorrow = /\bdemain\b/i.test(body);
    const clock = parseClock(body);
    if (tomorrow || clock) {
      at = new Date(now);
      at.setSeconds(0, 0);
      if (clock) at.setHours(clock.hour, clock.minute);
      else at.setHours(9, 0); // « demain » sans heure : 9 h, pas minuit.
      if (tomorrow) at.setDate(at.getDate() + 1);
      else if (at <= now) at.setDate(at.getDate() + 1); // 18 h déjà passé → demain 18 h
      if (clock) body = body.replace(new RegExp(`(?:\\s(?:à|a|vers))?\\s*${escapeRe(clock.match)}`, 'i'), ' ');
      body = body.replace(/\b(?:demain|ce\s+soir|aujourd'hui)\b/gi, ' ');
    }
  }

  const text = body
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:de\s+|d'|que\s+|qu')/i, '')
    .replace(/^(?:je\s+dois|il\s+faut)\s+/i, '')
    .trim();

  if (!at) return { type: 'unknown', text: t, hint: 'Précise quand : « dans 20 minutes », « à 18 h » ou « demain à 9 h ».' };
  if (!text) return { type: 'unknown', text: t, hint: 'Dis aussi de quoi te rappeler : « rappelle-moi d\'appeler le garage dans 1 heure ».' };
  return { type: 'reminder', text: capitalize(text), at };
}

// ---------------------------------------------------------------------------
// Jours : "demain", "mardi", "le 25 octobre", "le 3", "dans 4 jours"
// ---------------------------------------------------------------------------

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
const WEEKDAY_RE = WEEKDAYS.join('|');
const MONTH_RE = 'janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre';

function deaccent(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function parseDay(text: string, now: Date): { day: Date; match: string } | null {
  const today = startOfDay(now);
  let m: RegExpMatchArray | null;

  // « mardi 20 octobre », « le 1er novembre », « le 25 décembre 2026 »
  m = text.match(new RegExp(`(?:\\b(?:${WEEKDAY_RE})\\s+)?(?:\\ble\\s+)?\\b(\\d{1,2}|premier)(?:er)?\\s+(${MONTH_RE})(?:\\s+(\\d{4}))?`, 'i'));
  if (m) {
    const dayNum = m[1].toLowerCase() === 'premier' ? 1 : Number(m[1]);
    const month = MONTHS.indexOf(deaccent(m[2]));
    let day = new Date(m[3] ? Number(m[3]) : today.getFullYear(), month, dayNum);
    if (!m[3] && day < today) day = new Date(today.getFullYear() + 1, month, dayNum); // 1er janvier dit en octobre
    if (day.getDate() === dayNum) return { day, match: m[0] };
  }

  m = text.match(/\bapr[eè]s[\s-]demain\b/i);
  if (m) return { day: addDays(today, 2), match: m[0] };
  m = text.match(/\bdemain\b/i);
  if (m) return { day: addDays(today, 1), match: m[0] };
  m = text.match(/\baujourd'hui\b|\bce\s+(?:soir|matin)\b|\bcet\s+apr[eè]s[\s-]midi\b/i);
  if (m) return { day: today, match: m[0] };

  // « jeudi » = le prochain jeudi ; dit un jeudi, c'est celui de la semaine suivante.
  m = text.match(new RegExp(`\\b(${WEEKDAY_RE})(?:\\s+prochain)?\\b`, 'i'));
  if (m) {
    const target = WEEKDAYS.indexOf(m[1].toLowerCase());
    const diff = (target - today.getDay() + 7) % 7 || 7;
    return { day: addDays(today, diff), match: m[0] };
  }

  // « le 25 » : ce mois-ci, ou le mois prochain si c'est passé.
  m = text.match(/\b(?:le|du)\s+(\d{1,2})(?:er)?\b(?!\s*(?:h\b|heures?|:|min))/i);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 31) {
      let day = new Date(today.getFullYear(), today.getMonth(), n);
      if (day < today) day = new Date(today.getFullYear(), today.getMonth() + 1, n);
      if (day.getDate() === n) return { day, match: m[0] };
    }
  }

  m = text.match(/\bdans\s+(\d+)\s+(jours?|semaines?)\b/i);
  if (m) return { day: addDays(today, Number(m[1]) * (/^s/i.test(m[2]) ? 7 : 1)), match: m[0] };

  return null;
}

// ---------------------------------------------------------------------------
// Plages de jours (vacances, séjours…) : "du 20 au 24 octobre", "du lundi au vendredi",
// "à partir de lundi pendant 3 jours"
// ---------------------------------------------------------------------------

const DAY_TOKEN =
  `(?:(?:${WEEKDAY_RE})(?:\\s+\\d{1,2}(?:er)?(?:\\s+(?:${MONTH_RE}))?)?` +
  `|(?:\\d{1,2}|premier)(?:er)?(?:\\s+(?:${MONTH_RE}))?(?:\\s+\\d{4})?` +
  `|apr[eè]s[\\s-]demain|demain|aujourd'hui)`;
const RANGE_RE = new RegExp(
  `\\b(?:du|de)\\s+(${DAY_TOKEN})\\s+(?:au|à|a|jusqu'au|jusqu'à)\\s+(?:le\\s+)?(${DAY_TOKEN})(?![\\w])`,
  'i',
);
const BARE_NUMBER = /^(?:(\d{1,2})|premier)(?:er)?$/i;

export function parseRange(text: string, now: Date): { start: Date; end: Date; match: string } | null {
  const m = text.match(RANGE_RE);
  if (!m) return null;
  const [, a, b] = m;
  const bareA = a.match(BARE_NUMBER);
  const bareB = b.match(BARE_NUMBER);
  const num = (x: RegExpMatchArray) => (x[1] ? Number(x[1]) : 1);

  let start: Date | undefined;
  let end: Date | undefined;
  if (bareA && !bareB) {
    // « du 28 au 3 novembre » : le mois n'est dit qu'une fois, à la fin.
    end = parseDay(b, now)?.day;
    if (end) {
      start = new Date(end.getFullYear(), end.getMonth(), num(bareA));
      if (start > end) start = new Date(end.getFullYear(), end.getMonth() - 1, num(bareA));
    }
  } else {
    start = parseDay(bareA ? `le ${num(bareA)}` : a, now)?.day;
    if (start && bareB) {
      end = new Date(start.getFullYear(), start.getMonth(), num(bareB));
      if (end < start) end = new Date(start.getFullYear(), start.getMonth() + 1, num(bareB));
    } else {
      end = parseDay(b, now)?.day;
    }
  }
  if (!start || !end) return null;
  // « du jeudi au mardi » : le mardi d'après.
  while (end < start) end = addDays(end, 7);
  return { start, end, match: m[0] };
}

// ---------------------------------------------------------------------------
// Agenda de l'appli (pas celui du téléphone)
// ---------------------------------------------------------------------------

const AGENDA_WORD = /\b(?:agenda|calendrier|planning)\b/i;
// Pas de \b devant : il ne fonctionne pas avant une lettre accentuée (« événement »).
const EVENT_WORD = /(?:^|[\s'])(?:rendez[\s-]vous|rdv|r[ée]union|[ée]v[ée]nement)/i;

/** « ouvre l'agenda », « qu'est-ce que j'ai demain », « mes rendez-vous de la semaine » */
const AGENDA_READ_RE =
  /qu'est[\s-]ce\s+que\s+j'ai|qu'est[\s-]ce\s+qui\s+est\s+pr[ée]vu|qu'ai[\s-]je|j'ai\s+quoi|quoi\s+de\s+pr[ée]vu|mon\s+programme|suis[\s-]je\s+libre|je\s+suis\s+libre|est[\s-]ce\s+que\s+j'ai\s+(?:quelque\s+chose|un\s+rendez|des\s+rendez|rendez)|\bmes\s+(?:rendez[\s-]vous|rdv|r[ée]unions|[ée]v[ée]nements)\b|\bplanning\s+(?:de\s+la\s+|du\s+|de\s+)?(?:semaine|jour|demain)|^(?:lis|lire|montre|affiche|ouvre|consulte|donne)\s+(?:moi\s+)?(?:mon\s+|l'|le\s+|ton\s+)?(?:agenda|calendrier|planning)\b/i;

const AGENDA_ADD_RE =
  /^(?:(?:j'ai|nouveau|nouvel|ajoute|ajouter|prends?|fixe|cale|mets|note|programme|planifie|cr[ée]e)\s+(?:un\s+|une\s+|le\s+)?)?(?:rendez[\s-]vous|rdv|r[ée]union)\b/i;
const ADD_VERB_RE = /^(?:ajoute|ajouter|mets|mettre|note|noter|inscris|inscrire|programme|programmer|cr[ée]e|cr[ée]er|planifie|planifier|enregistre|enregistrer)\b/i;

function parseAgendaRead(t: string, now: Date): Command {
  const today = startOfDay(now);
  if (/cette\s+semaine/i.test(t)) {
    // Jusqu'à dimanche inclus.
    return { type: 'readAgenda', scope: 'week', from: today, days: ((7 - today.getDay()) % 7) + 1 };
  }
  if (/semaine\s+prochaine/i.test(t)) {
    const toMonday = ((8 - today.getDay()) % 7) || 7;
    return { type: 'readAgenda', scope: 'nextWeek', from: addDays(today, toMonday), days: 7 };
  }
  const day = parseDay(t, now);
  if (day) return { type: 'readAgenda', scope: 'day', from: day.day, days: 1 };
  if (/^(?:montre|affiche|ouvre|consulte)\b/i.test(t)) return { type: 'show', screen: 'agenda' };
  return { type: 'readAgenda', scope: 'upcoming', from: today, days: 365 };
}

/** Retire « à 14 h » et « mardi » d'une phrase ; renvoie ce qui reste. */
function stripWhen(t: string, now: Date) {
  let rest = t;
  const clock = parseClock(rest);
  if (clock) rest = rest.replace(new RegExp(`(?:\\s(?:à|a|vers|de|pour))?\\s*${escapeRe(clock.match)}`, 'i'), ' ');
  const day = parseDay(rest, now);
  if (day) rest = rest.replace(new RegExp(`(?:\\s(?:pour|de|du))?\\s*${escapeRe(day.match)}`, 'i'), ' ');
  return { rest, clock, day };
}

function parseAgendaAdd(t: string, raw: string, now: Date): Command {
  let text = t;
  let day: Date | undefined;
  let endDay: Date | undefined;

  const range = parseRange(text, now);
  if (range) {
    day = range.start;
    endDay = range.end;
    text = text.replace(range.match, ' ');
  }
  // « pendant 3 jours », « pendant 2 semaines » : la durée de l'événement.
  const during = text.match(/\bpendant\s+(\d+)\s+(jours?|semaines?)\b/i);
  if (during) text = text.replace(during[0], ' ');
  text = text.replace(/(?:^|\s)(?:à|a)\s+partir\s+(?:de\s+|du\s+|d')?/i, ' ');

  const stripped = stripWhen(text, now);
  const clock = stripped.clock;
  day ??= stripped.day?.day;

  let title = stripped.rest
    .replace(/(?:^|\s)(?:dans|à|a|sur|au|en)\s+(?:mon\s+|l'|le\s+)?(?:agenda|calendrier|planning)\b/gi, ' ')
    .replace(AGENDA_WORD, ' ')
    .replace(/\s+(?:soir|matin)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const lead = /^(?:(?:ajoute|ajouter|mets|mettre|note|noter|inscris|inscrire|programme|programmer|cr[ée]e|cr[ée]er|planifie|planifier|enregistre|enregistrer|fixe|cale|prends?|j'ai|nouveau|nouvelle|nouvel|un|une|le|la|les|des|moi|de|du)\b|l'|d'|:|,)\s*/i;
  while (lead.test(title)) title = title.replace(lead, '');
  title = title
    .replace(/(?:\s+(?:à|a|le|la|de|du|pour|et)|\s*[,:.])+$/i, '')
    .replace(/\brdv\b/gi, 'rendez-vous')
    .replace(/\brendez vous\b/gi, 'rendez-vous')
    .trim();

  if (!day && clock) {
    // « réunion à 16 h » sans jour : aujourd'hui, ou demain si l'heure est passée.
    const today = startOfDay(now);
    const at = new Date(today.getFullYear(), today.getMonth(), today.getDate(), clock.hour, clock.minute);
    day = at > now ? today : addDays(today, 1);
  }
  if (day && during) {
    const n = Number(during[1]) * (/^s/i.test(during[2]) ? 7 : 1);
    endDay = addDays(day, Math.max(n, 1) - 1);
  }

  const example = '« dentiste mardi à 14 h » ou « réunion le 25 octobre »';
  if (!day) return { type: 'unknown', text: raw, hint: `Dis quand : ${example}.` };
  if (!title) return { type: 'unknown', text: raw, hint: `Dis aussi ce que c'est : ${example}.` };
  return {
    type: 'addEvent',
    title: capitalize(title),
    day,
    endDay: endDay && endDay > day ? endDay : undefined,
    hour: clock?.hour,
    minute: clock?.minute,
  };
}

function parseAgendaDelete(t: string, now: Date): Command {
  const { rest, day } = stripWhen(t, now);
  const query = rest
    .replace(/^\s*(?:annule|annuler|supprime|supprimer|efface|effacer|enl[eè]ve|enlever|retire|retirer)\s+/i, '')
    .replace(/(?:^|\s)(?:de|dans|du)\s+(?:mon\s+|l'|le\s+)?(?:agenda|calendrier|planning)\b/gi, ' ')
    .replace(/^(?:(?:les|le|la|mes|mon|ma)\b|l')\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return { type: 'deleteEvent', query, day: day?.day };
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

export function parseCommand(raw: string, now: Date = new Date()): Command {
  const t = wordsToDigits(raw.replace(/[’‘]/g, "'").trim()).replace(/\s+/g, ' ');
  const l = t.toLowerCase();
  let m: RegExpMatchArray | null;

  if (!l) return { type: 'unknown', text: raw };

  if (/^(?:aide|help)\b|sais\s+faire|peux\s+faire|quelles?\s+commandes/.test(l)) return { type: 'help' };
  if (/quelle\s+heure/.test(l)) return { type: 'time' };
  if (/quel\s+jour|quelle\s+date|on\s+est\s+le\s+combien/.test(l)) return { type: 'date' };

  // Minuteur — avant l'alarme : « mets un minuteur de 5 minutes ».
  if (/minuteur|compte\s+[àa]\s+rebours|\btimer\b/.test(l)) {
    const d = parseDuration(t);
    if (d) return { type: 'timer', seconds: d.seconds };
    return { type: 'unknown', text: raw, hint: 'Dis la durée : « minuteur 10 minutes ».' };
  }

  // Rappels — avant l'alarme, car « rappelle-moi à 7 h » contient aussi une heure.
  if (/rappelle\s*moi|fais\s*moi\s*penser|me\s+rappeler/.test(l)) return parseReminder(t, now);

  if (/r[ée]veille\s*moi|\balarme\b|\br[ée]veil\b/.test(l)) {
    const c = parseClock(t);
    if (c) return { type: 'alarm', hour: c.hour, minute: c.minute };
    return { type: 'unknown', text: raw, hint: 'Dis l\'heure : « réveille-moi à 7 h 30 ».' };
  }

  // Agenda de l'appli — avant les notes : « note dans l'agenda… » est un rendez-vous.
  if (/^(?:annule|annuler|supprime|supprimer|efface|effacer|enl[eè]ve|enlever|retire|retirer)\b/.test(l) && (EVENT_WORD.test(l) || AGENDA_WORD.test(l))) {
    return parseAgendaDelete(t, now);
  }
  if (AGENDA_READ_RE.test(l)) return parseAgendaRead(t, now);
  if (AGENDA_ADD_RE.test(l) || (ADD_VERB_RE.test(l) && AGENDA_WORD.test(l))) return parseAgendaAdd(t, raw, now);

  // Notes de l'appli
  if (/^(?:ouvre|affiche|montre|va\s+(?:sur|dans))\s+(?:moi\s+)?(?:mes|les)\s+notes?\b/.test(l)) return { type: 'show', screen: 'notes' };
  if (/\b(?:lis|lire|relis|relire|donne|quelles\s+sont)\b.*\bnotes?\b/.test(l)) return { type: 'readNotes' };
  if (/\b(?:efface|effacer|supprime|supprimer|vide|vider)\b.*\bnotes?\b/.test(l)) return { type: 'clearNotes' };
  m = t.match(/^(?:prends?\s+(?:une\s+)?note|note|nouvelle\s+note|ajoute\s+(?:une\s+)?note|[ée]cris\s+(?:une\s+)?note)\s*(?::|que\s+|qu'|de\s+)?\s*(.+)$/i);
  if (m) return { type: 'addNote', text: capitalize(m[1].trim()) };

  // SMS — avant l'appel : « envoie un message à Paul ».
  m = t.match(
    /^(?:envoie|envoyer|envoies|[ée]cris|[ée]crire)(?:\s+(?:un|1))?\s+(?:sms|texto|message|msg)\s+(?:à|a|pour)\s+(.+?)(?:\s*(?::|,|\bpour\s+(?:lui\s+)?dire(?:\s+que)?|\bqui\s+dit(?:\s+que)?|\b(?:en\s+)?disant(?:\s+que)?|\bdis\s+lui(?:\s+que)?)\s*(.+))?$/i,
  );
  if (m) return { type: 'sms', contact: m[1].trim(), body: capitalize((m[2] ?? '').trim()) };
  m = t.match(/^dis\s+(?:à|a)\s+(.+?)\s+(?:que|qu')\s*(.+)$/i);
  if (m) return { type: 'sms', contact: m[1].trim(), body: capitalize(m[2].trim()) };

  m = t.match(/^(?:appelle|appeler|appel|t[ée]l[ée]phone\s+(?:à|a)|passe\s+un\s+coup\s+de\s+(?:fil|t[ée]l[ée]phone)\s+(?:à|a)|compose\s+le\s+num[ée]ro\s+de)\s+(.+)$/i);
  if (m) return { type: 'call', contact: m[1].trim() };

  m = t.match(/^(?:itin[ée]raire|emm[eè]ne\s*moi|guide\s*moi|conduis\s*moi|comment\s+(?:aller|me\s+rendre)|navigation|direction)\s+(?:(?:vers|jusqu'(?:aux|au|à)|pour\s+aller\s+(?:aux|au|à)|aux|au|à|a|pour)\s+)?(.+)$/i);
  if (m) return { type: 'navigate', destination: m[1].trim() };

  if (/m[ée]t[ée]o|quel\s+temps\s+fait/.test(l)) return { type: 'search', query: t };

  m = t.match(/^(?:ouvre|ouvrir|lance|lancer|d[ée]marre|va\s+sur)\s+(?:l'appli(?:cation)?\s+|l'|le\s+|la\s+|les\s+|mon\s+|ma\s+|mes\s+)?(.+)$/i);
  if (m) return { type: 'openApp', app: m[1].trim() };

  m = t.match(/^(?:cherche|recherche|rechercher|chercher|google|trouve)(?:\s+(?:sur|dans)\s+(?:internet|google|le\s+web))?\s+(.+)$/i);
  if (m) return { type: 'search', query: m[1].trim() };

  // Une question qu'on ne sait pas traiter : on propose une recherche web.
  if (/^(?:c'est\s+quoi|qu'est\s+ce|qui\s+est|qui\s+a|combien|comment|pourquoi|o[uù]\s+est|quel|quelle|quels|quelles)\b/.test(l)) {
    return { type: 'search', query: t };
  }

  return { type: 'unknown', text: raw };
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
