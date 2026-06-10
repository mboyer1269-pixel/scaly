# Scaly — Réceptionniste vocale IA pour PME (FR-QC / EN)

> **North Star** : qu'aucune PME ne perde de l'argent parce qu'un appel n'a pas été répondu, mal qualifié ou mal suivi.

Scaly transforme chaque appel entrant en **donnée → opportunité → action → revenu** : réception, qualification par script d'industrie, analyse (intention, urgence, valeur, sentiment), actions automatiques (SMS, tâches, RDV, lead CRM) et cockpit de valeur (appels sauvés, pipeline, pertes évitées).

**Ce repo est la fondation P0** : une plateforme démontrable de bout en bout, honnête sur ce qui est réel et ce qui est simulé.

---

## Démarrage

```bash
npm install
npm run dev        # → http://localhost:3000
npm test           # tests vitest (domaine + services)
npm run build      # vérification de compilation complète
```

Aucune variable d'environnement requise pour la démo (tout est mock). `.env.example` documente les clés futures.

## Parcours de démo (3 minutes)
1. `/` — le site public et la promesse.
2. `/dashboard` — 23 appels sur 14 jours : valeur sauvée, pipeline, urgences, insights.
3. `/calls/call_comp_belair_cur1` — l'inondation à 23 h 47 : transcript, urgence critique, appel **sauvé hors heures**, actions déclenchées avec audit trail.
4. `/simulator` — lance un appel « Urgence réelle » puis un « Spam » : regarde la qualification, l'escalade et les actions diverger.
5. `/admin` — l'économie : MRR démo, minutes, coût IA estimé, marges, santé honnête des providers (4 non configurés).

## État réel du système — table de vérité

| Composant | Statut | Détail |
|---|---|---|
| Modèle de domaine TypeScript (10 modules) | ✅ **Réel** | `src/domain` — types stricts, zéro dépendance |
| 15 scripts d'industrie FR-QC | ✅ **Réel** | questions, urgences, transferts, objections, tags |
| Simulateur d'appel déterministe | ✅ **Réel** | même seed = même appel ; banc d'essai officiel |
| Call Intelligence | ⚠️ **Réel mais heuristique** | moteur `rules-v1` (mots-clés) — PAS un LLM ; interface prête pour le LLM (P1) |
| Action Engine + audit trail | ✅ **Réel** / 🟡 exécution **mock** | planification réelle ; exécuteurs journalisent sans envoyer |
| Données (53 appels, 6 compagnies) | 🟡 **Seed simulé + 4 appels rédigés** | générées par le simulateur, seeds fixes |
| Persistance | 🟡 **In-memory** | régénérée au redémarrage ; schéma Postgres **préparé** (`prisma/schema.prisma`) |
| API REST (9 routes) | ✅ **Réel** | calls, simulate, actions, company, agent, admin, health |
| UI (10 écrans) | ✅ **Réel** | dashboard, appels, simulateur, scripts, actions, intégrations, agent, réglages, admin, site public |
| Téléphonie / voix (Twilio, OpenAI RT, ElevenLabs, Whisper) | 🔴 **Stubs non configurés** | échouent explicitement (`NotConfiguredError`) — aucun appel réel possible |
| Intégrations (CRM, calendrier, SMS…) | 🟡 **Registre + exécuteurs mock** | architecture réelle, aucun appel réseau |
| Billing (plans, excédents, marges) | ✅ **Logique réelle** / 🔴 Stripe absent | calculs testés ; aucun paiement |
| Auth / multi-tenant UI | 🔴 **Absent** | bloquant avant tout déploiement public (ADR-009) |
| Conformité | 🟡 **Base posée** | flags par entreprise, audit trail, docs/COMPLIANCE.md ; avis juridique requis avant P2 |

## Vérification honnête de ce build
- ✅ **Vérifié par exécution** (Node, smoke test `12 groupes d'assertions`) : domaine, scripts, simulateur (déterminisme, urgences, spam, bascule EN, hors-heures), intelligence sur transcripts bruts (extraction de « $3,500 », plainte, tiède/chaud), seed complet (53 appels/110 actions), analytics, facturation, action engine (mock + `requires_config`).
- ⚠️ **Non vérifié dans cet environnement** : `npm install`, `next build` et `vitest` (registre npm bloqué par la politique réseau du sandbox de build). **Première commande à lancer localement** : `npm install && npm run build && npm test`. Risque résiduel : erreurs de typage dans les fichiers UI (.tsx).

## Structure

```
src/
  domain/        Types métier purs (company, call, action, agent, script, persona, billing, analytics, integration)
  services/      Logique : scoring, intelligence (rules-v1), simulator, action-engine, analytics
  adapters/
    voice/       Interfaces + mock fonctionnel + stubs Twilio/OpenAI-RT/ElevenLabs/Whisper + santé
    integrations/ Registre des 16 intégrations + exécuteurs d'actions (mock)
  server/        Repository + store in-memory seedé (remplaçable par Prisma — même interface)
  data/          15 scripts d'industrie, 7 personas, 6 compagnies, appels curés
  app/           Next.js App Router : site public, 9 écrans applicatifs, 9 routes API
  components/    UI partagée + clients (simulateur, formulaires)
prisma/          Schéma Postgres préparé (P1)
tests/           Vitest : scoring, simulateur, action engine, billing
docs/            ARCHITECTURE, VOICE, COMPLIANCE, DECISIONS (ADR)
ROADMAP.md       P0→P5 : jalons, KPI, coûts estimés, risques, processus, incidents
```

## API

| Route | Méthode | Rôle |
|---|---|---|
| `/api/health` | GET | État honnête (providers, compteurs, mode) |
| `/api/calls` | GET | Appels (filtres status/urgency/intent/q) |
| `/api/calls/:id` | GET | Détail + actions liées |
| `/api/simulate` | POST | Lancer un appel simulé `{ scriptId, personaId, seed? }` |
| `/api/actions` | GET | File d'actions |
| `/api/actions/:id/execute` | POST | Exécuter (mock, audité) |
| `/api/company` | GET/PUT | Configuration entreprise |
| `/api/agent` | GET/PUT | Configuration agent vocal |
| `/api/admin/overview` | GET | Cockpit fondateur |

## Prochaine étape technique
**P1 — cerveau réel + persistance** : Postgres/Prisma (interface prête), auth (bloquant), `LlmIntelligenceEngine` évalué sur le golden set des 53 appels seed. Détail : `ROADMAP.md`.
