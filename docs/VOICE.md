# Infrastructure vocale — plan P2

## État actuel (honnête)
- **P2A ✅ — Voice Runtime Lab (ADR-014)** : le cerveau conversationnel existe et est testé.
  - `services/voice-runtime.ts` : réducteur pur `(session, tour) → session`, machine à 12 états, barge-in, urgence fast-track, conflits de champs, transfert humain non négociable.
  - `services/voice-extraction.ts` / `voice-language.ts` : NLU à règles FR-QC/EN (extraction progressive avec confiance + evidence), langue par tour + dominante.
  - 6 scénarios golden (`data/voice-scenarios.ts`) verrouillés en CI et rejoués en direct dans `/status` ; UI `/voice-lab` (pas-à-pas, autoplay, mode libre).
  - Boucle de valeur : session → `Call` analysé par le même IntelligenceEngine/ActionEngine (`voice-convert.ts`) ; `VoiceSession` persistée (Prisma) avec purge Loi 25 (turns/events purgés, fields/telemetry conservés).
  - Latences SIMULÉES, marquées `simulated:true` partout — les cibles p50/p95 restent des hypothèses jusqu'à P2B.
- **P2B 🔧 — code complet, premier appel réel en attente d'un numéro Twilio.**
  - `src/app/api/voice/incoming` : webhook Twilio signé (HMAC vérifié, falsification → 403), TwiML `<Connect><Stream>` vers le pont, **repli `<Dial>` vers l'humain si le realtime est absent — le téléphone ne casse jamais**.
  - `realtime/` : pont scaly-realtime (Node long-lived, `npm run realtime`) — Twilio Media Streams ↔ OpenAI Realtime, µ-law 8 kHz passthrough (zéro transcodage), VAD serveur + barge-in (response.cancel + clear), outil `transfer_to_human` → redirection REST Twilio, **latences RÉELLES mesurées par tour** (fin de parole → premier octet audio, `simulated:false`).
  - Prompt système (`src/services/voice-prompt.ts`) construit des MÊMES objets que le Voice Lab : divulgation IA, bilinguisme, urgences fast-track, interdits, **consentement de rappel (ADR-015)** — chaque garde-fou testé.
  - Fin d'appel → `/api/voice/complete` → Call `source:"live"` analysé par le même IntelligenceEngine/ActionEngine.
  - Vérifié le 2026-06-11 : compte Twilio ACTIF (créds valides), pont configuré, webhook signé OK. **Il manque : un numéro Twilio (achat ~1-2 $US/mois) + une URL publique (ngrok).**

## Runbook — premier appel réel
1. Acheter un numéro : Console Twilio → Phone Numbers → Buy (local QC, voix). Mettre `TWILIO_PHONE_NUMBER` à jour.
2. Exposer l'app et le pont : `ngrok http 3000` (app) et `ngrok http 8081` (pont) — ou un seul tunnel + reverse proxy.
3. `.env.local` : `SCALY_REALTIME_WS_URL=wss://<ngrok-pont>/twilio`, `SCALY_PUBLIC_URL=https://<ngrok-app>` (optionnel : sinon en-têtes x-forwarded), `REALTIME_SHARED_SECRET=<secret>` (les deux côtés).
4. Lancer : `npm run dev` (app) + `npm run realtime` (pont). Vérifier `http://localhost:8081/health` → `configured: true`.
5. Console Twilio → le numéro → Voice Configuration → Webhook `https://<ngrok-app>/api/voice/incoming` (POST).
6. Appeler le numéro. Attendus : accueil de Sophie < 1 s, transcript dans `/calls` (source `live`), latences réelles dans l'audit, « je veux parler à un humain » → transfert vers `transferPhone`.
7. Test de panne : arrêter le pont, rappeler → l'appel doit aboutir DIRECTEMENT à l'humain (repli `<Dial>`).
8. Ensuite : les 50 appels tests FR/EN du jalon 4 (urgences simulées incluses) avant tout client réel.

### Pile préparée (stubs honnêtes, plan B)
- `adapters/voice/types.ts` : interfaces `TelephonyProvider`, `SpeechToTextProvider`, `TextToSpeechProvider`, `RealtimeDialogueProvider`, `NotConfiguredError`.
- ElevenLabs / Whisper = stubs typés (plan B pipeline STT→LLM→TTS si la latence FR-QC d'OpenAI Realtime déçoit).

## Prototype A/B — ConversationRelay (voix fr-CA NATIVE)
Le plan B, version gérée par Twilio : `<Connect><ConversationRelay>` porte l'ASR
et la TTS (vraie voix canadienne-française — Polly Gabrielle par défaut), notre
relais (`realtime/relay-server.ts`, port 8082) ne voit que du texte et appelle
un LLM rapide en streaming. **Hypothèse à trancher À L'OREILLE** : accent
québécois authentique > voix OpenAI, sans payer trop cher en latence
(pipeline ASR→LLM→TTS contre audio↔audio).

- **Le champion n'est PAS touché** : même webhook, bascule par
  `SCALY_VOICE_ENGINE=relay` — on retire la variable, le champion reprend.
- Même contexte (`/api/voice/context`), même prompt champion + règles TTS
  (`withRelayTtsRules`), même persistance (`/api/voice/complete`, source `live`).
- L'accueil est parlé par Twilio (`welcomeGreeting`) et inscrit dans
  l'historique LLM — l'agente ne salue jamais deux fois.
- Barge-in : Twilio coupe la TTS lui-même (message `interrupt`) ; le relais
  avorte le flux LLM et tronque le transcript à ce qui a VRAIMENT été dit.
- Latence : `RelayLatencyMeter` mesure transcript→premier jeton (cerveau
  SEULEMENT — l'ASR final et la synthèse Twilio sont hors de notre vue). La
  comparaison se fait à l'oreille + logs Twilio, jamais sur `brainMs` seul.

### Runbook A/B
0. **Pré-requis une fois** : activer ConversationRelay (Console Twilio →
   Voice → ConversationRelay → onboarding, l'accès n'est PAS instantané).
1. Lancer le relais : `npm run relay` → `http://localhost:8082/health` doit
   dire `configured: true`. Tunnel : `ngrok http 8082`.
2. `.env.local` : `SCALY_VOICE_ENGINE=relay`,
   `SCALY_RELAY_WS_URL=wss://<ngrok-relay>/relay`. Optionnels :
   `SCALY_RELAY_TTS_PROVIDER` (déf. `Amazon`), `SCALY_RELAY_VOICE`
   (déf. `Gabrielle-Neural` ; essayer `Liam-Neural`, voix Google/ElevenLabs),
   `SCALY_RELAY_LANGUAGE` (déf. `fr-CA`), `SCALY_RELAY_STT_PROVIDER`
   (déf. `Google`), `SCALY_RELAY_SPEECH_MODEL`, `SCALY_RELAY_LLM_MODEL`
   (déf. `gpt-4.1-mini`), `REALTIME_RELAY_PORT` (déf. 8082).
3. Appeler le numéro. Comparer au champion sur la MÊME grille que les appels
   1-5 : accent/naturel de la voix, latence à l'oreille, coupures, chiffres et
   adresses, transfert humain. Noter sur 10, transcript dans `/calls`.
4. Retour au champion : retirer `SCALY_VOICE_ENGINE` (redémarrer l'app Next).
5. Limites connues du prototype : voix UNIQUE par appel (le bilinguisme FR→EN
   sonnera accenté tant qu'on n'envoie pas le message `language` en cours de
   session) ; pas de préambules parlés pendant la réflexion.

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
