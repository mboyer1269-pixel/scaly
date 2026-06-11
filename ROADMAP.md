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
**P2B — Transport réel 🔧 (code complet, appel réel en attente d'un numéro)** : webhook Twilio signé + repli `<Dial>` (le téléphone ne casse jamais), pont scaly-realtime (Media Streams ↔ OpenAI Realtime, µ-law passthrough, barge-in, transfert humain par outil, latences RÉELLES mesurées par tour), prompt système testé (divulgation IA, consentement de rappel ADR-015), fin d'appel → Call `source:"live"` analysé par le moteur existant. Vérifié : compte Twilio actif, pont configuré. **Restants** : numéro Twilio + ngrok (runbook docs/VOICE.md), puis jalons (4) 50 appels tests FR/EN dont urgences et (5) latence perçue < 800 ms p50 / < 1200 ms p95 — MESURÉE.
Conformité bloquante : avis juridique Loi 25, DPA fournisseurs, RPRP, politique de confidentialité.
**KPI** : taux de complétion d'appel test > 90 %, transfert humain fonctionne à 100 %. **Coût estimé** : 50-150 $/mois infra + coûts API par appel.
**Risques** : latence FR-QC des modèles temps réel (mitigation : plan B pipeline) ; accent québécois en STT (mitigation : jeu de test dédié, choix STT par benchmark).

## P3 — Les actions réelles (≈ 2-4 semaines, en parallèle des premiers pilotes)
**Livré (code complet, activation = clés Twilio Messaging + CRON_SECRET)** :
**P3.1 — Rescue actif ✅** : `executeActionLive` — SMS Twilio RÉEL (audit + SID) quand configuré, mock honnête sinon ; garde d'heures CRTC (`respectContactHours`) pour les envois planifiés, jamais pour les urgences propriétaire.
**P3.2 — Pouls texto ✅** : `/api/cron/digest` (CRON_SECRET, à céduler vers `followUp.dailyDigestHour`) construit le pouls du jour (chauds, mécontents, sauvés, $ protégés) et l'envoie au `transferPhone` ; `/api/sms/incoming` (signature Twilio vérifiée) répond aux mots-clés CHAUDS / MÉCONTENTS / À SAUVER / RÉSUMÉ / AIDE — seul le numéro du propriétaire reçoit des données.
**P3.3 — Suivi J+2 ✅** : `planQuoteFollowUps` pur — relance UNIQUEMENT si consentement capté pendant l'appel (ADR-015 palier 2), idempotent par appel, planifié par le même cron.
**P3.4 — Onboarding magique ✅** : URL + 2 phrases → `/api/onboarding/draft` (LLM structured output strict, jamais de service inventé) → brouillon ÉDITABLE dans `/onboarding` → `/api/onboarding/apply` refuse sans `approved:true`, applique entreprise + agent + script d'industrie, trace « brouillon_approuvé » dans l'audit.
Ordre d'impact : 1) SMS Twilio + **rappel vocal d'appel manqué < 2 min** (ROI le plus visible — ADR-015, palier 1) ; 2) **pouls quotidien par TEXTO au propriétaire** (X chauds, Y mécontents, Z sauvés + $ protégés, liens vers les fiches — heure déjà configurable via `followUp.dailyDigestHour` ; même tuyau Twilio que le 1) ; 3) **répondre au texto = parler à sa réceptionniste** — v1 mots-clés déterministes (CHAUDS, MÉCONTENTS, RÉSUMÉ, AIDE), v2 conversationnel LLM sur les données du store ; 4) Google Calendar (RDV) ; 5) **suivi de soumission J+2** (consentement capté pendant l'appel entrant, ADR-015 palier 2) ; 6) **onboarding magique** : la PME colle l'URL de son site + 2 phrases → brouillon de persona/services/heures/zones généré par LLM, ÉDITABLE et jamais actif sans approbation explicite du propriétaire ; 7) webhooks signés ; 8) HubSpot/Pipedrive.
Infra : file d'attente pg-boss + workers ; idempotence par action.id ; retries exponentiels ; `requires_config` → écran de connexion OAuth par intégration.
**KPI** : 3-5 PME pilotes payantes ; > 95 % d'actions réussies ; temps de rappel d'appel manqué < 2 min.

## P4 — Monétisation & durcissement (≈ 2-3 semaines)
**Livré** :
**P4.1 — Pricing public honnête ✅** : `/pricing` — plans de domain/billing publiés (mensuel CAD, minutes incluses, dépassement affiché, frais d'installation), engagements anti-irritants (spam non facturé, transferts humains inclus, arrondi mensuel pas par appel).
**P4.2 — Stripe ✅ (activation = STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET)** : checkout abonnement à prix inline (aucun produit à créer dans le dashboard Stripe), webhook signé (HMAC vérifié, rejeu refusé) seul autorisé à écrire `company.billing` + `planId`, portail client dans /settings, audit « stripe » sur chaque mouvement. **Minutes excédentaires : PAS de metered billing en pilote — facturation manuelle au tarif publié** (décision assumée, à automatiser quand le volume le justifie).
**Restants P4** : alertes de dépassement, rate limiting, RLS Postgres, pentest léger, SLA internes, runbooks.
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
