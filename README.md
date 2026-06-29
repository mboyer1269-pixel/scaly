# Allô Maude

Allô Maude est l’application commerciale. Scaly est son moteur technique de voix et d’automatisation.

Cette version fournit une première tranche verticale utilisable : préparation de l’entreprise, couverture, simulation persistée, appels, actions à suivre, éléments à corriger, audit et contrôles de préparation séparés pour la démo et les appels réels.

## Lancer l’application locale

```bash
npm install
npm run app:local
```

Ouvrir [http://127.0.0.1:3000/allo-maude](http://127.0.0.1:3000/allo-maude).

`app:local` force le repository mémoire. Les changements survivent à la navigation, mais sont réinitialisés au redémarrage. Ce mode est adapté à une démonstration locale; il n’est jamais déclaré prêt pour un aperçu commercial.

Pour changer le port :

```bash
npm run app:local -- --port 3001
```

## Parcours vertical vérifiable

1. `/prepare` — configurer la couverture et corriger les informations requises.
2. `/simulator` — lancer le scénario français « dégât d’eau critique ».
3. `/calls` — relire l’appel et sa provenance.
4. `/follow-up` — traiter les actions générées.
5. `/learn` — résoudre les champs manquants ou incertains.
6. `/dashboard` — constater l’effet sur la vue d’ensemble.
7. `/readiness/demo` — vérifier les preuves du flow.
8. `/readiness/live` — voir séparément ce qui bloque encore les appels téléphoniques réels.

La démo utilise les mêmes services, le même repository et les mêmes pages que l’application normale. Elle n’est pas un tunnel parallèle.

## Vérification

```bash
npm run typecheck
npm test
npm run build
npm run demo:check
npm run pilot:check
```

- `demo:check` vérifie le scénario vertical dans un repository mémoire et peut déclarer la démonstration locale prête.
- `pilot:check` vérifie les dépendances d’un appel réel. Il échoue sur les prérequis bloquants (Postgres requis absent, auth required sans Clerk, signature Twilio publique absente, secret pont requis absent) et garde un verdict `WARN` honnête lorsque le téléphone fonctionne seulement en repli humain.

## Modes de persistance

| Mode | Activation | Usage honnête |
|---|---|---|
| Mémoire | défaut ou `STORE_PROVIDER=memory` | Développement et démonstration locale |
| PostgreSQL | `STORE_PROVIDER=prisma` + `DATABASE_URL` | Pilote persistant après aller-retour vérifié |

Prisma et PostgreSQL utilisent la même interface de repository que la mémoire. Le schéma et les migrations sont sous `prisma/`.

## État des capacités

| Capacité | État actuel |
|---|---|
| Modèle domaine, workflow simulé, actions, révisions, audit | Vérifié par tests |
| Surfaces Allô Maude et frontière de marque | Vérifié par tests |
| Démonstration locale complète | Vérifiée par `demo:check` |
| Persistance commerciale | Prisma/Postgres, vérifiable par aller-retour live |
| Appels téléphoniques réels | Webhook Twilio signé, tenant par numéro appelé, repli humain; preuve bout-en-bout à exécuter |
| Mode mémoire | Simulation locale uniquement |

Les statuts visibles — `Vérifié`, `Configuré, non vérifié`, `Simulé`, `Indisponible` — sont dérivés de la provenance et des preuves disponibles.

## Documentation

- `docs/ARCHITECTURE.md` — architecture et repository.
- `docs/VOICE.md` — configuration voix et runbook d’appel réel.
- `docs/COMPLIANCE.md` — Loi 25, consentement et rétention.
- `docs/DECISIONS.md` — décisions d’architecture.
- `docs/LAUNCH_READINESS.md` — dernier rapport de préparation exécuté.
