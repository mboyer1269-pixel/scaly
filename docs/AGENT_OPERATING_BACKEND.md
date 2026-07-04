# Agent Operating Backend v1 — la carte du substrat (ADR-021)

> **Thèse.** Les apps IA qui gagnent ne gagnent pas grâce au prompt. Elles
> gagnent parce que leur backend transforme un prompt en **système
> exploitable** : mémoire, contexte, outils, actions, événements, ROI,
> apprentissage. Allô Maude n'est pas une réceptionniste : c'est le **premier
> agent** construit sur notre Agent Operating Backend.

Rédigé le 2026-07-02. Chaque affirmation « livré » pointe vers du code réel du
dépôt ; ce qui est simulé ou déterministe est étiqueté comme tel.

---

## 1. La vision — le pipeline qui fabrique des agents

```
Prompt ──► Agent Definition ──► Context Pack ──► Capabilities ──► Runtime Events ──► Action Ledger ──► ROI ──► Learning
  │              │                    │                │                 │                  │            │         │
  │   src/services/agent-draft   src/services/    src/data/       src/domain/        src/services/   src/services/ boucle
  │   (mapper déterministe v1,   ports.ts         capabilities.ts runtime-event.ts   ports.ts        rescue.ts +  transcript
  │   LLM plus tard — même       ContextPack-     (registre        + event-outbox    ActionLedger-   revenue.ts   → code
  │   structure, même            Provider         déclaratif)      (outbox ADR-020)  Port (Oria)                  (manuel
  │   validation)                (Memex demain)                                                                    aujourd'hui)
```

Chaque flèche est un **contrat**, pas un couplage :

1. **Prompt → Agent Definition** : une phrase de fondateur devient une
   `AgentDefinition` validée (`draftAgentDefinitionFromPrompt`). v1 =
   mapper déterministe à 3 verticales ; le LLM qui le remplacera devra
   produire la **même structure** et passer la **même validation**.
2. **Agent Definition → Context Pack** : l'agent déclare ses `contextNeeds` ;
   le `ContextPackProvider` (ports ADR-020) les fournit — local aujourd'hui,
   Memex demain, sans changer les consommateurs.
3. **Context → Capabilities** : les capabilities sont un **registre
   déclaratif** (`CAPABILITY_REGISTRY`) ; les moteurs vivent dans
   `src/services`. Un pack métier active, le moteur exécute, jamais l'inverse.
4. **Capabilities → Runtime Events** : chaque moment métier significatif
   devient un `RuntimeEvent` dans l'outbox (idempotent, sanitizé, borné au
   tenant) — la frontière ADR-020.
5. **Events → Action Ledger** : l'`ActionLedgerPort` est le point d'appui
   d'Oria. v1 : no-op assumé, les événements restent `pending` dans l'outbox —
   honnête et visible.
6. **Ledger → ROI** : `rescue.ts` (RoiSnapshot) et `revenue.ts` (marge)
   produisent le chiffre que la PME comprend : « Maude coûte X $, elle a
   protégé Y $ ». Chaque métrique porte sa méthode (`measured` ou
   `estimated_baseline` — barème ADR-010, jamais magique).
7. **ROI → Learning** : la boucle transcript→code (mémoire
   « premier appel réel ») est aujourd'hui manuelle et c'est ASSUMÉ : chaque
   appel noté produit des correctifs de prompt/VAD versionnés. Le futur :
   Memex apprend, les packs se recalibrent.

## 2. Où vit chaque responsabilité

| Couche | Rôle | Ce qui y vit | Ce qui n'y vit JAMAIS |
|---|---|---|---|
| **Scaly Runtime** | Execution adapter voix/SMS (ADR-020) | Config tenant, sessions vocales, consentements consultés à l'envoi, outbox RuntimeEvent, capabilities et leurs moteurs | La source de vérité business long terme ; la mémoire d'entreprise |
| **Oria Action Ledger** (futur) | Grand livre des faits et actions | Consommera l'outbox via `ActionLedgerPort` ; registre canonique des consentements, actions, ROI historicisé | La logique d'exécution temps réel |
| **Memex Core** (futur) | Cerveau contextuel | `ContextPackProvider` : mémoire appelant cross-canal, savoir d'entreprise (`BusinessKnowledgeItem` migrera ici), préférences | L'envoi de SMS, le routage d'appels |
| **Agent Backend** (cette brique) | Fait naître et opérer les agents | `AgentDefinition` (contrat), registre de capabilities, `resolveAgentRuntimePlan` (readiness), `draftAgentDefinitionFromPrompt` (naissance) | Du code métier par agent — un agent est de la DONNÉE |

## 3. Ce qu'Allô Maude prouve déjà (code livré, vérifié)

- **Un agent est exprimable en données** : `ALLO_MAUDE_AGENT`
  (src/data/agent-definitions.ts) déclare persona, 3 canaux, 8 capabilities,
  5 besoins de contexte, 4 cibles d'action tracées, 6 métriques ROI avec
  méthode, 5 adaptateurs runtime, 3 ports backend — validée au chargement.
- **Les capabilities sont opérées, pas hardcodées** : gap recovery, pouls
  texto, détection d'opportunités, ROI, coffre de consentements, transfert
  humain, sauvetage d'appels manqués, suivi J+2 — chacune avec moteur réel
  dans src/services, gardes de sécurité et limites basses.
- **Les actions sont tracées** : outbox `RuntimeEvent` idempotente,
  payloads sanitizés (secrets caviardés, transcripts interdits), 12 types
  d'événements réellement émis par les routes voix/SMS et les moteurs.
- **Le ROI est mesuré** : /roi et /opportunites tournent sur les appels réels ;
  chaque montant affiche s'il est mesuré ou au barème.
- **La readiness est une réponse structurée** : `resolveAgentRuntimePlan`
  répond « prêt / dégradé / pas prêt » avec le score, les capabilities
  activées, les événements émis et la configuration manquante — même
  philosophie que le Pilot Readiness Gate (ADR-019), au niveau agent.
- **Un prompt devient un agent structuré** : 3 prompts de démonstration
  produisent 3 drafts validés (dentaire → cancellation recovery ;
  concessionnaire → service/appointment recovery ; courtier → lead follow-up
  + missed call rescue), avec risques, données requises et première démo.

## 4. Ce qui doit être généralisé pour créer d'autres agents

1. **Persistance des définitions** : `AGENT_DEFINITIONS` est un module de
   données. Self-serve = table Prisma `AgentDefinition` (le contrat est déjà
   JSON-sérialisable) + CRUD founder.
2. **Drafter LLM** : remplacer le mapper déterministe par un appel LLM qui
   émet la même structure, revalidée par `validateAgentDefinition` — le
   contrat est le garde-fou, pas le générateur.
3. **Provisioning** : numéro Twilio + claims Clerk + pack métier par agent —
   aujourd'hui manuel (ADR-017), à scripter.
4. **Capabilities multi-agents** : les moteurs prennent `(company, …)` ;
   il faudra les paramétrer par `(agentDefinition, company, …)` quand deux
   agents coexisteront chez un même tenant.
5. **Dispatcher d'outbox** : l'`ActionLedgerPort` no-op devient un client
   HTTP Oria quand Oria existe — les émetteurs ne changent pas.
6. **Prompt runtime par définition** : le prompt temps réel de Maude est
   construit par tenant (voice-prompt.ts) ; il devra se construire par
   AgentDefinition (persona + safetyRules + capabilities activées).

## 5. Les anti-patterns interdits (et où le code les bloque)

| Anti-pattern | Interdit par |
|---|---|
| **Mémoire business locale** | Frontière ADR-020 : `BusinessKnowledgeItem` et `WaitlistEntry` classés « à migrer » (docs/ARCHITECTURE_BOUNDARY.md) ; tout moment métier émis en RuntimeEvent ; `futureOwner` explicite sur chaque contextNeed |
| **Logique métier hardcodée dans un agent** | Packs 100 % déclaratifs (ADR pack.ts) ; capabilities = registre + moteur générique ; un agent est une AgentDefinition, pas du code |
| **Actions non tracées** | `validateAgentDefinition` : une `actionTarget` avec `tracedBy` vide jette `AgentDefinitionError` ; outbox idempotente sur chaque envoi réel |
| **ROI non mesuré** | Chaque `AgentRoiMetric` exige `method` non vide et `basis` (`measured` / `estimated_baseline`) ; violation = erreur au chargement |
| **Prompt sans contrat backend** | `backendBindings` obligatoires (ContextPackProvider, ActionLedgerPort, RuntimeEventOutbox) — un draft sans ports ne valide pas |
| **Capability inventée** | `requireCapability` jette `CapabilityUnknownError` pour tout id hors registre — dans la validation ET dans les moteurs |

## 6. État honnête (2026-07-02)

**Fonctionnel aujourd'hui** : contrat AgentDefinition + validation ; registre
de 8 capabilities avec moteurs réels ; plan runtime résolu en direct dans
/agent-os ; outbox RuntimeEvent alimentée par les vraies routes ; drafts
prompt→agent validés.

**Simulé / déterministe (assumé)** : le drafter est un mapper à mots-clés,
pas un LLM ; l'ActionLedgerPort est no-op (événements `pending`) ; le
ContextPackProvider est local ; les montants ROI au barème sont des
hypothèses affichées comme telles ; la boucle « learning » est manuelle.

**Vers Oria** : registre canonique des consentements, historique des actions
et du ROI, dispatcher de l'outbox. **Vers Memex** : mémoire appelant
cross-canal, savoir d'entreprise, préférences — via le même
ContextPackProvider.
