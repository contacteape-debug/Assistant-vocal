import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Rappels = notifications programmées en local par le téléphone lui-même.
 * Aucun serveur : elles sonnent même sans Internet et même app fermée.
 */

const CHANNEL = 'rappels';

export function setupNotifications() {
  // Afficher le rappel même si l'app est ouverte à ce moment-là.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Rappels',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

/** Programme une notification. Renvoie son identifiant, ou null sans permission. */
export async function scheduleNotification(title: string, body: string, at: Date): Promise<string | null> {
  const { granted } = await Notifications.requestPermissionsAsync();
  if (!granted) return null;
  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
  });
}

export async function cancelNotification(id: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // déjà passée ou déjà annulée : rien à faire
  }
}

export async function scheduleReminder(text: string, at: Date): Promise<boolean> {
  return (await scheduleNotification('Rappel', text, at)) !== null;
}
