# feat: Scaly Event Boundary v1 (ADR-020)

> **Décision d'architecture** : Scaly / Allô Maude Runtime est le **Voice &
> Messaging Execution Adapter** de l'écosystème. Il garde un runtime store
> minimal ; il n'est **pas** la source de vérité business. Cette PR prouve la
> frontière — rien d'autre. Zéro feature produit, zéro dépendance réseau.

Stacked sur la PR #34 (Revenue Recovery OS v1) : le diff ne montre QUE la
frontière (21 fichiers). Audit complet : `docs/ARCHITECTURE_BOUNDARY.md`.
Modes pilotes : `docs/PILOT_MODES.md`.

---

## Résumé architecture

Chaque moment métier significatif devient un `RuntimeEvent` appendé dans un
**outbox local** (`RuntimeEvent` table, migration additive
`20260702150000_event_outbox`), idempotent par `(companyId, dedupeKey)`.
Deux **ports** rendent la frontière substituable sans toucher aux émetteurs :

- `ActionLedgerPort` — impl. actuelle `OutboxOnlyActionLedger` (no-op assumé,
  les événements restent `pending`) ; future `OriaActionLedgerClient`.
- `ContextPackProvider` — impl. actuelle `LocalContextPackProvider`
  (caller-memory existant) ; future `MemexContextPackProvider`.
  `/api/voice/context` passe déjà par ce port.

Pas de bus, pas de framework : un repo (InMemory + Prisma, patron existant),
une fonction d'append best-effort (`tryAppendRuntimeEvent` — ne casse JAMAIS
le téléphone), deux ports.

## Ce que Scaly garde localement (légitimement)

- Résolution de tenant téléphonique + config d'exécution (`Company`, `VoiceAgent`).
- État de session et idempotence des webhooks (`Call` vivant, `VoiceSession`, callSid).
- **Copie d'exécution du consentement** — le gate consulté à la milliseconde de l'envoi.
- Outbox opérationnels (`Action`, `OwnerNotification`, `RecoveryOffer`, `AppointmentGap`…).
- Verbatim purgeable (transcripts, turns) sous rétention Loi 25 — jamais exporté.

## Prêt pour Oria Action Ledger

Les 12 types d'événements, contrat complet : `id`, `companyId`,
`source:"scaly"`, `occurredAt`, `correlationId` (= callSid Twilio en voix),
`externalId`, `dedupeKey`, `schemaVersion`, `payload` JSON-safe caviardé,
`status pending|delivered|failed`, `attempts`, `lastError`. Brancher Oria =
implémenter `ActionLedgerPort` + un dispatcher qui draine les `pending`.

## Prêt pour Memex Core

`ContextPackProvider.getContextPack(companyId, callerPhone)` est le point de
substitution officiel du dossier appelant. Candidats de migration identifiés :
`BusinessKnowledgeItem` (mémoire d'entreprise) et `WaitlistEntry` (mini-CRM
naissant) — classification complète dans `docs/ARCHITECTURE_BOUNDARY.md` §1.

## Types de RuntimeEvent (12)

`call.session_started` · `call.transferred` · `call.completed` ·
`consent.captured` · `sms.opt_out_received` · `opportunity.detected` ·
`recovery.gap_opened` · `recovery.offer_sent` · `recovery.offer_confirmed` ·
`owner.notification_sent` · `runtime.failure` · `runtime.realtime_unavailable`

Le fallback humain `<Dial>` et le realtime IA produisent les **mêmes
événements de base**, corrélés par le même callSid — on passe de Shadow Mode à
Realtime AI sans recoder la persistance (`docs/PILOT_MODES.md`).

## Sécurité payload (testée, pas promise)

- **Jamais de secret** : clés sensibles (`token`, `apiKey`, `databaseUrl`…) et
  valeurs suspectes (sk-…, URLs postgres, SID Twilio, Bearer) caviardées
  `[REDACTED]` par le sanitizer.
- **Jamais de transcript complet** : clés `transcript`/`turns` interdites à la
  frontière — `transcriptRef` (= callId) + `summary` seulement.
- **Téléphones caviardés** : `redactPhone` → `•••1269` dans tous les payloads ;
  le numéro complet reste uniquement dans les tables opérationnelles où
  l'envoi l'exige.
- **JSON-safe total** : fonctions/symboles retirés, Dates → ISO, NaN → null,
  chaînes/tableaux/objets bornés, profondeur max 6. Le sanitizer ne jette
  jamais ; chaque caviardage laisse une trace auditable (`redactions`).

## Validation

- `npm run security:check` ✅ 361 fichiers trackés, aucun secret
- `npm run typecheck` ✅
- `npm test` ✅ 529 tests / 60 fichiers (dont `tests/event-boundary.test.ts`)
- `npm run build` ✅
- `npx prisma validate` ✅
- `npm run pilot:check` 🟡 WARN transport uniquement — attendu : mode
  `human_fallback` assumé (`SCALY_REALTIME_WS_URL` absente de Vercel, choix documenté)

## Risques restants (honnêtes)

1. **Pas de dispatcher** : les événements restent `pending` — voulu (« prêt à
   brancher », zéro dépendance réseau). `status/attempts/lastError` attendent
   le futur livreur.
2. **`Call.intelligence` encore local** : /roi et /opportunites lisent le store
   local ; l'événement est émis en parallèle. La migration de la lecture
   viendra quand Oria existera.
3. **`AuditLog.detail` historique** contient des numéros en clair — à couvrir
   par la même politique de rétention que les transcripts.
4. Le pont WS (`realtime/`) n'émet pas directement — ses moments passent par
   les endpoints backend ; une panne avant tout POST est couverte par le
   callback `action` Twilio (`runtime.failure`).

## Plan de migration vers Oria/Memex

1. **Oria Action Ledger** : implémenter `OriaActionLedgerClient implements
   ActionLedgerPort` (HTTP + auth) + un dispatcher cron qui draine les
   `pending` → `delivered|failed` avec retry/backoff sur `attempts`.
2. **Memex Core** : implémenter `MemexContextPackProvider implements
   ContextPackProvider` ; `/api/voice/context` ne change pas.
3. Migrer `BusinessKnowledgeItem` (workflow d'approbation → Memex), puis le
   profil appelant durable ; Scaly ne garde que la fenêtre opérationnelle.
4. Quand Oria tient le grand livre : /roi et /opportunites basculent leur
   lecture, `Call` redevient une tranche vivante purgeable.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
