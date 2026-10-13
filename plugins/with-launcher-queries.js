// Depuis Android 11, une appli ne « voit » pas les autres applis installées
// sauf si elle le déclare. Sans ce bloc <queries>, « Ouvre WhatsApp »
// répondrait toujours « pas installé ». On ne demande à voir que les applis
// qui ont une icône sur l'écran d'accueil — pas toute la liste du système.
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withLauncherQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.queries = manifest.queries ?? [];
    manifest.queries.push({
      intent: [
        {
          action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
          category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
        },
      ],
    });
    return cfg;
  });
};
