# Scaly Event Boundary v1 — frontière d'architecture (ADR-020)

> **Décision** : Scaly / Allô Maude Runtime est le **Voice & Messaging Execution
> Adapter** de l'écosystème. Il garde un runtime store minimal ; il n'est **pas**
> la source de vérité business. Chaque moment métier significatif est émis comme
> `RuntimeEvent` dans un outbox local, prêt à être consommé par **Oria Action
> Ledger** (faits/actions) et **Memex Core** (mémoire/contexte) — sans couplage
> réseau aujourd'hui.

Audit réalisé le 2026-07-02 (War Room multi-agents + vérification manuelle).
Toutes les références `fichier:ligne` ont été vérifiées dans le code réel.

---

## 1. Classification des 16 tables Prisma

| Table | Classe | Pourquoi |
|---|---|---|
| `Company` | **runtime indispensable** | Config tenant : `twilioPhoneNumber @unique` résout le tenant à l'appel, `transferPhone` permet le repli, heures/ton/règles bâtissent le prompt. 1 ligne/tenant, bornée. Le `billing Json` n'est qu'un miroir de Stripe (source de vérité : Stripe). |
| `VoiceAgent` | **runtime indispensable** | Persona + garde-fous de Maude par tenant, injectés dans chaque prompt. Vigilance : `ownerInstructions` est du texte libre (PII incidente possible). |
| `Consent` | **runtime indispensable** | Gate légal consulté **à la milliseconde de l'envoi** (`sendPreparedOffers`, `src/services/gap-recovery.ts`). Même si un coffre partagé émerge côté Oria, la copie applicative locale interrogée à l'envoi doit rester ici. Chaque capture/révocation est désormais **aussi émise** (`consent.captured`, `sms.opt_out_received`) pour que le ledger externe puisse en devenir le registre canonique. |
| `VoiceSession` | **runtime indispensable** | Carnet de bord du runtime (12 états, télémétrie). Verbatim purgé Loi 25 ; personne d'autre n'est la source légitime. |
| `Call` | **⚠ potentiel monolithe** | Double nature : la tranche vivante (idempotence par `provenance.externalId=callSid`, checkpoints anti-crash) est runtime pur. Mais l'archive croît sans borne et la purge Loi 25 ne retire que le verbatim — **l'intelligence extraite (intentions, valeurs, ROI) s'accumule dans Scaly et alimente déjà /roi et /opportunites. C'est LE silo en formation.** Réponse v1 : l'intelligence post-appel est émise dans `call.completed` / `opportunity.detected` ; Oria pourra en devenir le ledger, Scaly ne gardant à terme que la fenêtre opérationnelle. |
| `Action` | **operational outbox** | Textuellement un outbox : `status`, `attempts`, `lastError`, `executor`, `executedAt`. Valeur = le cycle pending→executed. |
| `AuditLog` | **operational outbox** | Journal d'exploitation. Piège vérifié : `detail` contient des numéros canoniques en clair (ex. `gap-recovery.ts` audit consentement) → même politique de rétention que les transcripts à prévoir. |
| `UsagePeriod` | **operational outbox** | Métrologie mensuelle bornée (1 ligne/tenant/mois). Zéro PII. |
| `ReviewItem` | **operational outbox** | File de QA humaine. `evidence` peut citer du verbatim → rétention. |
| `ReadinessEvidence` | **operational outbox** | Checklist d'activation pilote. Volume minuscule. |
| `OwnerNotification` | **operational outbox** | Outbox exemplaire (`deliveryClaimedAt` anti double-SMS, `providerMessageId`). PII : les résumés nomment le client → même rétention que les transcripts dont ils dérivent. |
| `AppointmentGap` | **operational outbox** | Objet de relais éphémère (open→filled/expired), idempotence par clé unique. Le vrai calendrier reste chez la PME — assumé dans le schéma. |
| `RecoveryOffer` | **operational outbox** | Outbox de livraison strict : idempotence, consent gate final à l'envoi, premier OUI gagne. À archiver, pas à migrer. |
| `ReviewRequest` | **operational outbox** | Cycle eligible→sent = toute la valeur. PII directe (nom+téléphone) → rétention. |
| `BusinessKnowledgeItem` | **business memory à migrer** | Le candidat le plus net : mémoire d'entreprise (savoir owner, politiques) que Scaly ne fait que consommer au prompt. Source de vérité légitime : **Memex Core**. Le schéma l'admet déjà à moitié (items `company_config` dérivés à la lecture, non persistés). |
| `WaitlistEntry` | **business memory à migrer** | Mini-CRM naissant (identité + désir de service + canal). Source légitime : le système client / Oria. Scaly ne devrait garder que le pointeur opérationnel le temps de la relance. Sensibilité élevée : `desiredServiceLabel` peut révéler une donnée de santé (packs dentaire/clinique). Réponse v1 : `recovery.*` émis à chaque étape. |

**Nouvelle table** : `RuntimeEvent` — l'outbox de la frontière elle-même
(`pending | delivered | failed`, idempotence par `(companyId, dedupeKey)`).

## 2. Où Scaly stocke chaque concept business (inventaire vérifié)

| Concept | Points d'écriture | Verdict frontière |
|---|---|---|
| **Profil appelant** | Aucune table dédiée — dérivé À LA LECTURE par `buildCallerMemory`/`selectCallerHistory` (`src/services/caller-memory.ts:18,34`) depuis `Call.callerName` + `Call.intelligence.collectedFields` ; début de duplication dans `WaitlistEntry.callerName/phone` (`captureWaitlistEntryFromCall`). | Bon réflexe actuel (pas de table profil). Le port `ContextPackProvider` officialise le point de substitution : demain Memex fournit le dossier, Scaly cesse de le dériver. |
| **Transcript** | `Call.transcript` (écrit par `/api/voice/complete/route.ts:110`, `persistFallbackCall` `src/server/voice-fallback.ts:89`, checkpoints `/api/voice/checkpoint`) ; `VoiceSession.turns/events` ; purge Loi 25 `purgeExpiredTranscripts`. | Reste local (verbatim purgeable). **Ne traverse JAMAIS la frontière** : les événements portent `transcriptRef` (= callId) + `summary`, jamais les tours — imposé par le sanitizer (clé `transcript`/`turns` interdite). |
| **Consentement** | `Consent` via `store.saveConsent` (`/api/voice/complete/route.ts:133`, `simulation-workflow.ts:33`) ; révocation `store.revokeConsents` (`/api/sms/incoming/route.ts:67`) ; snapshot `WaitlistEntry.consentToSms`. | Copie d'exécution locale + événement (`consent.captured`, `sms.opt_out_received`) vers le ledger. |
| **Opportunité** | **Non persisté** — `computeOpportunities` (`src/services/opportunities.ts`) est une fonction pure recalculée à chaque rendu de /opportunites et /dashboard depuis `Call.intelligence`, gap recovery et notifications. | Le signal source est maintenant émis (`opportunity.detected` au moment où l'appel qui le crée est persisté) — pas à chaque page vue. |
| **ROI** | **Non persisté** — `computeRevenueCounter` (`src/services/revenue.ts:26`) somme `Call.intelligence.estimatedValueCad` à la lecture. | Les montants voyagent dans les payloads d'événements (`valueCad`) ; Oria pourra tenir le grand livre, Scaly garde l'affichage. |
| **Décision business** | `Action` (rescue/rappels), `OwnerNotification` (résumés, escalades), `ReviewRequest`, `ReviewItem`, `BusinessKnowledgeItem` (workflow d'approbation). | Les quatre premiers sont des outbox (OK local). `BusinessKnowledgeItem` = mémoire à migrer vers Memex Core. |

## 3. Ce que Scaly possède (légitimement)

- La **résolution de tenant** téléphonique et la **config d'exécution** (Company, VoiceAgent).
- L'**état de session** et l'idempotence des webhooks (Call vivant, VoiceSession, callSid).
- La **copie d'exécution du consentement** — le gate consulté au moment exact de l'envoi.
- Les **outbox opérationnels** (Action, OwnerNotification, RecoveryOffer, AppointmentGap…) le temps de leur cycle de vie.
- Le **verbatim purgeable** (transcripts, turns) sous rétention Loi 25 — jamais exporté.

## 4. Ce que Scaly ne doit PAS posséder

- Le **grand livre des faits business** (qui a appelé, ce qui a été promis, ce qui a été récupéré, combien ça vaut) → **Oria Action Ledger**, via les `RuntimeEvent`.
- La **mémoire d'entreprise** (savoir owner, politiques, réponses maison) → **Memex Core** (`BusinessKnowledgeItem` est le premier candidat à migrer).
- Le **profil client durable** (historique cross-canal, préférences) → Memex Core via `ContextPackProvider` ; Scaly dérive aujourd'hui, il consommera demain.
- Le **calendrier** (déjà assumé : `AppointmentGap.humanLabel` fait foi, pas de PMS).
- La **facturation** (Stripe est la source, `Company.billing` n'est qu'un miroir).

## 5. Ce qui part vers Oria Action Ledger (prêt aujourd'hui)

Les 12 types de `RuntimeEvent` (`src/domain/runtime-event.ts`), appendés dans
l'outbox par `appendRuntimeEvent` (`src/services/event-outbox.ts`) :

`call.session_started` · `call.transferred` · `call.completed` ·
`consent.captured` · `sms.opt_out_received` · `opportunity.detected` ·
`recovery.gap_opened` · `recovery.offer_sent` · `recovery.offer_confirmed` ·
`owner.notification_sent` · `runtime.failure` · `runtime.realtime_unavailable`

Contrat : `id`, `companyId`, `source:"scaly"`, `occurredAt`, `correlationId`
(= callSid pour la voix, `sms:<phone canonique>` pour les SMS), `externalId`,
`dedupeKey` (idempotence), `schemaVersion`, `payload` JSON-safe caviardé,
`status pending|delivered|failed`, `attempts`, `lastError`.

Le port `ActionLedgerPort` (impl. actuelle `OutboxOnlyActionLedger`) est le
point de branchement : `OriaActionLedgerClient` remplacera l'implémentation
sans toucher aux émetteurs.

## 6. Ce qui part vers Memex Core (préparé, non branché)

- Le **ContextPack** d'appel : `ContextPackProvider.getContextPack(companyId, callerPhone)`
  (impl. actuelle `LocalContextPackProvider` = caller-memory existant ; future
  `MemexContextPackProvider`). `/api/voice/context` passe par ce port.
- À terme : `BusinessKnowledgeItem` (workflow d'approbation → Memex), et le
  profil appelant durable (aujourd'hui dérivé des appels locaux).

## 7. Limites actuelles honnêtes

1. **L'outbox n'a pas de livreur** : les événements restent `pending` — c'est
   voulu (« prêt à brancher », pas de dépendance réseau Oria/Memex). Le champ
   `status/attempts/lastError` existe pour le futur dispatcher.
2. **`Call.intelligence` reste dans Scaly** : /roi et /opportunites lisent
   encore le store local. L'événement est émis en parallèle — la migration de
   la lecture viendra quand Oria existera.
3. **Événements côté pont** : le processus `realtime/` (serveur WS séparé)
   n'émet pas directement — ses moments passent par les endpoints backend
   (`/complete`, `/fallback`, `/checkpoint`) qui émettent. Une panne du pont
   AVANT tout POST est couverte par `runtime.failure` du callback `action`
   Twilio, pas par le pont lui-même.
4. **Téléphones** : caviardés dans les payloads (`•••1269`) — le numéro complet
   reste dans les tables opérationnelles où l'envoi l'exige (WaitlistEntry,
   Consent). L'`AuditLog.detail` historique contient encore des numéros en
   clair (à couvrir par la rétention).
5. **Pas de bus, pas de framework** : un repo + une fonction d'append + deux
   ports. C'est un choix (contrainte fondateur), pas un oubli.
6. **`opportunity.detected`** est émis pour les opportunités DÉRIVÉES D'UN
   APPEL au moment de sa persistance ; les opportunités purement calculées
   (rescue queue d'appels manqués agrégés) ne sont pas encore des événements.

## 8. Corrélation fallback ↔ realtime (vérifié)

Clé universelle = **CallSid Twilio**, propagé de bout en bout :
webhook (`params["CallSid"]`) → customParameters du `<Connect><Stream>` →
pont (`msg.start.callSid`) → `Call.provenance.externalId` sur les DEUX chemins.
**Ne jamais corréler sur `call.id`** (le fallback génère `call_twilio_<sid>`,
`/complete` génère `newId("call")` sauf brouillon checkpointé). Tous les
événements voix portent `correlationId = callSid`.
