# Registre des décisions (ADR) — Scaly

Chaque décision structurante est tracée ici. Format : contexte → décision → conséquences.

## ADR-001 — Monolithe modulaire Next.js (pas de microservices en P0)
**Contexte.** Solo founder, vitesse de démonstration critique, périmètre encore mouvant.
**Décision.** Next.js 14 (App Router) + TypeScript strict : UI, API et services dans un seul déployable, découpé en couches strictes (`domain` → `services` → `adapters` → `app`).
**Conséquences.** + Vitesse, un seul déploiement, refactos faciles. − Le temps réel vocal devra vivre dans un service séparé (prévu, voir ADR-005). Les frontières de modules d'aujourd'hui sont les frontières de services de demain.
**Alternatives rejetées.** Microservices d'emblée (complexité sans clients) ; SPA + backend séparé (deux déploiements à maintenir pour zéro gain en P0).

## ADR-002 — Persistance in-memory seedée + schéma Prisma préparé
**Contexte.** La valeur démontrable est dans le flux appel → intelligence → action, pas dans la base.
**Décision.** Store in-memory derrière l'interface `ScalyRepository` ; `prisma/schema.prisma` prêt pour Postgres (P1).
**Conséquences.** + Zéro friction de setup, démo instantanée, seeds déterministes. − Les données ne survivent pas au redémarrage (affiché honnêtement dans l'UI). Migration = remplacer une classe.

## ADR-003 — Moteur d'analyse rules-v1 avant LLM
**Contexte.** Un LLM dans la boucle aurait rendu la démo non déterministe, lente, coûteuse et difficile à tester.
**Décision.** Heuristiques déterministes (mots-clés du script + persona) derrière l'interface `IntelligenceEngine`. Le moteur LLM (P1) implémentera la même interface.
**Conséquences.** + Tests reproductibles, démo stable, structures de sortie déjà figées (le contrat de données ne changera pas). − La qualité d'analyse réelle reste à prouver en P1 ; le badge « rules-v1 » est affiché partout par honnêteté.

## ADR-004 — Le simulateur est un produit, pas un jouet
**Contexte.** Il faut valider scripts, escalades et actions AVANT de payer de la téléphonie.
**Décision.** Simulateur déterministe (seed) = banc d'essai officiel + générateur des données seed (dogfooding).
**Conséquences.** + Chaque bug du simulateur est un bug du produit (donc trouvé tôt). + Outil de vente (démo en direct). − Les conversations restent templatées tant que le LLM n'est pas branché.

## ADR-005 — Pas d'AWS Lambda pour le temps réel vocal
**Contexte.** Le flux audio temps réel exige une connexion WebSocket longue durée et < 800 ms de latence bout-en-bout ; Lambda est inadapté (durée max, cold starts, pas de WS long-lived natif).
**Décision.** Service temps réel dédié Node long-lived (Fly.io/Railway/ECS) pour Twilio Media Streams ↔ IA. Lambda (ou équivalent) réservé à l'asynchrone : actions, webhooks, résumés, rapports.
**Conséquences.** Voir docs/VOICE.md pour la topologie complète.

## ADR-006 — Exécuteurs d'actions mockés mais architecture réelle
**Contexte.** Brancher de vraies intégrations avant d'avoir des abstractions propres = dette immédiate.
**Décision.** Interface `ActionExecutor` ; les mocks journalisent le payload exact dans l'audit trail ; le chemin `requires_config` échoue explicitement au lieu de simuler un succès.
**Conséquences.** + L'Action Engine, l'UI et les tests ne changeront pas quand les exécuteurs réels arriveront. + Honnêteté vérifiable dans chaque audit trail.

## ADR-007 — Transcript & intelligence en Json dans Postgres (P1)
**Décision.** Démarrer en Json (vitesse), extraire en colonnes quand les requêtes analytiques le demanderont.
**Conséquences.** + P1 rapide. − Requêtes analytiques limitées au début (acceptable : agrégats calculés côté service).

## ADR-008 — FR-QC d'abord, bilingue par conception
**Décision.** UI et scripts français québécois ; bascule EN gérée au niveau du domaine (`lang` par tour de parole, variantes EN des questions clés). Scripts EN complets en P1.
**Conséquences.** + Niche mal servie par les solutions US. − Le contenu EN des scripts reste partiel (documenté).

## ADR-009 — Pas d'authentification en P0
**Contexte.** Aucune donnée réelle ; ajouter l'auth maintenant ralentit la boucle de démonstration.
**Décision.** Auth (Clerk ou NextAuth + RBAC owner/admin) bloquante avant TOUT déploiement public ou donnée client réelle (P1).
**Conséquences.** Le cockpit admin est accessible sans contrôle en local — assumé et documenté. Interdit de déployer tel quel.

## ADR-010 — Barèmes de valeur = hypothèses internes affichées comme telles
**Contexte.** Règle absolue de vérité : pas de données de marché inventées.
**Décision.** `valueBaselineCad` par industrie est une hypothèse de travail, étiquetée dans l'UI et recalibrée par client réel.
**Conséquences.** La « valeur sauvée » est une estimation défendable, jamais présentée comme une mesure.

## ADR-011 — Repository asynchrone + PrismaStore derrière STORE_PROVIDER
**Contexte.** Le store in-memory (ADR-002) devait céder la place à Postgres sans réécrire l'app ; Prisma est intrinsèquement async.
**Décision.** `ScalyRepository` passe en Promesses ; deux implémentations substituables (`InMemoryStore`, `PrismaStore`) sélectionnées par `STORE_PROVIDER=memory|prisma`. `executeAction()` mute en place : toute route d'exécution DOIT appeler `store.saveAction(result)`.
**Conséquences.** + Swap de base = une variable d'env. + `/status?live=1` prouve l'aller-retour réel (écriture + relecture + suppression d'une sentinelle) avant d'afficher « Réel (vérifié) ». − RÈGLE DURE (incident du 2026-06-10 : un test de purge a vidé les transcripts du Postgres de dev, car `@prisma/client` charge `.env` à l'import) : les tests n'utilisent JAMAIS `getStore()` — ils instancient `new InMemoryStore()` directement.

## ADR-012 — Golden set annoté à la main + moteur LLM évalué avant adoption
**Contexte.** Critère P1 : analyse LLM ≥ 90 % d'accord intention ET urgence vs annotations humaines.
**Décision.** Les 53 appels seed sont annotés à l'aveugle (sans regarder les sorties rules-v1) dans `src/data/golden-set.ts`, ancrés par identité de génération stable. `LlmIntelligenceEngine` (OpenAI, sortie structurée stricte, temperature 0) analyse le transcript BRUT — aucun hint de génération. Le LLM classifie ; valeur et score commercial sont recalculés par le MÊME barème déterministe que rules-v1. Le `primaryIntent` du script est fourni au prompt (même config produit que rules-v1 consomme).
**Conséquences.** Mesuré le 2026-06-10 (gpt-4o-mini) : rules-v1 = 94,3 % intention / 90,6 % urgence ; LLM = 94,3 % / 94,3 % — critère atteint. Harnais : `npm run eval:golden [-- --engine=llm]` ; plancher rules-v1 verrouillé en CI. 6 désaccords résiduels documentés — pas d'itération de prompt supplémentaire (anti sur-ajustement).

## ADR-013 — Auth Clerk derrière un feature flag + purge Loi 25
**Contexte.** ADR-009 rendait l'auth bloquante avant tout déploiement public ; la Loi 25 limite la rétention des verbatims.
**Décision.** Clerk v5 actif seulement si les DEUX clés sont présentes (sinon app ouverte en dev, affiché honnêtement). RBAC : `publicMetadata.role` = founder|owner|staff via le session token ; `/admin`, `/api/admin` et `/status` réservés à founder. Purge : `purgeExpiredTranscripts()` vide le verbatim après `compliance.retentionDays` en conservant l'intelligence agrégée ; déclencheurs `npm run db:purge` ou `/api/cron/purge` protégé par `CRON_SECRET`.
**Conséquences.** + Déploiement public débloqué dès que les clés Clerk sont posées. + Le rattachement tenant↔session est porté par `publicMetadata.companyId`; un non-founder authentifié sans tenant est bloqué sur les routes sensibles plutôt que redirigé silencieusement vers la démo.

## ADR-014 — Voice Runtime Lab d'abord, transport audio ensuite (P2A/P2B)
**Contexte.** P2 (« la voix réelle ») mélange deux problèmes différents : le CERVEAU conversationnel (machine à états, extraction progressive, bilinguisme FR-QC/EN, barge-in, escalades) et le TRANSPORT audio (Twilio Media Streams, STT/TTS, OpenAI Realtime). Brancher le téléphone avant d'avoir un cerveau testable = déboguer les deux en même temps, au prix fort (chaque itération = un appel réel).
**Décision.** Scinder P2. **P2A** = `VoiceRuntimeCore`, réducteur PUR et DÉTERMINISTE `(session, tour appelant) → session` sans IO (src/services/voice-runtime.ts) : NLU à règles (voice-extraction), détection de langue par tour (voice-language), flight recorder intégré (chaque décision/transition/conflit = un `VoiceRuntimeEvent` appendu), latences SIMULÉES marquées `simulated:true`, 6 scénarios golden verrouillés en CI (tests/voice-scenarios.test.ts) et rejoués en direct dans /status. **P2B** = transport réel derrière les MÊMES contrats : le STT remplit `VoiceTurn`, les vraies mesures remplacent les latences simulées, un cerveau LLM peut produire les mêmes `VoiceFieldExtraction` que le NLU à règles.
**Conséquences.** + Chaque comportement conversationnel (urgence fast-track, conflit de champs, demande d'humain, switch de langue, barge-in, appel bruité) est testé en millisecondes, gratuitement, AVANT le premier appel téléphonique. + Boucle de valeur complète dès P2A : session → Call analysé par le même IntelligenceEngine/ActionEngine (voice-convert). + `VoiceSession` persistée suit la Loi 25 (turns/events purgeables, fields/telemetry conservés). − Les latences affichées restent des hypothèses tant que P2B n'a pas mesuré le réel — étiquetées « simulé » partout.

## ADR-015 — Agent de relance « conforme par conception » (périmètre CRTC)
**Contexte.** La relance sortante (« speed to lead », suivi de soumission, rappels saisonniers) devient un standard chez les joueurs US et est absente de l'offre QC (docs/MARKET.md). Mais au Canada, un message de SOLLICITATION enregistré/synthétisé (règles CMA du CRTC) exige un consentement exprès préalable — la relation d'affaires existante n'exempte que de la LNNTE, pas des règles CMA.
**Décision.** Trois paliers, par ROI décroissant et risque croissant : (1) rappel d'appel manqué/abandonné < 2 min — réponse à la demande du client, pas de sollicitation — P3 priorité 1 ; (2) suivi de soumission J+2 avec consentement exprès CAPTÉ PENDANT l'appel entrant, verbatim horodaté dans le flight recorder — P3 ; (3) réactivation saisonnière = sollicitation, opt-in exprès seulement — P5. Dès P2B, le prompt de l'agente pose la question du consentement au rappel et la fiche porte le champ. Heures CRTC respectées (9 h-21 h 30 sem., 10 h-18 h f.d.s.), identification + numéro de rappel obligatoires.
**Conséquences.** + Différenciateur vendable : « relance conforme par conception », consentement consultable par appel. + Le périmètre légal est tranché AVANT d'écrire le composeur. − Le palier 3 (le plus « growth ») attend un vrai mécanisme d'opt-in.

## ADR-016 — RLS Postgres différé au multi-tenant réel ; durcissement P4 proportionné
**Contexte.** P4 liste « RLS Postgres ». Le tenant est maintenant explicite côté application (claims Clerk pour les sessions, numéro Twilio appelé pour voix/SMS), mais Prisma utilise encore une connexion applicative unique avec droits larges.
**Décision.** RLS reste différé jusqu'au premier multi-tenant payant : il sera activé avec politiques par companyId + rôle applicatif non-propriétaire de schéma + `SET LOCAL app.current_company` injecté par un client Prisma étendu. En attendant, le durcissement proportionné est applicatif : rate limiting fenêtre glissante, secrets vérifiés sur webhooks/crons, blocage du fallback tenant dangereux, mapping Twilio unique et tests anti-IDOR.
**Conséquences.** + Pas de fausse assurance : l'isolation actuelle est applicative et testée, pas une garantie RLS. − Avant self-serve multi-client, ajouter RLS devient la prochaine défense en profondeur prioritaire.

## ADR-017 — Résolution de tenant par session (resolveCompany) + mapping Clerk
**Contexte.** DEFAULT_COMPANY_ID était câblé en dur dans ~20 routes et pages : impossible d''accueillir un deuxième client, d''activer RLS (ADR-016) ou de router les textos par entreprise sans réécriture diffuse.
**Décision.** Toute route/page DE SESSION résout son tenant via `src/server/tenant.ts` : `resolveCompanyId()` lit le claim `metadata.companyId` du session token Clerk (même mécanisme que le rôle, ADR-013 — poser `publicMetadata.companyId` sur l''utilisateur dans Clerk). Les routes sensibles utilisent `requireTenant()` pour bloquer le cas dangereux auth active + non-founder sans companyId. Les canaux SANS session ne passent jamais par là : Twilio voix/SMS résout désormais le tenant par le numéro appelé (`To`/`Called` → `Company.twilioPhoneNumber`), Stripe porte son tenant via metadata/client_reference_id, les crons itèrent toutes les compagnies.
**Conséquences.** + Le multi-tenant devient une configuration (claim Clerk + numéro Twilio unique), plus une réécriture. + Les fuites cross-tenant par IDOR sont fermées AVANT d''avoir deux clients. − Le tenant démo reste volontairement disponible hors auth pour la démo locale; l'onboarding self-serve devra le remplacer par une création explicite de company.

## ADR-018 — Coffre de consentements : par personne, opposable, révocable
**Contexte.** ADR-015 capte le consentement de rappel verbatim PENDANT l''appel, mais il vivait par APPEL (collectedFields) : non interrogeable par personne, aucune preuve centralisée, et surtout AUCUN chemin de retrait — un client qui texte « STOP » recevait une réponse générique pendant que le J+2 restait planifiable. La Loi 25 exige un retrait aussi simple que le consentement ; le palier 3 d''ADR-015 (réactivation saisonnière, la relance la plus « growth ») restait bloqué faute de registre d''opt-in vérifiable.
**Décision.** Le consentement devient un objet de première classe (`ConsentRecord`) par numéro canonique : verbatim exact, canal, appel source, horodatage, statut actif/refusé/révoqué. Alimenté par /api/voice/complete (appels réels) et le simulateur (démo sur la même mécanique). Révocation : « STOP / ARRÊT / unsubscribe… » par SMS de N''IMPORTE QUEL expéditeur révoque tout immédiatement (avant même le filtre propriétaire), confirmation bilingue, audit. RÈGLE DURE : une révocation l''emporte sur tout — même un consentement plus récent ne ressuscite pas la relance automatique ; seule une nouvelle captation humaine/agente en appel rouvre. Le refus est enregistré au même titre que le oui. Registre visible dans /consents (la PME peut le montrer tel quel). `planQuoteFollowUps` reçoit les numéros révoqués et les exclut sans exception.
**Conséquences.** + Trou légal fermé AVANT le premier client. + Le palier 3 (réactivation saisonnière) devient possible : il lira le même coffre (kind `reactivation`, opt-in exprès). + Argument de vente : « relance conforme par conception » passe de promesse à registre montrable. − La révocation SMS couvre le canal texto ; la révocation verbale en appel (« arrêtez de m''appeler ») devra être captée par l''agente comme refus — ajout au prompt à faire avec les 50 appels tests.

## ADR-019 — Pilot Readiness Gate + repli de tenant jamais silencieux
**Contexte.** Le repo a dépassé P0 : Prisma, Clerk, moteur LLM, Voice Lab, pont temps réel, actions SMS, Stripe et mémoire inter-appels existent. Le risque n'est plus l'absence de features mais la DÉRIVE entre ce que le code fait et ce que docs/README/ROADMAP/`/status` affirment — et l'absence d'une réponse vérifiable à « peut-on faire un premier appel réel aujourd'hui, et qu'est-ce qui est bloquant ? ».
**Décision.** (1) **Pilot Readiness Gate** : `evaluatePilotReadiness()` PUR et testé (`src/services/pilot-readiness.ts` + `tests/pilot-readiness.test.ts`), exposé par `npm run pilot:check` (CLI `scripts/pilot-check.ts`) et joué en CI. Verdict PASS/WARN/FAIL sur : auth, cohérence `STORE_PROVIDER`/`DATABASE_URL` + aller-retour Prisma live, `REALTIME_SHARED_SECRET` en prod, `TWILIO_AUTH_TOKEN` si webhook public, transport realtime + repli `<Dial>`, `OPENAI_API_KEY`, résolution de tenant Twilio/session, commandes CI, tests garde-fous, purge Loi 25. FAIL → code de sortie 1 ; WARN → code de sortie 0 avec limites explicites. (2) **Repli de tenant jamais silencieux** : `decideTenant()` reste pur et `requireTenant()` bloque les routes sensibles pour un non-founder authentifié sans companyId. (3) **Mapping Twilio livré** : voix et SMS refusent un numéro appelé absent/non mappé/ambigu au lieu de choisir un tenant arbitraire. (4) **Mémoire inter-appels** : `selectCallerHistory()` pur ferme les deux fuites (numéro masqué → aucune mémoire ; anti-croisement de tenant) et est testé.
**Conséquences.** + Une seule commande répond aux 7 questions du pilote, sans complaisance, et la CI empêche la régression du contrat. + La posture n'est plus mono-tenant par contrainte technique de webhook; elle dépend maintenant de la configuration réelle des numéros et claims. − Le gate lit la configuration, pas le comportement réseau réel : un appel Twilio bout-en-bout et les latences réelles restent à vérifier à la main avant de parler de voix IA vérifiée.

## ADR-021 — Agent Operating Backend v1 : l'agent est un contrat, pas du code
**Contexte.** La séquence stratégique exigeait une troisième preuve : après « Maude récupère de l'argent » (Revenue Recovery OS) et « Maude n'est pas un silo » (Event Boundary, ADR-020), il fallait prouver que Maude n'est que le PREMIER agent d'une plateforme — que le backend peut faire naître, opérer et mesurer d'autres agents. Le risque inverse : un framework prématuré (LangGraph, bus d'événements) qui alourdit sans prouver.
**Décision.** (1) **AgentDefinition** (src/domain/agent-definition.ts) : un agent est un contrat 100 % déclaratif — persona, canaux, capabilities, contextNeeds (avec futureOwner scaly/oria/memex), actionTargets tracées, roiMetrics avec méthode et base explicites, safetyRules, runtimeAdapters, backendBindings obligatoires (ContextPackProvider, ActionLedgerPort, RuntimeEventOutbox). `validateAgentDefinition` (src/data/agent-definitions.ts) jette sur capability inconnue, ROI magique, action fantôme ou ports absents. Allô Maude est la première définition validée (`ALLO_MAUDE_AGENT`, status live). (2) **Registre de capabilities étendu** à 8 (gap recovery, owner notification, opportunity detection, roi reporting, consent capture, human handoff, missed call rescue, quote follow-up) — chaque définition référence un moteur RÉEL de src/services et déclare ses `runtimeEvents` typés contre RUNTIME_EVENT_TYPES. (3) **resolveAgentRuntimePlan(def, company, facts)** (src/services/agent-runtime-plan.ts), fonction PURE façon ADR-019 : capabilities activées/désactivées avec raison, contexte requis, événements émis, configuration manquante, score 0–100, verdict operational/degraded/not_ready. (4) **draftAgentDefinitionFromPrompt** (src/services/agent-draft.ts) : mapper DÉTERMINISTE (3 verticales + repli PME, PAS un LLM — assumé) qui prouve « prompt → agent structuré » ; le futur LLM devra produire la même structure et passer la même validation. (5) **/agent-os** : console fondateur (founder-only) qui montre la définition de Maude, son plan runtime résolu en direct et les 3 drafts. Doc de référence : docs/AGENT_OPERATING_BACKEND.md.
**Conséquences.** + La thèse plateforme devient montrable en 30 secondes, avec du code réel derrière chaque case. + Les anti-patterns (mémoire business locale, logique métier dans l'agent, action non tracée, ROI magique, prompt sans contrat) sont bloqués par des erreurs typées, pas par la discipline. − Le drafter est déterministe et l'ActionLedgerPort reste no-op : la naissance d'agents par LLM, la persistance des définitions et le dispatcher Oria sont la suite explicite, pas des promesses cachées.
