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
