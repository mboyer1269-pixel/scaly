# Architecture Scaly

## 1. Audit de l'existant (P0 — ce repo)

**Forces.**
- Couches strictes et testables : `domain` (types purs) → `services` (logique) → `adapters` (monde extérieur) → `app` (UI/API). Aucune dépendance inversée.
- Tous les points de friction futurs sont DÉJÀ derrière des interfaces : `ScalyRepository` (base de données), `IntelligenceEngine` (LLM), `ActionExecutor` (intégrations), providers vocaux (téléphonie/STT/TTS/dialogue).
- Déterminisme bout-en-bout (seeds) : reproductibilité des démos et des tests.
- Honnêteté systémique : chaque mock se déclare (audit trail, badges UI, `requires_config`).

**Faiblesses (assumées, datées).**
- Pas de persistance durable (in-memory) — P1.
- Pas d'authentification ni RBAC — P1, bloquant avant tout déploiement.
- Moteur d'analyse heuristique, pas LLM — P1.
- Aucun appel téléphonique réel — P2.
- Mono-tenant dans l'UI (le store est multi-compagnies, l'UI fixe le tenant démo).

**Dépendances critiques.** next, react, tailwind, lucide-react, clsx, vitest. Zéro SDK externe tant que les intégrations réelles ne sont pas branchées (surface d'attaque et de panne minimale).

## 2. Architecture cible (production)

```
                        ┌──────────────────────────────┐
  PSTN / numéro client  │  Twilio Programmable Voice   │
  ──────────────────────►  + Media Streams (WebSocket) │
                        └──────────────┬───────────────┘
                                       │ audio temps réel
                        ┌──────────────▼───────────────┐
                        │  scaly-realtime (Node, WS)   │  ← service long-lived
                        │  Fly.io / Railway / ECS      │     JAMAIS Lambda
                        │  barge-in · latence < 800 ms │
                        │  OpenAI Realtime OU          │
                        │  Whisper→LLM→ElevenLabs      │
                        └───────┬──────────────┬───────┘
                                │ événements   │ fallback transfert humain
                                ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│                    scaly-app (Next.js, Vercel)              │
│  UI (dashboard, simulateur, configs, admin)                 │
│  API (REST) · Call Intelligence · Action Engine · Billing   │
└──────┬──────────────────┬──────────────────┬────────────────┘
       │                  │                  │
┌──────▼──────┐   ┌───────▼────────┐  ┌──────▼─────────────────┐
│ Postgres    │   │ File d'attente │  │ Workers asynchrones    │
│ (Neon, CA)  │   │ (pg-boss P1 →  │  │ (actions, webhooks,    │
│ + Prisma    │   │  SQS/Upstash)  │  │  résumés, rapports)    │
└─────────────┘   └────────────────┘  │  ← ici Lambda est OK   │
                                      └──────┬─────────────────┘
                                             ▼
                          Twilio SMS · Google Calendar · CRM ·
                          Gmail/Outlook · Stripe · Slack · webhooks
```

**Composants clés.** scaly-app (Next.js) ; scaly-realtime (service WS dédié, P2) ; Postgres managé région Canada (résidence des données, Loi 25) ; file d'attente pour les actions (at-least-once + idempotence par `action.id`) ; workers asynchrones ; observabilité (Sentry + logs structurés + traces par `callId`).

## 3. Choix technologiques et justification

| Choix | Pourquoi | Risque accepté |
|---|---|---|
| Next.js 14 + TS strict | Un seul déployable, App Router mûr, recrutement facile | Couplage UI/API (atténué par les couches) |
| Tailwind | Vitesse UI, zéro CSS mort | — |
| In-memory → Prisma/Postgres | Démo immédiate, contrat de schéma déjà écrit | Données volatiles en P0 (affiché) |
| Twilio (P2) | Standard de facto, numéros CA, Media Streams, transfert | Coût/min ; vendor lock-in atténué par `TelephonyProvider` |
| OpenAI Realtime (P2, plan A) | Latence et naturel ; FR correct | Coût ; plan B = pipeline Whisper→LLM→ElevenLabs derrière la même interface |
| ElevenLabs (P2) | Meilleures voix FR-QC du marché actuel | Coût/caractère |
| Vercel + Fly.io/Railway | Déploiement trivial, WS long-lived là où il faut | Multi-fournisseur (acceptable) |
| pg-boss puis SQS | File d'attente sans nouvelle infra en P1 | Migration queue en P4 si volume |

## 4. Sécurité & scalabilité (résumé)

- **Tenancy** : toute requête passe par `companyId` ; en P1, contrainte par session auth + RLS Postgres en défense en profondeur.
- **Secrets** : uniquement env vars (`.env.example` documenté, jamais de secret commité).
- **Audit** : `AuditLog` (config) + audit trail par action — déjà en place.
- **Montée en charge** : l'app est stateless une fois Postgres branché (P1) → scale horizontal trivial ; le service realtime scale par nombre d'appels simultanés (≈ 1 vCPU / 20-30 appels, à mesurer en P2).
- **Observabilité (P1)** : Sentry, logs JSON structurés (`callId`, `companyId`, `actionId`), uptime check sur `/api/health`.

## 5. Trajectoire microservices (si/quand nécessaire)

Les modules actuels sont les futurs services : `services/intelligence` → service d'analyse ; `services/action-engine` + executors → service d'orchestration ; `adapters/voice` → scaly-realtime. **Critère de découpe** : on extrait un service quand son scaling ou son rythme de déploiement diverge, pas avant.
