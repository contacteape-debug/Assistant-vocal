# Assistant vocal

Appli Android de commandes vocales en français (Expo / React Native), avec
notes et agenda propres à l'appli.
Voir le [README](README.md) pour ce que l'appli sait faire et où est quoi.

Les règles Expo génériques sont dans [AGENTS.md](AGENTS.md). Ci-dessous, ce
qui est propre à ce projet et prime sur AGENTS.md.

## Robin

Débutant complet en programmation, Windows, téléphone Android (Redmi Note 12).
Parler français, expliquer le pourquoi de chaque étape, avancer par étapes
vérifiables. **C'est à moi de faire les commandes git**, jamais à lui.

## Règles du projet

- **Expo SDK 54, pas plus récent** : c'est la version qui marche avec l'outillage
  de Robin. Lire la doc https://docs.expo.dev/versions/v54.0.0/ (vérifier le
  champ `expo` de `package.json` avant). Attention : `npx expo install
  expo-speech-recognition` propose une version 57.x incompatible — rester en
  `^3.1.3`.
- **Gratuit et local d'abord** : pas d'IA ni d'API payante à l'usage sans en
  parler à Robin (le coût qui grossit avec l'usage le préoccupe).
- **Notes et agenda appartiennent à l'appli** : ne jamais lire ni écrire les
  notes ou le Google Agenda du téléphone.
- **Rien ne part tout seul** : appels et SMS sont préparés, c'est Robin qui
  appuie sur Appeler / Envoyer.
- **Nouvelle tournure vocale** : ajouter d'abord la phrase dans
  `scripts/test-parser.mts`, puis le regex dans `src/lib/parser.ts`, puis
  `npm run test:parser`.
- **Avant de dire « fini »** : `npx tsc --noEmit` et `npm run test:parser`.

## Git — sauvegarde après chaque fonctionnalité

À la fin de chaque fonctionnalité : récapituler en une phrase, montrer
`git status`, demander « Je commit et je push cette fonctionnalité ? », puis
attendre son accord. Message de commit en français.

## Compiler et installer sur le téléphone

Build local (pas EAS) : `npx expo run:android`, téléphone branché en USB avec
le débogage USB activé (`adb devices -l` doit afficher `device`). Variables
d'environnement à remettre si une commande dit « not set » :

- `ANDROID_HOME` = `C:\Users\robin\AppData\Local\Android\Sdk`
- `JAVA_HOME` = `C:\Program Files\Android\Android Studio\jbr`

Le dossier `android/` est généré (ignoré par git) : ne jamais le modifier à la
main, tout passe par `app.json` et `plugins/`.

Aperçu rapide sans téléphone : `npx expo start --web` (pas de micro, pas
d'alertes, pas de boîtes de confirmation dans le navigateur).
