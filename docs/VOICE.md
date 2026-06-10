# Infrastructure vocale — plan P2

## État actuel (honnête)
- `adapters/voice/types.ts` : interfaces `TelephonyProvider`, `SpeechToTextProvider`, `TextToSpeechProvider`, `RealtimeDialogueProvider`, événements de session, `NotConfiguredError`.
- Seul `MockDialogueProvider` est opérationnel (texte). Twilio / OpenAI Realtime / ElevenLabs / Whisper = stubs typés qui échouent explicitement sans configuration.
- AUCUN appel téléphonique réel n'est possible aujourd'hui.

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
