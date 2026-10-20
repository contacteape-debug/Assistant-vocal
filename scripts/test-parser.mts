// Vérifie l'analyseur de phrases sur l'ordinateur : `npm run test:parser`.
import { parseCommand } from '../src/lib/parser.ts';

const now = new Date(2026, 9, 13, 14, 0); // mardi 13 octobre 2026, 14 h 00

const cases: [string, Record<string, unknown>][] = [
  ['Appelle Maman', { type: 'call', contact: 'Maman' }],
  ['appelle le 06 12 34 56 78', { type: 'call', contact: 'le 06 12 34 56 78' }],
  ['Envoie un SMS à Paul pour lui dire que j\'arrive dans 10 minutes', { type: 'sms', contact: 'Paul', body: "J'arrive dans 10 minutes" }],
  ['envoie un message à Jean-Pierre : on se voit demain', { type: 'sms', contact: 'Jean-Pierre', body: 'On se voit demain' }],
  ['dis à Léa que je serai en retard', { type: 'sms', contact: 'Léa', body: 'Je serai en retard' }],
  ['Ouvre WhatsApp', { type: 'openApp', app: 'WhatsApp' }],
  ["lance l'appareil photo", { type: 'openApp', app: 'appareil photo' }],
  ['cherche recette de crêpes', { type: 'search', query: 'recette de crêpes' }],
  ['Quelle météo à Lyon demain', { type: 'search' }],
  ['itinéraire vers la gare de Lyon', { type: 'navigate', destination: 'la gare de Lyon' }],
  ['emmène-moi au travail', { type: 'navigate', destination: 'travail' }],
  ['Réveille-moi à 7h30', { type: 'alarm', hour: 7, minute: 30 }],
  ['mets une alarme à sept heures et demie', { type: 'alarm', hour: 7, minute: 30 }],
  ['alarme à 8 heures du soir', { type: 'alarm', hour: 20, minute: 0 }],
  ['réveil à midi', { type: 'alarm', hour: 12, minute: 0 }],
  ['Minuteur 10 minutes', { type: 'timer', seconds: 600 }],
  ['mets un minuteur de une heure et demie', { type: 'timer', seconds: 5400 }],
  ['minuteur 1 h 30', { type: 'timer', seconds: 5400 }],
  ['compte à rebours de quarante-cinq secondes', { type: 'timer', seconds: 45 }],
  ['minuteur deux minutes 30 secondes', { type: 'timer', seconds: 150 }],
  ['Note acheter du pain', { type: 'addNote', text: 'Acheter du pain' }],
  ['prends une note : rappeler le plombier', { type: 'addNote', text: 'Rappeler le plombier' }],
  ['lis-moi mes notes', { type: 'readNotes' }],
  ['efface toutes mes notes', { type: 'clearNotes' }],
  ['Rappelle-moi de sortir le chien dans 20 minutes', { type: 'reminder', text: 'Sortir le chien', at: new Date(2026, 9, 13, 14, 20) }],
  ["rappelle-moi dans une heure d'appeler le garage", { type: 'reminder', text: 'Appeler le garage', at: new Date(2026, 9, 13, 15, 0) }],
  ['rappelle-moi demain à 9h de prendre mes médicaments', { type: 'reminder', text: 'Prendre mes médicaments', at: new Date(2026, 9, 14, 9, 0) }],
  ['rappelle-moi à 18h30 de fermer les volets', { type: 'reminder', text: 'Fermer les volets', at: new Date(2026, 9, 13, 18, 30) }],
  ['rappelle-moi à 10h de faire les courses', { type: 'reminder', text: 'Faire les courses', at: new Date(2026, 9, 14, 10, 0) }],
  ['rappelle-moi demain de payer le loyer', { type: 'reminder', text: 'Payer le loyer', at: new Date(2026, 9, 14, 9, 0) }],
  ['rappelle-moi de boire', { type: 'unknown' }],
  // Agenda de l'appli
  ['Ajoute un rendez-vous chez le dentiste mardi à 14h', { type: 'addEvent', title: 'Rendez-vous chez le dentiste', day: new Date(2026, 9, 20), hour: 14, minute: 0 }],
  ['rdv avec Paul vendredi à 18h30', { type: 'addEvent', title: 'Rendez-vous avec Paul', day: new Date(2026, 9, 16), hour: 18, minute: 30 }],
  ["note dans l'agenda réunion d'équipe demain à 10h", { type: 'addEvent', title: "Réunion d'équipe", day: new Date(2026, 9, 14), hour: 10 }],
  ['ajoute à mon agenda anniversaire de Léa le 25 octobre', { type: 'addEvent', title: 'Anniversaire de Léa', day: new Date(2026, 9, 25), hour: undefined }],
  ["mets dans l'agenda vacances le 1er janvier", { type: 'addEvent', title: 'Vacances', day: new Date(2027, 0, 1) }],
  ["j'ai rendez-vous chez le médecin après-demain à neuf heures", { type: 'addEvent', title: 'Rendez-vous chez le médecin', day: new Date(2026, 9, 15), hour: 9 }],
  ['réunion à 16h', { type: 'addEvent', title: 'Réunion', day: new Date(2026, 9, 13), hour: 16 }],
  ['ajoute au calendrier dîner chez Marc samedi soir', { type: 'addEvent', title: 'Dîner chez Marc', day: new Date(2026, 9, 17), hour: undefined }],
  ['rendez-vous chez le coiffeur', { type: 'unknown' }],
  ["qu'est-ce que j'ai demain", { type: 'readAgenda', scope: 'day', from: new Date(2026, 9, 14), days: 1 }],
  ['quels sont mes rendez-vous cette semaine', { type: 'readAgenda', scope: 'week', days: 6 }],
  ['est-ce que je suis libre jeudi', { type: 'readAgenda', scope: 'day', from: new Date(2026, 9, 15) }],
  ['lis mon agenda', { type: 'readAgenda', scope: 'upcoming' }],
  ['mon programme de la semaine prochaine', { type: 'readAgenda', scope: 'nextWeek', from: new Date(2026, 9, 19), days: 7 }],
  ["ouvre l'agenda", { type: 'show', screen: 'agenda' }],
  ['ouvre mes notes', { type: 'show', screen: 'notes' }],
  ['montre-moi mes notes', { type: 'show', screen: 'notes' }],
  ['annule le rendez-vous chez le dentiste', { type: 'deleteEvent', query: 'rendez-vous chez le dentiste', day: undefined }],
  ['supprime mon rendez-vous de mardi', { type: 'deleteEvent', query: 'rendez-vous', day: new Date(2026, 9, 20) }],
  ['efface la réunion de demain', { type: 'deleteEvent', query: 'réunion', day: new Date(2026, 9, 14) }],
  ['efface toutes mes notes', { type: 'clearNotes' }],
  // Sur plusieurs jours
  ["ajoute à l'agenda vacances du 20 au 24 octobre", { type: 'addEvent', title: 'Vacances', day: new Date(2026, 9, 20), endDay: new Date(2026, 9, 24) }],
  ['ajoute au planning stage de voile du lundi au vendredi', { type: 'addEvent', title: 'Stage de voile', day: new Date(2026, 9, 19), endDay: new Date(2026, 9, 23) }],
  ["mets dans l'agenda séjour chez Mamie du 28 au 3 novembre", { type: 'addEvent', title: 'Séjour chez Mamie', day: new Date(2026, 9, 28), endDay: new Date(2026, 10, 3) }],
  ["mets dans l'agenda festival lundi pendant trois jours", { type: 'addEvent', title: 'Festival', day: new Date(2026, 9, 19), endDay: new Date(2026, 9, 21) }],
  ['rendez-vous chez le comptable lundi à 9h', { type: 'addEvent', title: 'Rendez-vous chez le comptable', day: new Date(2026, 9, 19), hour: 9, endDay: undefined }],
  ["qu'est-ce que j'ai lundi", { type: 'readAgenda', scope: 'day', from: new Date(2026, 9, 19) }],
  ['mes rendez-vous de demain', { type: 'readAgenda', scope: 'day', from: new Date(2026, 9, 14) }],
  ['ouvre le planning', { type: 'show', screen: 'agenda' }],
  // Les exemples de l'écran d'accueil doivent tous marcher.
  ["Envoie un SMS à Paul : j'arrive", { type: 'sms', contact: 'Paul', body: "J'arrive" }],
  ['Réveille-moi à 7 h 30', { type: 'alarm', hour: 7, minute: 30 }],
  ['Itinéraire vers la gare', { type: 'navigate', destination: 'la gare' }],
  ['Note : acheter du pain', { type: 'addNote', text: 'Acheter du pain' }],
  ['Rendez-vous dentiste mardi à 14 h', { type: 'addEvent', title: 'Rendez-vous dentiste', day: new Date(2026, 9, 20), hour: 14 }],
  ["Rappelle-moi d'appeler le garage dans 1 h", { type: 'reminder', text: 'Appeler le garage', at: new Date(2026, 9, 13, 15, 0) }],
  ['Quelle heure est-il', { type: 'time' }],
  ['on est quel jour', { type: 'date' }],
  ["qu'est-ce que tu sais faire", { type: 'help' }],
  ["c'est quoi la capitale du Pérou", { type: 'search' }],
  ['blablabla', { type: 'unknown' }],
];

let failed = 0;
for (const [input, expected] of cases) {
  const got = parseCommand(input, now) as Record<string, unknown>;
  const ok = Object.entries(expected).every(([k, v]) =>
    v instanceof Date ? got[k] instanceof Date && (got[k] as Date).getTime() === v.getTime() : got[k] === v,
  );
  if (!ok) {
    failed++;
    console.log(`✗ « ${input} »\n    attendu : ${JSON.stringify(expected)}\n    obtenu  : ${JSON.stringify(got)}`);
  }
}
console.log(`${cases.length - failed}/${cases.length} phrases comprises correctement`);
process.exit(failed ? 1 : 0);
