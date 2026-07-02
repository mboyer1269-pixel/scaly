# Plan de match Phase 4 — Revenue Voice OS

Date : 2026-07-01  
Statut : plan d'execution, pas une declaration de livraison.

## Objectif

Amener Allo Maude de la base actuelle vers une plateforme "Revenue Voice OS" sans casser les surfaces deja livrees : voix Twilio, fallback humain, tenants, billing, readiness et mobile.

Phase 4 doit ajouter progressivement :

- LiveKit comme backbone voix/agent/SIP cible;
- LangGraph comme orchestration agentique durable;
- LiteLLM comme gateway couts/routage/budgets;
- auth mobile native pour iOS/Android commercial;
- RAG / business brain pour les connaissances client;
- observabilite couts/traces/provenance pour chaque appel et action.

## Sources de verite

Ce plan ne suppose pas que ces briques sont deja integrees. Au 2026-07-01, le repo contient surtout :

- `realtime/server.ts` : pont Twilio Media Streams vers OpenAI Realtime;
- `realtime/relay-server.ts` : prototype ConversationRelay derriere feature flag;
- `src/server/tenant.ts` et `src/server/twilio-tenant.ts` : resolution tenant par session ou numero appele;
- `src/services/follow-up.ts` et `src/app/api/cron/digest/route.ts` : suivis J+2 avec consentement et révocation;
- `apps/mobile/` : app Expo pilote avec bearer partage, pas encore auth native commerciale;
- `prisma/schema.prisma` : appels, actions, sessions voix, usage, readiness, review items.

Sources officielles consultees :

- [LiveKit Agents](https://docs.livekit.io/agents/) et [LiveKit SIP](https://docs.livekit.io/sip/)
- [LangGraph JavaScript](https://docs.langchain.com/oss/javascript/langgraph/overview)
- [LiteLLM spend tracking](https://docs.litellm.ai/docs/proxy/cost_tracking), [budgets](https://docs.litellm.ai/docs/proxy/users) et [budget routing](https://docs.litellm.ai/docs/proxy/provider_budget_routing)
- [Clerk Expo](https://clerk.com/docs/expo/getting-started/quickstart) et [Clerk Expo SDK](https://clerk.com/docs/reference/expo/overview)
- [Expo Router auth](https://docs.expo.dev/router/advanced/authentication/) et [EAS Submit](https://docs.expo.dev/deploy/submit-to-app-stores/)
- [Supabase / Postgres RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Posture revisee : accelerer sans devenir imprudents

La premiere version de ce plan etait volontairement prudente. La posture Phase 4 doit etre plus ambitieuse :

- exploiter les repos open source actifs comme accelerateurs de patterns, workflows et prototypes;
- prendre seulement les morceaux compatibles licence et architecture, pas importer des plateformes entieres dans le produit;
- livrer des versions produit differentiantes rapidement, derriere flags et sans casser le chemin client existant;
- separer clairement "preuve produit interne" et "runtime production qui encaisse".

Concretement : LiveKit, LangGraph, LiteLLM, Pipecat, Dify et LLMLingua ne doivent pas rester des idees de roadmap. Ils deviennent des tracks paralleles, avec des livrables mesurables.

## Shortlist open source a exploiter

Ces repos ont ete verifies le 2026-07-01 via GitHub sans clonage ni execution locale.

| Repo | Licence | Usage pragmatique pour Allo Maude |
| --- | --- | --- |
| [`livekit/agents`](https://github.com/livekit/agents) | Apache-2.0 | Reference principale pour agents vocaux temps reel, architecture agent server, plugins STT/LLM/TTS, turn detection, handoff. |
| [`livekit-examples/agent-starter-node`](https://github.com/livekit-examples/agent-starter-node) | MIT | Starter TypeScript a adapter pour `realtime/livekit-agent/` au lieu de partir d'une page blanche. |
| [`livekit-examples/agent-starter-react`](https://github.com/livekit-examples/agent-starter-react) | MIT | Patterns UI Next.js pour voice assistant, utile pour une console founder/live. |
| [`livekit-examples/livekit-sip-agent-example`](https://github.com/livekit-examples/livekit-sip-agent-example) | Apache-2.0 | Pattern SIP entrant, utile pour tester LiveKit Telephony sans toucher au champion Twilio actuel. |
| [`langchain-ai/langgraphjs`](https://github.com/langchain-ai/langgraphjs) | MIT | Runtime TypeScript pour graph agentique stateful; bon fit avec le codebase Next/TS. |
| [`langchain-ai/langgraphjs-studio-starter`](https://github.com/langchain-ai/langgraphjs-studio-starter) | a verifier avant copie | Pattern projet minimal Studio; utile pour inspecter graph/debug, pas a importer aveuglement. |
| [`BerriAI/litellm`](https://github.com/BerriAI/litellm) | licence repo a verifier avant copie | Gateway modele/couts/budgets; a utiliser comme service externe ou proxy, pas comme code vendore dans Next. |
| [`BerriAI/example_litellm_gcp_cloud_run`](https://github.com/BerriAI/example_litellm_gcp_cloud_run) | a verifier avant copie | Pattern de deploiement proxy; adaptable pour infra separee si Vercel n'est pas le bon runtime. |
| [`pipecat-ai/pipecat`](https://github.com/pipecat-ai/pipecat) | BSD-2-Clause | Lab Python pour experiments voice pipeline, serializers telephony et multi-agent; ne remplace pas LiveKit cible. |
| [`langchain-ai/pipecat-langgraph-example`](https://github.com/langchain-ai/pipecat-langgraph-example) | a verifier avant copie | Inspiration pour brancher pipeline voix + graph, utile pour spike interne. |
| [`langgenius/dify`](https://github.com/langgenius/dify) | licence repo a verifier avant copie | Cockpit interne de prototypage workflows/RAG; a evaluer comme outil ops, pas runtime critique client. |
| [`microsoft/LLMLingua`](https://github.com/microsoft/LLMLingua) | MIT | Compression de contexte long non critique; candidat pour réduire couts RAG/prompts apres instrumentation. |
| [`clerk/javascript`](https://github.com/clerk/javascript) | MIT | Source officielle SDK Clerk, utile pour verifier Expo/native auth patterns avant implementation. |
| [`expo/expo`](https://github.com/expo/expo) | MIT | Reference Expo/EAS, deep links, native build behavior et contraintes stores. |

Regle d'exploitation :

- On peut lire et adapter des patterns.
- On peut copier de petits extraits compatibles licence si attribution et adaptation sont explicites dans le PR.
- On ne vendore pas de repo entier.
- On ne copie rien depuis une licence "other" ou inconnue sans verification manuelle du fichier `LICENSE`.
- On n'execute pas de code clone d'un repo externe sans revue.
- Chaque emprunt doit etre note dans la PR : source, licence, fichiers inspires, ecarts avec notre code.

## Principes non negociables

1. Ne pas remplacer le chemin voix champion en un seul PR.
   Twilio Media Streams + fallback humain restent le chemin stable tant que LiveKit n'a pas une preuve mesuree.

2. Tout nouveau runtime est derriere feature flag.
   Aucun client pilote ne doit basculer par accident.

3. Les couts et traces viennent avant la complexite agentique.
   On ne branche pas LangGraph/LiveKit/LiteLLM sans savoir combien coute chaque tour, quel provider a repondu, et pourquoi.

4. Les tests restent deterministes.
   Pas d'appel externe dans les tests unitaires. Les providers externes passent par des adapters mockables.

5. Le mobile commercial bloque sur l'auth native.
   Le bearer partage reste acceptable pour pilote interne, pas pour App Store / Play Store multi-client.

6. Les docs doivent distinguer "livre", "prototype", "planifie".
   Pas de wording qui donne l'impression que LiveKit, LangGraph ou LiteLLM sont deja en production.

## Architecture cible additive

```text
apps/
  mobile/                         Expo iOS/Android, auth native Clerk, deep links

realtime/
  server.ts                       Champion actuel Twilio Media Streams + OpenAI Realtime
  relay-server.ts                 Prototype ConversationRelay A/B
  livekit-agent/                  Nouveau service experimental LiveKit Agents

src/
  app/api/voice/*                 Webhooks voix existants, flags de routage
  server/
    tenant.ts                     Tenant session Clerk
    twilio-tenant.ts              Tenant par numero appele
    mobile-auth.ts                A remplacer par verification session native
  services/
    model-gateway/                Wrapper interne avant LiteLLM
    observability/                Traces, couts, latences, provenance
    business-brain/               Sources, chunks, retrieval, citations
    agent-graph/                  LangGraph, etats, outils, human-in-loop
    voice-runtime/                Contrats communs Twilio/OpenAI/LiveKit
  domain/
    model-usage.ts
    business-brain.ts
    agent-trace.ts
```

## Fast lane : 10 jours pour une application Phase 4 vendable

Objectif : produire une version produit differenciante rapidement, sans mettre les appels clients en danger.

### Track A — Compteur de revenus et couts

Delai cible : 1-2 jours.

Livrables :

- `ModelUsage` / `AgentTrace` en domaine + store;
- cout estime par appel, modele, feature et tenant;
- dashboard founder minimal "cout vs argent protege";
- wrapper `model-gateway` compatible provider direct aujourd'hui, LiteLLM demain.

Pourquoi maintenant : LiteLLM devient utile quand on a deja une structure interne pour absorber ses donnees. C'est le compteur qui permet d'accelerer sans bruler du cash a l'aveugle.

### Track B — LiveKit product lane

Delai cible : 2-4 jours.

Livrables :

- `realtime/livekit-agent/` base sur les patterns `livekit-examples/agent-starter-node`;
- flag `SCALY_VOICE_ENGINE=livekit` reserve a founder/internal;
- proof console : agent repond, transfere humain, journalise latence;
- exploration SIP via `livekit-sip-agent-example`, sans brancher un numero pilote par defaut.

Pourquoi maintenant : une slice produit LiveKit visible cree un signal commercial et technique plus fort que "on le fera plus tard".

### Track C — LangGraph decision core

Delai cible : 2-3 jours.

Livrables :

- graph TypeScript minimal : greet, qualify, retrieve business fact, ask consent, transfer, summarize, plan action;
- execution hors telephonie via voice-lab/simulator;
- traceId commun entre graph, call, action et usage;
- transitions testees pour urgence, demande humain, refus consentement et hors-scope.

Pourquoi maintenant : LangGraph rend le comportement vendable a des agences et defendable en audit. On ne vend pas juste une voix, on vend un systeme qui sait pourquoi il a agi.

### Track D — Business brain et RAG approuve

Delai cible : 2-4 jours.

Livrables :

- sources approuvees par owner;
- retrieval deterministe Postgres au depart;
- citations dans les reponses internes;
- refus propre quand la connaissance manque;
- preparation future LLMLingua pour compression de contexte long.

Pourquoi maintenant : c'est la difference entre "receptionniste generique" et "agent qui connait vraiment la PME".

### Track E — Mobile auth native

Delai cible : 3-5 jours apres decision Clerk.

Livrables :

- choix prebuilt ou custom Clerk Expo;
- session native persistante;
- endpoints mobile remplaces par auth session;
- `mobile:check` ne bloque plus sur l'auth native.

Pourquoi maintenant : mobile devient un argument commercial pour proprietaires et agences, pas seulement une checklist stores.

## Plan de bataille parallele

Les tracks peuvent avancer en parallele si chaque PR garde son contrat :

- Co-work : UX navigation, business brain UI, founder dashboard, copy marketing.
- Codex : model gateway, traces/couts, graph pur, tests, docs, guards.
- Agent voix : LiveKit starter et SIP spike dans `realtime/livekit-agent/`.
- Mobile : Clerk Expo auth, API token verification, EAS readiness.
- Marketing/agence : scripts de vente produit, verticale plomberie/construction, pages de preuve ROI.

Ordre recommande pour faire de l'argent vite :

1. Vue founder "Revenue saved + cost per call" meme si certains chiffres sont estimes et etiquetes comme tels.
2. Business brain approuve sur 1 verticale.
3. LangGraph voice-lab qui explique ses decisions.
4. LiveKit product lane non client.
5. Mobile owner app avec auth native.
6. LiteLLM proxy quand le model-gateway interne est pret.

## Sequence de PR recommandee

Important : cette sequence n'est pas strictement lineaire. Les PRs de fondation doivent rester reviewables, mais les tracks A/B/C peuvent partir en parallele. Le but n'est pas d'attendre que toute la plomberie soit parfaite avant de livrer une application Phase 4 observable; le but est de livrer vite avec des flags, des preuves et des rollback paths.

### PR 0 — OSS intake et registre d'emprunts

But : exploiter l'open source sans dette legale ou technique.

Travail :

- Ajouter un petit registre `docs/OSS_ACCELERATORS.md` ou une section maintenue dans ce document.
- Pour chaque repo utilise : URL, licence, fichier/pattern inspire, decision copy/adapt/rewrite, risques.
- Identifier 3 assets a adapter immediatement : LiveKit Node starter, LiveKit SIP example, LangGraphJS minimal graph.
- Definir un dossier temporaire hors repo ou une methode lecture seule pour inspecter les exemples sans les vendorer.

Critères d'acceptation :

- Aucun code externe n'entre dans le repo sans licence verifiee.
- Les sources d'inspiration sont traçables dans la PR.
- Les repos a licence inconnue ou "other" sont marques "reference only" jusqu'a verification.

### PR 1 — Hygiene Phase 4 et UX de navigation

But : rendre le produit plus propre sans toucher aux runtimes.

Travail :

- Corriger le drift docs/env : README, `.env.example`, relay envs, nombre de tests.
- Ajouter ou maintenir ce plan dans `docs/PHASE_4_PLAN.md`.
- Simplifier la navigation owner : garder les workflows quotidiens visibles, déplacer readiness/mobile/status/lab dans une zone Advanced/Founder.
- Ne supprimer aucune route mobile/readiness/billing.

Critères d'acceptation :

- Un owner voit une navigation plus courte et orientee travail.
- Les surfaces techniques restent accessibles a founder/admin.
- `.env.example` mentionne les flags relay/realtime sans secrets reels.
- `npm run typecheck`, `npm test`, `npm run build`, `npm audit --omit=dev`.

### PR 2 — Observabilite couts/traces/provenance

But : mesurer avant d'optimiser.

Travail :

- Ajouter des types/domaines pour `ModelUsage`, `AgentTrace`, `ProviderCall`, `VoiceTurnMetric`.
- Etendre Prisma de facon additive, sans migration destructrice.
- Centraliser les appels LLM dans un wrapper interne `src/services/model-gateway`.
- Capturer : companyId, callId/sessionId, provider, model, feature, input/output tokens si disponibles, cout estime, latence, statut, erreur normalisee.
- Ajouter une vue ou endpoint founder pour inspecter les couts par jour/client/provider.

Critères d'acceptation :

- Les appels OpenAI existants peuvent passer par le wrapper ou sont au minimum inventories avec TODO precis.
- Les tests verifient que la provenance est conservee sans appel reseau.
- Les erreurs provider n'exposent pas de secret.
- Une estimation de cout peut etre calculee par appel et par mois.
- La vue founder peut afficher "argent protege", "cout IA estime" et "marge estimee" sans faire croire que les chiffres sont factures.

Validation :

```powershell
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

### PR 3 — Business brain / RAG minimal, cite et controlable

But : donner a Maude une memoire metier sans inventer.

Travail :

- Ajouter un domaine `BusinessKnowledgeItem` : source, titre, contenu, statut, companyId, provenance, date d'approbation.
- Commencer par retrieval deterministe Postgres/texte avant vectorisation si le volume reste faible.
- Ajouter les citations/references dans la reponse interne de l'agent.
- Interdire l'activation automatique d'une connaissance non approuvee par le proprietaire.
- Ajouter un banc de tests : question connue, question hors scope, conflit entre deux sources, source expiree.

Critères d'acceptation :

- Une reponse issue du business brain retourne une source ou dit "je ne sais pas".
- Une connaissance brouillon ne peut pas influencer un appel live.
- Les donnees restent scoper par companyId.
- Pas de fournisseur vectoriel obligatoire tant que le besoin n'est pas mesure.

### PR 4 — LangGraph pour orchestration, pas pour transport voix

But : isoler le cerveau conversationnel et les outils avant de changer l'audio.

Travail :

- Ajouter `src/services/agent-graph` avec un graph minimal : accueillir, qualifier, verifier consentement, escalader humain, resumer, planifier action.
- Connecter les outils existants : action engine, business brain, consentement, transfer human.
- Persister un traceId entre appel, graph state et actions.
- Garder le voice lab comme banc de test du graph avant live.

Critères d'acceptation :

- Le graph est testable sans Twilio, LiveKit ou OpenAI.
- Les transitions critiques sont couvertes : urgence, demande humain, refus consentement, hors scope.
- Les decisions sont traçables dans `AgentTrace`.
- Le runtime actuel peut continuer sans LangGraph si le flag est off.
- Le voice-lab montre le chemin decisionnel complet, avec trace lisible pour agence/client.

### PR 5 — LiteLLM gateway derriere adapter interne

But : controler budgets, routage et multi-provider sans contaminer le code app.

Travail :

- Brancher LiteLLM derriere `src/services/model-gateway`, pas directement dans les features.
- Definir les budgets par environnement et par feature : realtime, analyse transcript, onboarding, RAG.
- Ajouter fallback policy explicite : quels appels peuvent retenter, quels appels doivent echouer proprement.
- Mapper les couts LiteLLM vers `ModelUsage`.

Critères d'acceptation :

- Un flag permet de revenir au provider direct.
- Une panne LiteLLM ne casse pas le fallback humain telephone.
- Les budgets sont testes par fonctions pures ou mocks.
- Aucun secret LiteLLM n'est stocke en repo.

### PR 6 — LiveKit adapter experimental

But : prouver LiveKit vite, sans casser le champion Twilio.

Travail :

- Ajouter un service separe `realtime/livekit-agent/`.
- Adapter les patterns `livekit-examples/agent-starter-node` et `livekit-examples/livekit-sip-agent-example` apres verification licence.
- Garder Twilio Media Streams comme champion client; LiveKit est active seulement par tenant/flag/internal.
- Prototyper SIP/agent room avec transfert humain et trace de latence.
- Rejouer les scenarios voice-lab contre l'agent LiveKit.
- Comparer : latence p50/p95, taux completion, qualite FR-QC/EN, cout par minute, stabilite transfert.

Critères d'acceptation :

- Aucun changement de comportement pour les tenants sans flag.
- Une version interne fonctionne avant tout pilote reel.
- Au moins 20 appels tests documentes avant activation client.
- Fallback humain prouve sur le chemin LiveKit.
- Les resultats sont compares au chemin champion actuel, pas juges au feeling.

### PR 7 — Auth mobile native Clerk

But : passer du pilote interne aux stores.

Travail :

- Choisir explicitement le flow Clerk Expo : prebuilt ou custom.
- Ajouter `@clerk/expo` selon la version compatible Expo, config plugin, token cache officiel.
- Proteger les routes Expo Router par session.
- Remplacer le bearer partage par un token/session utilisateur verifie cote API.
- Mapper l'utilisateur mobile vers companyId/role, comme le web.
- Garder un mode pilote interne seulement si explicitement configure.

Pré-requis avant implementation :

- Choix flow : prebuilt ou custom.
- Vraie publishable key Clerk pour environnement mobile.
- Decision produit : meme login que web ou experience mobile dediee.

Critères d'acceptation :

- `npm --prefix apps/mobile run typecheck` passe.
- Les endpoints `/api/mobile/v1/*` refusent un mobile sans session valide.
- Le bearer partage n'est plus le chemin commercial par defaut.
- `npm run mobile:check` ne bloque plus sur l'auth native.

### PR 8 — Hardening multi-tenant et RLS

But : defense in depth avant plus de clients payants.

Travail :

- Decider si on reste Neon Postgres + Prisma ou si Supabase devient une dependance produit.
- Ajouter RLS si la base et le client d'acces le supportent proprement.
- Sinon, documenter pourquoi RLS reste differe et renforcer tests anti-IDOR.
- Ajouter des tests de non-fuite cross-tenant pour calls, actions, reviews, business brain, usage, mobile.

Critères d'acceptation :

- Aucun endpoint sensible ne peut lire un autre companyId.
- Les policies ou guards sont couverts par tests.
- Les scripts de migration ont un rollback clair.

## Definition of done Phase 4

Phase 4 est terminee quand :

- un appel live peut etre route via le runtime champion et via un runtime experimental mesure;
- chaque appel a cout, latence, provider, model, traceId, provenance et resultat;
- Maude peut repondre avec des connaissances approuvees et citees, ou refuser proprement;
- les workflows agentiques critiques sont modelises et testes hors telephonie;
- le mobile utilise une auth native commerciale;
- les budgets modeles sont visibles et limites;
- le fallback humain reste fonctionnel a 100 %;
- les docs indiquent clairement ce qui est production, flagge ou experimental.

## Commandes de validation de base

```powershell
npm run typecheck
npm test
npm run build
npm audit --omit=dev
npm run mobile:check
npm --prefix apps/mobile run typecheck
```

## Risques residuels a suivre

- Latence FR-QC/EN : a mesurer avec vrais appels, pas seulement avec scenarios controles.
- Cout par minute : a suivre avant d'augmenter les appels IA live.
- Auth mobile : necessite decisions Clerk et builds natifs, pas Expo Go seulement.
- RLS : utile pour defense in depth, mais a implementer seulement avec un modele d'acces database clair.
- LiveKit : prometteur pour la cible, mais doit gagner contre le chemin champion sur donnees mesurees.
