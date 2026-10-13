import * as IntentLauncher from 'expo-intent-launcher';
import { Linking } from 'react-native';

import { normalize } from './text';

/**
 * Les applis qu'on sait ouvrir par leur nom.
 *
 * Android ne permet pas de demander « ouvre l'appli qui s'appelle X » : il faut
 * connaître son identifiant (« package »). On en liste plusieurs par appli
 * quand ça dépend du fabricant (Xiaomi, Samsung, Google…) : le premier
 * installé gagne. Pour en ajouter une : trouver son identifiant dans l'adresse
 * de sa page Play Store (…details?id=com.exemple.appli).
 */
type AppEntry = {
  names: string[];
  label: string;
  packages?: string[];
  /** Pour les écrans du système, on passe par une « action » Android. */
  action?: string;
  url?: string;
};

const APPS: AppEntry[] = [
  { label: 'WhatsApp', names: ['whatsapp', 'whats app', 'watsap'], packages: ['com.whatsapp'] },
  { label: 'YouTube', names: ['youtube', 'you tube'], packages: ['com.google.android.youtube'] },
  { label: 'Gmail', names: ['gmail', 'mail', 'mails', 'email', 'e mail', 'mes mails'], packages: ['com.google.android.gm'] },
  { label: 'Google Maps', names: ['maps', 'google maps', 'carte', 'plan'], packages: ['com.google.android.apps.maps'] },
  { label: 'Waze', names: ['waze'], packages: ['com.waze'] },
  { label: 'Chrome', names: ['chrome', 'navigateur', 'internet'], packages: ['com.android.chrome'] },
  { label: 'Spotify', names: ['spotify'], packages: ['com.spotify.music'] },
  { label: 'Deezer', names: ['deezer'], packages: ['deezer.android.app'] },
  { label: 'Instagram', names: ['instagram', 'insta'], packages: ['com.instagram.android'] },
  { label: 'Facebook', names: ['facebook'], packages: ['com.facebook.katana'] },
  { label: 'Messenger', names: ['messenger'], packages: ['com.facebook.orca'] },
  { label: 'Snapchat', names: ['snapchat', 'snap'], packages: ['com.snapchat.android'] },
  { label: 'TikTok', names: ['tiktok', 'tik tok'], packages: ['com.zhiliaoapp.musically'] },
  { label: 'Telegram', names: ['telegram'], packages: ['org.telegram.messenger'] },
  { label: 'X', names: ['twitter', 'x'], packages: ['com.twitter.android'] },
  { label: 'LinkedIn', names: ['linkedin', 'linked in'], packages: ['com.linkedin.android'] },
  { label: 'Netflix', names: ['netflix'], packages: ['com.netflix.mediaclient'] },
  { label: 'Leboncoin', names: ['leboncoin', 'le bon coin', 'bon coin'], packages: ['fr.leboncoin'] },
  { label: 'Doctolib', names: ['doctolib'], packages: ['fr.doctolib.www'] },
  { label: 'SNCF Connect', names: ['sncf', 'sncf connect'], packages: ['com.vsct.vsc.mobile.horaireetresa.android'] },
  { label: 'Uber', names: ['uber'], packages: ['com.ubercab'] },
  { label: 'le Play Store', names: ['play store', 'playstore', 'store', 'google play'], packages: ['com.android.vending'] },
  { label: 'Anti-Gaspi', names: ['anti gaspi', 'antigaspi'], packages: ['com.anonymous.antigaspiapp'] },
  { label: 'la galerie', names: ['galerie', 'photos', 'mes photos', 'google photos'], packages: ['com.miui.gallery', 'com.google.android.apps.photos', 'com.sec.android.gallery3d'] },
  { label: 'la calculatrice', names: ['calculatrice', 'calculette'], packages: ['com.miui.calculator', 'com.google.android.calculator', 'com.sec.android.app.popupcalculator'] },
  { label: "l'horloge", names: ['horloge', 'reveil', 'alarmes', 'chronometre'], packages: ['com.android.deskclock', 'com.google.android.deskclock', 'com.sec.android.app.clockpackage'] },
  { label: 'les messages', names: ['messages', 'sms', 'texto', 'textos'], packages: ['com.google.android.apps.messaging', 'com.android.mms', 'com.samsung.android.messaging'] },
  { label: 'les contacts', names: ['contacts', 'repertoire'], packages: ['com.google.android.contacts', 'com.android.contacts', 'com.samsung.android.app.contacts'] },
  { label: 'le téléphone', names: ['telephone', 'clavier', 'composeur'], url: 'tel:' },
  { label: "l'appareil photo", names: ['appareil photo', 'camera', 'photo'], action: 'android.media.action.STILL_IMAGE_CAMERA' },
  { label: 'les paramètres', names: ['parametres', 'reglages', 'configuration'], action: 'android.settings.SETTINGS' },
  { label: 'les réglages Wi-Fi', names: ['wifi', 'wi fi', 'parametres wifi'], action: 'android.settings.WIFI_SETTINGS' },
  { label: 'les réglages Bluetooth', names: ['bluetooth', 'parametres bluetooth'], action: 'android.settings.BLUETOOTH_SETTINGS' },
];

function findApp(spoken: string): AppEntry | undefined {
  const n = normalize(spoken).replace(/^(?:appli|application)\s+/, '');
  // D'abord une correspondance exacte, puis « contient » (« ouvre WhatsApp s'il te plaît »).
  return (
    APPS.find((a) => a.names.includes(n)) ??
    APPS.find((a) => a.names.some((name) => name.length > 2 && ` ${n} `.includes(` ${name} `)))
  );
}

/** Lance une activité sans rester bloqué à attendre qu'elle se ferme. */
export async function launchActivity(action: string, params?: IntentLauncher.IntentLauncherParams) {
  await Promise.race([
    IntentLauncher.startActivityAsync(action, params),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]);
}

/** Ouvre une appli par son nom. Renvoie son nom joli, ou null si inconnue / pas installée. */
export async function openApp(spoken: string): Promise<{ ok: true; label: string } | { ok: false; reason: 'unknown' | 'notInstalled'; label?: string }> {
  const app = findApp(spoken);
  if (!app) return { ok: false, reason: 'unknown' };

  if (app.url) {
    await Linking.openURL(app.url);
    return { ok: true, label: app.label };
  }
  if (app.action) {
    await launchActivity(app.action);
    return { ok: true, label: app.label };
  }
  for (const pkg of app.packages ?? []) {
    try {
      IntentLauncher.openApplication(pkg);
      return { ok: true, label: app.label };
    } catch {
      // pas installée sous ce nom-là, on essaie le suivant
    }
  }
  return { ok: false, reason: 'notInstalled', label: app.label };
}
