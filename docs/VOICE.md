# Infrastructure vocale — plan P2

## État actuel (honnête)
- **P2A ✅ — Voice Runtime Lab (ADR-014)** : le cerveau conversationnel existe et est testé.
  - `services/voice-runtime.ts` : réducteur pur `(session, tour) → session`, machine à 12 états, barge-in, urgence fast-track, conflits de champs, transfert humain non négociable.
  - `services/voice-extraction.ts` / `voice-language.ts` : NLU à règles FR-QC/EN (extraction progressive avec confiance + evidence), langue par tour + dominante.
  - 6 scénarios golden (`data/voice-scenarios.ts`) verrouillés en CI et rejoués en direct dans `/status` ; UI `/voice-lab` (pas-à-pas, autoplay, mode libre).
  - Boucle de valeur : session → `Call` analysé par le même IntelligenceEngine/ActionEngine (`voice-convert.ts`) ; `VoiceSession` persistée (Prisma) avec purge Loi 25 (turns/events purgés, fields/telemetry conservés).
  - Latences SIMULÉES, marquées `simulated:true` partout — les cibles p50/p95 restent des hypothèses jusqu'à P2B.
- **P2B 🔧 — code complet, preuve d'appel réel à exécuter.**
  - `src/app/api/voice/incoming` : webhook Twilio signé (HMAC vérifié, falsification → 403), résolution du tenant par numéro appelé (`To`/`Called` → `Company.twilioPhoneNumber`), TwiML `<Connect><Stream>` vers le pont, **repli `<Dial>` vers l'humain si le realtime est absent — le téléphone ne casse jamais**.
  - `src/app/api/sms/incoming` : même résolution par numéro appelé avant d'exposer les données au propriétaire.
  - `realtime/` : pont scaly-realtime (Node long-lived, `npm run realtime`) — Twilio Media Streams ↔ OpenAI Realtime, µ-law 8 kHz passthrough (zéro transcodage), VAD serveur + barge-in (response.cancel + clear), outil `transfer_to_human` → redirection REST Twilio, **latences RÉELLES mesurées par tour** (fin de parole → premier octet audio, `simulated:false`).
  - Prompt système (`src/services/voice-prompt.ts`) construit des MÊMES objets que le Voice Lab : divulgation IA, bilinguisme, urgences fast-track, interdits, **consentement de rappel (ADR-015)** — chaque garde-fou testé.
  - Fin d'appel → `/api/voice/complete` → Call `source:"live"` analysé par le même IntelligenceEngine/ActionEngine.
  - Vérifié le 2026-06-29 : Clerk dev actif, Neon persistant, signature Twilio configurée, mapping voix/SMS multi-tenant présent. **Il manque encore la preuve opérationnelle : appeler un vrai numéro Twilio branché sur `/api/voice/incoming` et journaliser le résultat.**

## Runbook — premier appel réel (checklist exécutable)

> **Pré-vol obligatoire** : `npm run pilot:check`. Régler tout **FAIL**, lire chaque **WARN**. Le gate confirme : auth, cohérence store, secret pont, signature Twilio, transport+repli, OpenAI, résolution de tenant, garde-fous testés.

### A. Mise en place
1. **Numéro Twilio** : Console → Phone Numbers → Buy (local QC, voix). Assigner ce numéro au tenant (`Company.twilioPhoneNumber`) et garder `TWILIO_PHONE_NUMBER` pour les SMS sortants.
2. **Tunnels** : `ngrok http 3000` (app) et `ngrok http 8081` (pont) — ou un seul tunnel + reverse proxy.
3. **`.env.local`** : `SCALY_REALTIME_WS_URL=wss://<ngrok-pont>/twilio`, `SCALY_PUBLIC_URL=https://<ngrok-app>`, `REALTIME_SHARED_SECRET=<secret>` (les deux côtés), `OPENAI_API_KEY=<clé>`, `TWILIO_AUTH_TOKEN=<token>`. Pour persister les appels : `STORE_PROVIDER=prisma` + `DATABASE_URL` migrée.
4. **Lancer** : `npm run dev` (app) + `npm run realtime` (pont).
5. **Webhook Twilio** : Console → le numéro → Voice Configuration → `https://<ngrok-app>/api/voice/incoming` (POST).

### B. Vérifications avant d'appeler (chaque case doit être cochée)
- [ ] `npm run pilot:check` ne renvoie **aucun FAIL**.
- [ ] App lancée (`npm run dev`).
- [ ] Pont lancé (`npm run realtime`).
- [ ] Santé pont : `http://localhost:8081/health` → `configured: true`.
- [ ] Webhook Twilio configuré sur le bon numéro (POST).

### C. Tests d'appel (à journaliser, noter sur 10)
- [ ] **Repli `<Dial>` quand realtime absent** : arrêter le pont (ou retirer `SCALY_REALTIME_WS_URL`), rappeler → l'appel aboutit DIRECTEMENT à l'humain. *Le téléphone ne casse jamais.*
- [ ] **« Je veux parler à un humain »** → transfert immédiat vers `transferPhone`.
- [ ] **Urgence** (« j'ai de l'eau partout ») → empathie d'abord, fast-track, transfert à l'équipe de garde.
- [ ] **FR-QC** : accent et tournures d'ici, accueil < 1 s.
- [ ] **EN** : bascule immédiate à l'anglais si l'appelant parle anglais, puis suit sa langue.
- [ ] **Mémoire appelant connu** : rappeler du même numéro → l'agente confirme l'adresse au dossier au lieu de la redemander (jamais inventée).
- [ ] **Numéro inconnu / masqué** : aucun « comme la dernière fois », aucune mémoire injectée.
- [ ] **Transcript persisté `source:"live"`** : visible dans `/calls`.
- [ ] **Latence réelle enregistrée** : valeurs `simulated:false` dans l'audit (cibles < 800 ms p50 / < 1200 ms p95).
- [ ] **Consentement de rappel** capté (oui/non verbatim) → enregistrement dans `/consents` (ADR-015/018).

### D. Avant tout client réel
- [ ] 50 appels tests FR/EN (urgences incluses) — jalon 4.
- [ ] **Avant un 2ᵉ client** : attribuer un numéro Twilio unique par entreprise, vérifier qu'aucun numéro n'est ambigu, puis refaire `npm run pilot:check` et un appel réel par tenant.

### Pile préparée (stubs honnêtes, plan B)
- `adapters/voice/types.ts` : interfaces `TelephonyProvider`, `SpeechToTextProvider`, `TextToSpeechProvider`, `RealtimeDialogueProvider`, `NotConfiguredError`.
- ElevenLabs / Whisper = stubs typés (plan B pipeline STT→LLM→TTS si la latence FR-QC d'OpenAI Realtime déçoit).

## Topologie cible
1. Numéro Twilio par client (ou SIP refer du numéro existant en renvoi d'appel — option zéro-portabilité pour signer vite).
2. Appel entrant → webhook Twilio → `scaly-realtime` ouvre le Media Stream (WebSocket bidirectionnel, audio µ-law 8 kHz).
3. `scaly-realtime` (Node long-lived — Fly.io/Railway/ECS, JAMAIS Lambda) :
   - construit le prompt système depuis `VoiceAgentConfig` + `IndustryScript` + `Company` (mêmes objets que le simulateur — c'est voulu) ;
   - plan A : session OpenAI Realtime (audio↔audio, barge-in natif) ;
   - plan B (même interface) : Whisper streaming → LLM → ElevenLabs streaming ;
   - applique les règles : divulgation IA, phrases interdites (validateur de sortie), critères de transfert.
4. Transfert humain = `<Dial>` Twilio vers `transferPhone` (fallback ultime : toujours possible).
5. Fin d'appel → événement vers scaly-app : transcript final → `IntelligenceEngine` → `ActionEngine` → file d'attente → workers (ici, Lambda/cron OK).

## Budget latence (cible < 800 ms perçu)
| Étape | Cible |
|---|---|
| Twilio ↔ realtime (réseau) | < 50 ms |
| Détection fin de parole (VAD) | 150-250 ms |
| Premier token audio IA | 300-450 ms |
| Total perçu avant réponse | < 800 ms |

Mesures : timestamps par étape dans les logs de session dès le premier appel test.

## Coûts par minute (hypothèses internes à valider sur facture réelle)
Twilio voix ≈ 0,014-0,022 $US/min + numéro ; OpenAI Realtime ≈ 0,06-0,30 $US/min selon modèle/cache ; ElevenLabs ≈ 0,03-0,10 $US/min. Modèle interne agrégé : 0,11 $CA/min (src/domain/billing.ts) — à recalibrer dès les premiers appels réels, AVANT de figer les prix publics.

## Étapes d'implémentation P2 (ordre exact)
1. Compte Twilio + 1 numéro test + webhook vers scaly-realtime (hello world TwiML).
2. Media Stream ↔ echo (boucle audio brute) — valide le tuyau.
3. Brancher OpenAI Realtime avec prompt minimal — premier dialogue.
4. Injecter VoiceAgentConfig/IndustryScript — l'agent suit le script.
5. Transfert humain + enregistrement des événements de session.
6. Fin d'appel → pipeline intelligence/actions existant (déjà testé via simulateur).
7. 50 appels tests internes (FR + EN + urgences simulées) avant tout client réel.
