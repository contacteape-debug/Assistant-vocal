import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import * as Speech from 'expo-speech';

/**
 * Reconnaissance vocale : garder la voix sur le téléphone.
 *
 * Par défaut (`requiresOnDeviceRecognition: false`), Android envoie l'audio au
 * service de reconnaissance de Google, donc sur le réseau. On force le mode
 * hors ligne quand le pack de langue française est installé ; sinon l'écran
 * demande une fois l'accord avant de passer en ligne. Même logique que dans
 * l'app anti-gaspi.
 */

/**
 * Le service de reconnaissance hors ligne de Google. Sans ce paramètre,
 * `installedLocales` revient vide même quand le pack est installé.
 */
const ANDROID_ON_DEVICE_SERVICE = 'com.google.android.as';

export async function isFrenchAvailableOffline(): Promise<boolean> {
  try {
    const { installedLocales } = await ExpoSpeechRecognitionModule.getSupportedLocales({
      androidRecognitionServicePackage: ANDROID_ON_DEVICE_SERVICE,
    });
    return installedLocales.some((locale) => locale.toLowerCase().startsWith('fr'));
  } catch {
    // Dans le doute, on répond non : mieux vaut une question de trop que de
    // faire partir la voix sur le réseau sans prévenir.
    return false;
  }
}

export function startListening({ onDevice }: { onDevice: boolean }) {
  Speech.stop(); // ne pas s'écouter soi-même parler
  ExpoSpeechRecognitionModule.start({
    lang: 'fr-FR',
    interimResults: true, // affiche les mots au fur et à mesure
    continuous: false, // s'arrête tout seul quand on se tait
    requiresOnDeviceRecognition: onDevice,
    // Aide le moteur à reconnaître le vocabulaire des commandes.
    contextualStrings: ['minuteur', 'réveille-moi', 'rappelle-moi', 'itinéraire', 'WhatsApp', 'SMS'],
  });
}

export function stopListening() {
  ExpoSpeechRecognitionModule.stop();
}

export function say(text: string) {
  Speech.stop();
  Speech.speak(text, { language: 'fr-FR' });
}
