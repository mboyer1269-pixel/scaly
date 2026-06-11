# Roadmap technique Scaly — du mock au standard

## Hypothèses de travail (documentées, modifiables)
- Solo founder + IA, budget infra initial < 200 $CA/mois, premiers revenus visés avant la fin de P3.
- Cloud public : Vercel (app) + Fly.io/Railway (realtime) + Neon/Supabase Postgres (région CA).
- Niche d'attaque : services à domicile / construction au Québec (la douleur « appel manqué = job perdue » y est maximale).
- Les coûts ci-dessous sont des ESTIMATIONS d'infrastructure, pas des devis.

## P0 — Fondation démontrable ✅ (ce repo)
Livré : domaine complet, 15 scripts, simulateur déterministe, intelligence rules-v1, action engine + audit, store seedé (53 appels), 10 écrans, API REST, abstractions voix/intégrations, schéma Prisma préparé, tests + smoke test.
**Critère de sortie atteint** : démo de 3 minutes qui répond à « combien d'argent Scaly me sauve ? ».

## P1 — Cerveau réel + persistance (≈ 2-3 semaines de travail focalisé)
1. ✅ Postgres + Prisma (`STORE_PROVIDER=prisma`, vérifiable via `/status?live=1`) + job de purge `retentionDays` (`db:purge` + `/api/cron/purge`). Vérifié sur Postgres local ; Neon = swap de `DATABASE_URL` (ADR-011).
2. ✅ Auth Clerk + RBAC owner/staff/founder derrière feature flag (clés présentes → auth active). Rattachement tenant ↔ session : mono-tenant assumé jusqu'aux pilotes (ADR-013).
3. ✅ `LlmIntelligenceEngine` sur transcript brut + golden set des 53 appels annotés à la main. Mesuré : LLM 94,3 % intention / 94,3 % urgence (≥ 90 % atteint) ; rules-v1 94,3 % / 90,6 % (ADR-012). `npm run eval:golden -- --engine=llm`.
4. ⏳ Simulateur LLM optionnel (conversations non templatées) — non fait, le mode seedé reste le banc d'essai.
5. ⏳ Observabilité : uptime sur /api/health ✅ ; Sentry + logs structurés — non faits (compte requis).
**KPI de phase** : analyse LLM ≥ 90 % sur golden set ✅ ; accès protégé ✅ (dès pose des clés) ; démo persistante en ligne ⏳ (déploiement Vercel + Neon restant).
**Risque principal** : dérive de scope sur l'auth multi-tenant → Clerk pris, on avance.

## P2 — La voix réelle (≈ 3-5 semaines, le vrai mur technique)
**P2A — Voice Runtime Lab ✅ (ADR-014)** : cerveau conversationnel pur et déterministe — machine à états (12 états), NLU à règles FR-QC/EN, extraction progressive (statut/confiance/evidence, conflits explicites), langue par tour + dominante, barge-in, urgence fast-track, refus spam, transfert humain non négociable, flight recorder, latences simulées (déclarées telles) sous budget. 6 scénarios golden en CI + rejoués dans `/status` ; UI `/voice-lab` ; session → Call via le même IntelligenceEngine/ActionEngine ; `VoiceSession` persistée + purge Loi 25.
**P2B — Transport réel ⏳** : suivre docs/VOICE.md étape par étape (Twilio Media Streams → scaly-realtime → OpenAI Realtime, plan B pipeline). Jalons mesurables : (1) echo audio ; (2) premier dialogue IA ; (3) agent qui suit un script avec transfert humain ; (4) 50 appels tests FR/EN dont urgences ; (5) latence perçue < 800 ms p50, < 1200 ms p95 — MESURÉE, en remplacement des latences simulées de P2A.
Conformité bloquante : avis juridique Loi 25, DPA fournisseurs, RPRP, politique de confidentialité.
**KPI** : taux de complétion d'appel test > 90 %, transfert humain fonctionne à 100 %. **Coût estimé** : 50-150 $/mois infra + coûts API par appel.
**Risques** : latence FR-QC des modèles temps réel (mitigation : plan B pipeline) ; accent québécois en STT (mitigation : jeu de test dédié, choix STT par benchmark).

## P3 — Les actions réelles (≈ 2-4 semaines, en parallèle des premiers pilotes)
Ordre d'impact : 1) SMS Twilio (rappel d'appel manqué = ROI le plus visible) ; 2) Google Calendar (RDV) ; 3) courriel résumé quotidien ; 4) webhooks signés ; 5) HubSpot/Pipedrive.
Infra : file d'attente pg-boss + workers ; idempotence par action.id ; retries exponentiels ; `requires_config` → écran de connexion OAuth par intégration.
**KPI** : 3-5 PME pilotes payantes ; > 95 % d'actions réussies ; temps de rappel d'appel manqué < 2 min.

## P4 — Monétisation & durcissement (≈ 2-3 semaines)
Stripe (abonnements + minutes excédentaires + frais d'installation — logique déjà dans domain/billing), portail client, alertes de dépassement, rate limiting, RLS Postgres, pentest léger, SLA internes, runbooks.
**KPI** : facturation automatique sans intervention ; marge brute par client visible et > 70 % (modèle interne).

## P5 — Échelle produit
Scripts EN complets, éditeur de scripts custom par client, agents multiples par compagnie (départements), benchmarks par industrie, API publique + SDK, Salesforce/Teams, programme partenaires (agences).

## Processus d'ingénierie (dès P1)
- **Revue** : PR obligatoire, CI = typecheck + vitest + build avant merge.
- **Changements** : ADR dans docs/DECISIONS.md pour toute décision structurante.
- **Rollback** : déploiements immuables Vercel (revert 1 clic) ; migrations Prisma additives d'abord ; feature flags par env var pour realtime et intégrations.
- **Tests** : domaine/services = unitaires ; golden set d'appels pour l'IA ; smoke test seedé en CI.

## Déploiement initial (P1) & incidents
Déploiement : Vercel (app) + Neon (Postgres) + Sentry. Checklist : env vars complètes, auth active, /api/health vert, seed désactivé en prod (données réelles seulement).
Incidents : sévérité 1 (appels en panne) → basculer le numéro Twilio en renvoi direct vers le client (fallback téléphonique humain TOUJOURS configuré) ; sévérité 2 (actions en échec) → file d'attente rejouable ; post-mortem écrit dans le registre pour tout sév-1.

## KPI North Star (mesurés dans le produit dès P1)
| KPI | Définition | Cible pilote |
|---|---|---|
| Valeur sauvée / client / mois | Σ valeur des appels sauvés (barème recalibré client) | > 3× le prix du plan |
| Taux d'appels sauvés | sauvés / (manqués + sauvés) | > 80 % |
| Temps de rappel d'appel manqué | appel manqué → SMS envoyé | < 2 min |
| Complétion d'appel IA | appels terminés sans abandon | > 90 % |
| Précision intention/urgence | vs golden set annoté | ≥ 90 % |
