import { Alert, useColorScheme } from 'react-native';

/** Couleurs de l'appli, en clair et en sombre (suit le réglage du téléphone). */
export function useColors() {
  const dark = useColorScheme() === 'dark';
  return dark
    ? {
        dark,
        background: '#121214',
        surface: '#26262b',
        text: '#f2f2f5',
        muted: '#a0a0aa',
        accent: '#7c8cff',
        accentText: '#9aa6ff',
        onAccent: '#0b0b20',
        danger: '#ff6b6b',
        // Les chantiers ont leur propre couleur pour ne pas les confondre avec les rendez-vous.
        chantier: '#ffa04d',
        onChantier: '#1f1000',
        success: '#5fd38a',
      }
    : {
        dark,
        background: '#ffffff',
        surface: '#f0f0f4',
        text: '#16161a',
        muted: '#62626e',
        accent: '#3d4fd6',
        accentText: '#3d4fd6',
        onAccent: '#ffffff',
        danger: '#d32f2f',
        chantier: '#b45309',
        onChantier: '#ffffff',
        success: '#1b7f3b',
      };
}

export type Colors = ReturnType<typeof useColors>;

/** Une question oui/non. Fermer la boîte sans choisir = non. */
export function confirm(title: string, message: string, okLabel = 'Effacer'): Promise<boolean> {
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
