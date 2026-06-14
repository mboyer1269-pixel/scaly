# Scaly — Réceptionniste vocale IA pour PME (FR-QC / EN)

> **North Star** : qu'aucune PME ne perde de l'argent parce qu'un appel n'a pas été répondu, mal qualifié ou mal suivi.

Scaly transforme chaque appel entrant en **donnée → opportunité → action → revenu** : réception, qualification par script d'industrie, analyse (intention, urgence, valeur, sentiment), actions automatiques (SMS, tâches, RDV, lead CRM) et cockpit de valeur (appels sauvés, pipeline, pertes évitées).

**État réel** : P0→P4 livrés en code (domaine, persistance Prisma, auth Clerk, moteur LLM, Voice Runtime Lab + pont temps réel Twilio/OpenAI, actions SMS, Stripe, mémoire inter-appels). Ce qui reste avant le **premier pilote payant** n'est plus du code mais de la **configuration + un numéro Twilio** — et c'est exactement ce que mesure le *Pilot Readiness Gate* (voir plus bas). La règle de la maison : ne jamais dire « prêt » sans preuve.

---

## Démarrage

```bash
npm install
npm run dev          # → http://localhost:3000
npm test             # tests vitest (domaine + services + garde-fous)
npm run build        # vérification de compilation complète
npm run pilot:check  # PASS/WARN/FAIL : peut-on faire un premier appel réel ?
```

Aucune variable d'environnement requise pour la **démo** (store in-memory, tout est mock honnête). Un **appel réel** exige de la configuration (`.env.example` documente chaque clé) ; le runbook exécutable est dans `docs/VOICE.md`.

## Pilot Readiness Gate — `npm run pilot:check`

Un seul script qui répond froidement aux 7 questions du premier pilote (ADR-019) : peut-on appeler aujourd'hui, qu'est-ce qui est bloquant, qu'est-ce qui est réel/configuré/repli/non vérifié, le repli humain tient-il si le realtime tombe, le tenant est-il explicite, la mémoire inter-appels peut-elle croiser des dossiers, les garde-fous existent-ils. Verdict **PASS / WARN / FAIL** (sort en 1 sur FAIL). Logique pure et testée (`tests/pilot-readiness.test.ts`), tournée aussi en CI.

> ⚠️ **PILOTE MONO-TENANT UNIQUEMENT** tant que le mapping numéro Twilio→`companyId` n'existe pas : le webhook voix résout `DEFAULT_COMPANY_ID`. Bloquant **avant un 2ᵉ client** (ADR-017/019).

## Parcours de démo (3 minutes)
1. `/` — le site public et la promesse.
2. `/dashboard` — 23 appels sur 14 jours : valeur sauvée, pipeline, urgences, insights.
3. `/calls/call_comp_belair_cur1` — l'inondation à 23 h 47 : transcript, urgence critique, appel **sauvé hors heures**, actions déclenchées avec audit trail.
4. `/simulator` — lance un appel « Urgence réelle » puis un « Spam » : regarde la qualification, l'escalade et les actions diverger.
5. `/admin` — l'économie : MRR démo, minutes, coût IA estimé, marges, santé honnête des providers (4 non configurés).

## Table de vérité actuelle

Statuts : **réel vérifié** (code + tests qui tournent) · **réel mais non configuré** (code prêt, attend une clé/un numéro) · **mock honnête** (simulé et affiché comme tel) · **simulé** · **non vérifié** (jamais exécuté en conditions réelles) · **bloquant pilote**.

| Composant | Statut | Preuve / ce qui manque |
|---|---|---|
| Domaine TS, 15 scripts d'industrie, simulateur déterministe | ✅ **réel vérifié** | `tests/` (scoring, simulator, voice-*) verts en CI |
| Call Intelligence `rules-v1` (heuristique) | ✅ **réel vérifié** | déterministe ; golden set `tests/golden-set.test.ts` |
| Call Intelligence `LlmIntelligenceEngine` | 🟡 **réel mais non configuré** | exige `OPENAI_API_KEY` ; mesuré 94,3 %/94,3 % (ADR-012) |
| Persistance Prisma / Postgres | 🟡 **réel mais non configuré** | par défaut in-memory ; `STORE_PROVIDER=prisma` + `DATABASE_URL`, prouvé par `/status?live=1` |
| Auth Clerk + RBAC founder/owner/staff | 🟡 **réel mais non configuré** | actif dès que les 2 clés Clerk sont posées (ADR-013) |
| Voice Runtime Lab (P2A) — cerveau 12 états | ✅ **réel vérifié** | 6 scénarios golden en CI + rejoués dans `/status` |
| Transport voix réel (Twilio Media Streams ↔ OpenAI Realtime, P2B) | 🟡 **réel mais non configuré** | code complet ; exige numéro Twilio + ngrok + `OPENAI_API_KEY` (runbook `docs/VOICE.md`) |
| Repli humain `<Dial>` si realtime absent | ✅ **réel vérifié** | `tests/twilio.test.ts` ; le téléphone ne casse jamais |
| Mémoire inter-appels (dossier par numéro) | ✅ **réel vérifié** | `tests/caller-memory.test.ts` : numéro masqué + anti-croisement tenant inclus |
| Action Engine — planification | ✅ **réel vérifié** | `tests/action-engine.test.ts` |
| Actions réelles (rescue SMS, pouls texto, suivi J+2) | 🟡 **réel mais non configuré** | exige Twilio Messaging + `CRON_SECRET` (P3) |
| Coffre de consentements (Loi 96 / Loi 25) | ✅ **réel vérifié** | `tests/consent.test.ts` ; révocation SMS prime (ADR-018) |
| Pricing public | ✅ **réel vérifié** | `/pricing` ; plans du domaine |
| Stripe (abonnements) | 🟡 **réel mais non configuré** | exige `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (P4) |
| **Mapping Twilio numéro→companyId (multi-tenant voix)** | 🔴 **bloquant pilote** (avant 2ᵉ client) | absent : webhook résout `DEFAULT_COMPANY_ID` (ADR-017/019) |
| Données seed (53 appels, 6 compagnies) | 🟢 **mock honnête / simulé** | générées par le simulateur, seeds fixes |
| Latences vocales P2A | 🟢 **simulé** | marquées `simulated:true` partout ; le réel se mesure au 1ᵉʳ appel (P2B) |
| Observabilité (Sentry, logs structurés), déploiement Vercel+Neon en ligne | ⏳ **non vérifié** | comptes/déploiement requis (ROADMAP P1) |

## Vérification de ce build
- ✅ **Exécuté** : `npm run typecheck`, `npm test` (tous verts), `npm run build`, `npm run pilot:check` — résultats dans la PR.
- ⏳ **Non vérifié faute d'environnement** : tout ce qui exige un secret/numéro réel (appel Twilio bout-en-bout, latences réelles, aller-retour Postgres live). Le `pilot:check` les liste honnêtement plutôt que de les déclarer prêts.

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
**Premier appel réel (pilote mono-tenant).** Le code est là ; il reste de la configuration. Ordre exact :
1. `npm run pilot:check` → régler les FAIL, lire les WARN.
2. Suivre la checklist exécutable de `docs/VOICE.md` (numéro Twilio, ngrok, secrets, repli `<Dial>`, tests FR-QC/EN/urgence/humain/mémoire).
3. Avant un **2ᵉ client** : implémenter le mapping numéro Twilio→`companyId` (lever le seul bloquant pilote). Détail : `ROADMAP.md`, `docs/DECISIONS.md` (ADR-017/019).
