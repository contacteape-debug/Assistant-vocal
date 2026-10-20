import { Alert, Platform, useColorScheme } from 'react-native';

/**
 * Couleurs de l'appli, en clair et en sombre (suit le réglage du téléphone).
 * Des tons neutres un peu chauds, et un seul accent vert sauge, doux.
 */
export function useColors() {
  const dark = useColorScheme() === 'dark';
  return dark
    ? {
        dark,
        background: '#161715',
        surface: '#21231f',
        /** Fond des pastilles et de la barre d'onglets, un cran au-dessus. */
        surfaceAlt: '#2b2e29',
        /** L'onglet choisi, qui « sort » de la barre. */
        raised: '#41453e',
        border: '#353830',
        text: '#ecebe6',
        muted: '#a3a199',
        accent: '#8cc2ab',
        /** L'accent très dilué : halo du micro, puce de l'heure. */
        accentSoft: '#2b3a33',
        accentText: '#9fd0ba',
        onAccent: '#10201a',
        danger: '#ff8a7a',
        success: '#5fd38a',
      }
    : {
        dark,
        background: '#f6f4ef',
        surface: '#ffffff',
        surfaceAlt: '#ebe8e1',
        raised: '#ffffff',
        border: '#e2ded5',
        text: '#24221e',
        muted: '#6b675f',
        accent: '#4f7a6a',
        accentSoft: '#dde9e3',
        accentText: '#3d6a59',
        onAccent: '#ffffff',
        danger: '#c0392b',
        success: '#1b7f3b',
      };
}

export type Colors = ReturnType<typeof useColors>;

/** Une question oui/non. Fermer la boîte sans choisir = non. */
export function confirm(title: string, message: string, okLabel = 'Effacer'): Promise<boolean> {
  // Sur le web, Alert.alert n'affiche rien : on passe par la boîte du navigateur.
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
        { text: okLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
