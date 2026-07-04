# Audio des démos — `/allo-maude/demos`

Ce dossier reçoit les **clips audio premium** des démos par industrie (un MP3 par
tour d'appel) + un `manifest.json`. Ils sont **générés hors ligne** et **non
committés** (voir `.gitignore`) : on ne pousse pas d'audio lourd sans accord.

## Générer l'audio

```bash
# 1. Mets ta clé dans .env.local (jamais dans le repo)
#    OPENAI_API_KEY=sk-...
# 2. Lance le générateur
npm run demo:audio
```

- Sans `OPENAI_API_KEY`, la commande échoue proprement (exit 1) et rien n'est écrit.
- La page `/allo-maude/demos` reste fonctionnelle **sans** audio : elle affiche un
  état propre « Audio premium à générer » et le transcript. Dès que les clips
  existent sur disque, les lecteurs « Écouter » s'activent automatiquement
  (la page vérifie les fichiers à chaque requête).

## Ce qui est généré

- `demo-audio/<scenarioId>/NN-maude.mp3` et `NN-caller.mp3` — un clip par tour,
  dans l'ordre de l'appel.
- `demo-audio/manifest.json` — générateur, date, et liste des clips par scénario.

Le texte des clips est **dérivé du vrai cerveau vocal** (`src/services/pack-demo`),
donc ce qu'on entend correspond exactement à ce que le runtime produit. Ce sont
des **simulations représentatives**, jamais des enregistrements d'appels réels.

## Configuration optionnelle

- `DEMO_TTS_MODEL` — modèle TTS (défaut `gpt-4o-mini-tts`).
- Les voix par scénario sont définies dans `src/data/pack-demo-scenarios.ts` (`voices`).
