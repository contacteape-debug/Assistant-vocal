import { Linking } from 'react-native';

import * as agenda from './agenda';
import { launchActivity, openApp } from './apps';
import { findContact, type ContactLookup } from './contacts';
import { capitalize, formatClock, formatDay, formatLongDate, formatRange, formatTimeKey } from './dates';
import * as notes from './notes';
import type { AgendaKind, Command } from './parser';
import { scheduleReminder } from './reminders';

/**
 * Exécute une commande et renvoie la phrase que l'assistant prononce.
 *
 * Rien ne part sans que tu le voies : les appels ouvrent le clavier avec le
 * numéro déjà tapé, les SMS ouvrent l'appli Messages avec le texte prêt. C'est
 * toujours toi qui appuies sur « Appeler » ou « Envoyer ».
 */

export type Screen = 'chat' | 'notes' | 'agenda';

export type ActionResult = {
  reply: string;
  notes?: notes.Note[];
  events?: agenda.AgendaEvent[];
  /** L'onglet à afficher après la commande. */
  show?: Screen;
  /** Dans l'agenda : rendez-vous ou chantiers. */
  agendaKind?: AgendaKind;
};

export type ActionDeps = {
  confirm: (title: string, message: string) => Promise<boolean>;
};

export const EXAMPLES = [
  'Appelle Maman',
  'Envoie un SMS à Paul pour lui dire que j\'arrive',
  'Ouvre WhatsApp',
  'Itinéraire vers la gare',
  'Cherche recette de crêpes',
  'Réveille-moi à 7 h 30',
  'Minuteur 10 minutes',
  'Note : acheter du pain',
  'Lis mes notes',
  'Rendez-vous chez le dentiste mardi à 14 h',
  'Chantier salle de bain Dupont du 20 au 24 octobre',
  "Qu'est-ce que j'ai demain ?",
  'Rappelle-moi d\'appeler le garage dans 1 heure',
  'Quelle heure est-il ?',
];

export async function runCommand(cmd: Command, deps: ActionDeps): Promise<ActionResult> {
  switch (cmd.type) {
    case 'call': {
      const found = await findContact(cmd.contact);
      if (!found.ok) return { reply: contactError(found, cmd.contact) };
      await Linking.openURL(`tel:${found.contact.phone}`);
      return { reply: `J'appelle ${found.contact.name}. Appuie sur le bouton vert pour lancer l'appel.` };
    }

    case 'sms': {
      const found = await findContact(cmd.contact);
      if (!found.ok) return { reply: contactError(found, cmd.contact) };
      const body = cmd.body ? `?body=${encodeURIComponent(cmd.body)}` : '';
      await Linking.openURL(`sms:${found.contact.phone}${body}`);
      return {
        reply: cmd.body
          ? `Message prêt pour ${found.contact.name}. Vérifie-le puis appuie sur Envoyer.`
          : `J'ouvre la conversation avec ${found.contact.name}.`,
      };
    }

    case 'openApp': {
      const r = await openApp(cmd.app);
      if (r.ok) return { reply: `J'ouvre ${r.label}.` };
      if (r.reason === 'notInstalled') return { reply: `${r.label} n'a pas l'air installé sur ce téléphone.` };
      return { reply: `Je ne connais pas l'appli « ${cmd.app} ». Je peux ouvrir WhatsApp, YouTube, Maps, Spotify, l'appareil photo, les paramètres…` };
    }

    case 'search':
      await Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(cmd.query)}`);
      return { reply: `Je cherche « ${cmd.query} ».` };

    case 'navigate':
      await Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cmd.destination)}`,
      );
      return { reply: `Itinéraire vers ${cmd.destination}.` };

    case 'alarm':
      await launchActivity('android.intent.action.SET_ALARM', {
        extra: {
          'android.intent.extra.alarm.HOUR': cmd.hour,
          'android.intent.extra.alarm.MINUTES': cmd.minute,
          'android.intent.extra.alarm.SKIP_UI': true,
        },
      });
      return { reply: `Alarme réglée à ${formatClock(cmd.hour, cmd.minute)}.` };

    case 'timer':
      await launchActivity('android.intent.action.SET_TIMER', {
        extra: {
          'android.intent.extra.alarm.LENGTH': cmd.seconds,
          'android.intent.extra.alarm.SKIP_UI': true,
        },
      });
      return { reply: `Minuteur de ${formatDuration(cmd.seconds)} lancé.` };

    case 'addNote': {
      const list = await notes.addNote(cmd.text);
      return { reply: `C'est noté : ${cmd.text}.`, notes: list, show: 'notes' };
    }

    case 'readNotes': {
      const list = await notes.loadNotes();
      if (list.length === 0) return { reply: "Tu n'as aucune note.", notes: list, show: 'notes' };
      const shown = list.slice(0, 5).map((n, i) => `${i + 1} : ${n.text}`).join('. ');
      const more = list.length > 5 ? ` Et ${list.length - 5} autres à l'écran.` : '';
      return { reply: `Tu as ${plural(list.length, 'note')}. ${shown}.${more}`, notes: list, show: 'notes' };
    }

    case 'clearNotes': {
      const list = await notes.loadNotes();
      if (list.length === 0) return { reply: "Tu n'as aucune note à effacer." };
      const ok = await deps.confirm('Effacer les notes ?', `Les ${plural(list.length, 'note')} seront supprimées définitivement.`);
      if (!ok) return { reply: "D'accord, je garde tes notes." };
      return { reply: 'Toutes tes notes sont effacées.', notes: await notes.clearNotes() };
    }

    case 'reminder': {
      const ok = await scheduleReminder(cmd.text, cmd.at);
      if (!ok) return { reply: 'Il me faut la permission des notifications pour te rappeler quelque chose.' };
      return { reply: `Je te rappellerai ${formatWhen(cmd.at)} : ${cmd.text}.` };
    }

    case 'addEvent': {
      const { event, events, alert } = await agenda.addEvent(cmd);
      return { reply: addedReply(event, alert), events, show: 'agenda', agendaKind: cmd.kind };
    }

    case 'readAgenda': {
      const all = await agenda.loadEvents();
      const what = cmd.kind === 'chantier' ? 'chantier' : cmd.kind === 'rdv' ? 'rendez-vous' : 'événement';
      if (cmd.scope === 'upcoming') {
        const next = agenda.upcomingEvents(all, cmd.from, cmd.kind).slice(0, 5);
        if (next.length === 0) return { reply: `Aucun ${what} à venir pour l'instant.`, show: 'agenda', agendaKind: cmd.kind };
        return { reply: `À venir : ${next.map(describeEvent).join(' ; ')}.`, show: 'agenda', agendaKind: cmd.kind };
      }
      const found = agenda.eventsBetween(all, cmd.from, cmd.days, cmd.kind);
      const period =
        cmd.scope === 'week' ? 'cette semaine' : cmd.scope === 'nextWeek' ? 'la semaine prochaine' : formatDay(cmd.from);
      if (found.length === 0) {
        const nothing = cmd.kind === 'chantier' ? "tu n'as aucun chantier" : cmd.kind === 'rdv' ? "tu n'as aucun rendez-vous" : "tu n'as rien de prévu";
        return { reply: `${capitalize(period)}, ${nothing}.`, show: 'agenda', agendaKind: cmd.kind };
      }
      // Un jour donné : les chantiers d'abord (où tu travailles), puis les rendez-vous.
      const items =
        cmd.scope === 'day'
          ? [...found.filter((e) => agenda.kindOf(e) === 'chantier'), ...found.filter((e) => agenda.kindOf(e) === 'rdv')].map(describeForDay)
          : found.map(describeEvent);
      return {
        reply: `${capitalize(period)}, tu as ${plural(found.length, what)} : ${items.join(' ; ')}.`,
        show: 'agenda',
        agendaKind: cmd.kind,
      };
    }

    case 'deleteEvent': {
      const all = await agenda.loadEvents();
      const matches = agenda.findEvents(all, cmd.query, cmd.day, new Date(), cmd.kind);
      // « annule mon rendez-vous » sans nom ni jour, alors qu'il y en a plusieurs.
      const vague = !cmd.day && agenda.keywords(cmd.query).length === 0 && matches.length > 1;
      if (matches.length === 0) return { reply: 'Je ne trouve pas ça dans ton agenda.', show: 'agenda', agendaKind: cmd.kind };
      if (vague) return { reply: 'Lequel ? Précise le nom ou le jour : « annule le chantier Dupont ».', show: 'agenda', agendaKind: cmd.kind };
      const target = matches[0];
      const others = matches.length > 1 ? ` (J'en ai trouvé ${matches.length}, c'est le premier.)` : '';
      const ok = await deps.confirm("Supprimer de l'agenda ?", `${describeEvent(target)}.${others}`);
      if (!ok) return { reply: "D'accord, je le garde." };
      const events = await agenda.deleteEvent(target.id);
      return { reply: `C'est supprimé : ${target.title}.`, events, show: 'agenda', agendaKind: agenda.kindOf(target) };
    }

    case 'show': {
      if (cmd.screen === 'notes') return { reply: 'Voici tes notes.', show: 'notes' };
      const kind = cmd.kind ?? 'rdv';
      const next = agenda.upcomingEvents(await agenda.loadEvents(), new Date(), kind)[0];
      const name = kind === 'chantier' ? 'le planning des chantiers' : 'tes rendez-vous';
      return {
        reply: next ? `Voici ${name}. Prochain : ${describeEvent(next)}.` : `Voici ${name}. Rien de prévu pour l'instant.`,
        show: 'agenda',
        agendaKind: kind,
      };
    }

    case 'time': {
      const now = new Date();
      return { reply: `Il est ${formatClock(now.getHours(), now.getMinutes())}.` };
    }

    case 'date':
      return {
        reply: `Nous sommes le ${formatLongDate(new Date())}.`,
      };

    case 'help':
      return { reply: `Voici ce que je sais faire. Par exemple : ${EXAMPLES.slice(0, 6).join('. ')}.` };

    case 'unknown':
      return { reply: cmd.hint ?? "Je n'ai pas compris. Dis « aide » pour savoir ce que je sais faire." };
  }
}

function contactError(r: Extract<ContactLookup, { ok: false }>, spoken: string): string {
  if (r.reason === 'permission') return "J'ai besoin d'accéder à tes contacts pour trouver le numéro.";
  if (r.reason === 'noPhone') return `${spoken} n'a pas de numéro de téléphone dans tes contacts.`;
  return `Je ne trouve pas ${spoken} dans tes contacts.`;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n > 1 ? 's' : ''}`;
}

/** La phrase dite après un ajout — aussi utilisée par le formulaire « + ». */
export function addedReply(event: agenda.AgendaEvent, alert: 'scheduled' | 'denied' | 'tooLate'): string {
  const where = agenda.kindOf(event) === 'chantier' ? 'au planning des chantiers' : 'dans tes rendez-vous';
  const alertText =
    alert === 'scheduled'
      ? event.time
        ? ` Je te préviendrai ${agenda.ALERT_MINUTES_BEFORE} minutes avant.`
        : ` Je te préviendrai le jour même à ${agenda.ALL_DAY_ALERT_HOUR[agenda.kindOf(event)]} h.`
      : alert === 'denied'
        ? ' Les notifications sont bloquées : je ne pourrai pas te prévenir.'
        : '';
  return `C'est ajouté ${where} : ${describeEvent(event)}.${alertText}`;
}

function describeWhen(e: agenda.AgendaEvent): string {
  return `${formatRange(e.date, e.endDate)}${e.time ? ` à ${formatTimeKey(e.time)}` : ''}`;
}

/** « dentiste, mardi 20 octobre à 14 h » / « chantier Dupont, du lundi… au vendredi… » */
function describeEvent(e: agenda.AgendaEvent): string {
  const prefix = agenda.kindOf(e) === 'chantier' && !/^chantier/i.test(e.title) ? 'chantier ' : '';
  return `${prefix}${e.title}, ${describeWhen(e)}`;
}

/** Quand le jour est déjà dit : « à 14 h, dentiste » / « chantier Dupont ». */
function describeForDay(e: agenda.AgendaEvent): string {
  if (agenda.kindOf(e) === 'chantier') {
    return `chantier ${e.title}${e.time ? ` à ${formatTimeKey(e.time)}` : ''}${e.address ? `, ${e.address}` : ''}`;
  }
  return e.time ? `à ${formatTimeKey(e.time)}, ${e.title}` : `${e.title} (toute la journée)`;
}

function formatDuration(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h && plural(h, 'heure'), m && plural(m, 'minute'), s && plural(s, 'seconde')]
    .filter(Boolean)
    .join(' et ');
}

function formatWhen(at: Date): string {
  const now = new Date();
  const clock = formatClock(at.getHours(), at.getMinutes());
  const minutes = Math.round((at.getTime() - now.getTime()) / 60000);
  if (minutes < 60) return `dans ${plural(Math.max(minutes, 1), 'minute')}`;
  return `${formatDay(at, now)} à ${clock}`;
}
