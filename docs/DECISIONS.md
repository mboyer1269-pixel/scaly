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
**Conséquences.** + Déploiement public débloqué dès que les clés Clerk sont posées. − Le rattachement tenant↔session reste mono-tenant (DEFAULT_COMPANY_ID) : multi-tenant réel avec les premiers pilotes.

## ADR-014 — Voice Runtime Lab d'abord, transport audio ensuite (P2A/P2B)
**Contexte.** P2 (« la voix réelle ») mélange deux problèmes différents : le CERVEAU conversationnel (machine à états, extraction progressive, bilinguisme FR-QC/EN, barge-in, escalades) et le TRANSPORT audio (Twilio Media Streams, STT/TTS, OpenAI Realtime). Brancher le téléphone avant d'avoir un cerveau testable = déboguer les deux en même temps, au prix fort (chaque itération = un appel réel).
**Décision.** Scinder P2. **P2A** = `VoiceRuntimeCore`, réducteur PUR et DÉTERMINISTE `(session, tour appelant) → session` sans IO (src/services/voice-runtime.ts) : NLU à règles (voice-extraction), détection de langue par tour (voice-language), flight recorder intégré (chaque décision/transition/conflit = un `VoiceRuntimeEvent` appendu), latences SIMULÉES marquées `simulated:true`, 6 scénarios golden verrouillés en CI (tests/voice-scenarios.test.ts) et rejoués en direct dans /status. **P2B** = transport réel derrière les MÊMES contrats : le STT remplit `VoiceTurn`, les vraies mesures remplacent les latences simulées, un cerveau LLM peut produire les mêmes `VoiceFieldExtraction` que le NLU à règles.
**Conséquences.** + Chaque comportement conversationnel (urgence fast-track, conflit de champs, demande d'humain, switch de langue, barge-in, appel bruité) est testé en millisecondes, gratuitement, AVANT le premier appel téléphonique. + Boucle de valeur complète dès P2A : session → Call analysé par le même IntelligenceEngine/ActionEngine (voice-convert). + `VoiceSession` persistée suit la Loi 25 (turns/events purgeables, fields/telemetry conservés). − Les latences affichées restent des hypothèses tant que P2B n'a pas mesuré le réel — étiquetées « simulé » partout.
