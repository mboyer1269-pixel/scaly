# Allô Maude — MVP commercial : parcours A à Z

Allô Maude est la couche commerciale du moteur Scaly : une réceptionniste IA nommée Maude, en français québécois, pour les PME de services (plombiers, garages, salons, entrepreneurs). Ce document décrit le parcours complet d'un appel, les limites honnêtes du MVP et les prochaines étapes.

---

## Parcours A à Z — un appel réel

### 1. Client appelle le numéro Twilio de la PME

Twilio reçoit l'appel et appelle le webhook `POST /api/voice/incoming` (signé HMAC).

- Si `SCALY_REALTIME_WS_URL` est absent : repli `<Dial>` vers le numéro humain. Le téléphone ne casse jamais.
- Sinon : TwiML `<Connect><Stream>` vers `scaly-realtime` (pont Node long-lived).

### 2. Le pont scaly-realtime s'ouvre

`realtime/server.ts` reçoit la connexion WebSocket Twilio, puis :

1. Appelle `GET /api/voice/context?companyId=…&from=…` pour obtenir :
   - `company` (profil PME : services, heures, zone, politiques)
   - `agent` (Maude : persona, greeting, script, règles)
   - `script` (questions de qualification, urgences, objections)
   - `callerMemory` (dossier si le numéro a déjà appelé — mémoire inter-appels)

2. Construit le prompt système via `buildRealtimePrompt()` :
   - Identité + divulgation IA (non négociable)
   - Voix québécoise, règles d'or, anti-hallucination
   - Dossier client si connu (historique, champs confirmés, suivi ouvert)
   - Script de qualification : questions dans l'ordre, champs déjà connus marqués "CONFIRMER"
   - Urgences fast-track, transfert humain non négociable, consentement de rappel

3. Ouvre une session OpenAI Realtime (`gpt-realtime`, audio µ-law 8 kHz, VAD serveur).

4. Maude accueille en premier (response.create déclenché dès l'ouverture).

### 3. La conversation

Maude collecte UNE information à la fois, dans l'ordre du script :
- **Nom** (sauf si déjà au dossier → confirmation)
- **Téléphone** (sauf si connu par l'afficheur → confirmation)
- **Description du besoin**
- **Adresse** (si intervention à domicile)
- **Urgence** (évaluée en continu, fast-track si critique)
- **Moment souhaité**

Règles conversationnelles :
- Émotion avant procédure (urgence → empathie + consigne de sécurité d'abord)
- Réponse aux questions de l'appelant avant de reprendre la qualification
- Numéros répétés par groupes et confirmés
- Transfert humain sur demande, sans insistance

À la fin : question de consentement de rappel (ADR-015, CRTC).

### 4. Fin d'appel → `POST /api/voice/complete`

Le pont envoie le transcript + métadonnées au webhook Next.js :

- Création d'un `Call` (source `"live"`) avec transcript complet
- Analyse par `IntelligenceEngine` : intent, urgence, sentiment, leadQuality, score commercial, résumé, nextAction, finalStatus, collectedFields
- Planification des actions via `ActionEngine` : SMS de suivi, rescue SMS si appel manqué
- Coffre de consentements : la réponse captée devient un `ConsentRecord` opposable
- SMS de contexte envoyé à l'humain si transfert (évite que le client répète son problème)
- Audit trail complet

### 5. Le propriétaire reçoit un SMS de résumé

Format : `Scaly — [CHAUD/TIÈDE/FROID] : [Nom] · [Résumé court] · [Numéro de rappel]`

Le SMS est envoyé par Twilio via `sendSms()` vers `company.transferPhone`. Nécessite `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_PHONE_NUMBER`.

### 6. Dashboard `/calls`

La fiche d'appel est visible immédiatement :
- Résumé, intent, urgence, qualité de lead, score commercial
- Transcript complet (purgeable selon `retentionDays`)
- Actions planifiées + audit trail
- Bouton de rappel (ouvre l'app téléphone)

---

## Configuration requise (infra)

| Variable | Rôle | Obligatoire |
|---|---|---|
| `OPENAI_API_KEY` | Session Realtime OpenAI | Oui (voix réelle) |
| `TWILIO_ACCOUNT_SID` | Authentification Twilio | Oui (appels) |
| `TWILIO_AUTH_TOKEN` | Signature webhook + SMS | Oui (prod) |
| `TWILIO_PHONE_NUMBER` | Numéro Twilio affiché | Oui |
| `SCALY_REALTIME_WS_URL` | URL du pont realtime (`wss://…/twilio`) | Oui |
| `SCALY_APP_URL` | URL interne de l'app Next.js (utilisée par le pont pour `/api/voice/context` et `/api/voice/complete`) | Oui (pont distant) |
| `SCALY_PUBLIC_URL` | URL publique app (signature HMAC Twilio) | Recommandé |
| `REALTIME_SHARED_SECRET` | Sécurité pont ↔ app (`/api/voice/context` + `/api/voice/complete` retournent 503 sans lui en prod) | **Requis (prod)** |
| `DATABASE_URL` + `STORE_PROVIDER=prisma` | Persistance Postgres | Optionnel (mémoire sinon) |
| `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Auth | Optionnel (dev ouvert sinon) |

### Lancer en local

```bash
# Terminal 1 — app Next.js
npm run dev

# Terminal 2 — pont realtime
npm run realtime

# Terminal 3 — tunnels (adapter les ports)
ngrok http 3000   # → SCALY_PUBLIC_URL
ngrok http 8081   # → SCALY_REALTIME_WS_URL (wss://xxxx.ngrok.io/twilio)
```

Configurer le webhook Twilio : Console Twilio → numéro → Voice → Webhook POST = `https://<ngrok-app>/api/voice/incoming`

---

## Profil Maude (démo)

La compagnie de démo `comp_maude` et son agente `Maude` sont seedées dans `src/data/companies.ts` :

- **Secteur** : services_domicile (qualification généraliste PME)
- **Persona** : chaleureuse, québécoise naturelle, calme sous pression
- **Greeting** : *"Bonjour ! Ici Maude de {company}. Comment je peux vous aider aujourd'hui ?"*
- **Closing** : *"Parfait, j'ai tout noté ! Vous allez recevoir un résumé par texto très bientôt."*
- **Script** : script_domicile (nom, téléphone, description, adresse, moment)

Pour créer un profil Maude pour une vraie PME : `/onboarding` → coller l'URL du site + 2 phrases → brouillon généré et éditable.

---

## Secteurs couverts (scripts existants)

| Secteur | Script ID | Champs clés |
|---|---|---|
| Plombiers / chauffagistes | `script_domicile` | nom, téléphone, adresse, description, moment |
| Garages / mécaniciens | `script_garage` | nom, téléphone, véhicule, description, moment |
| Salons / esthéticiens | `script_salon` | nom, téléphone, description (service), moment |
| Entrepreneurs / rénovation | `script_construction` | nom, téléphone, adresse, description, budget |
| Entretien / nettoyage | `script_nettoyage` | nom, téléphone, adresse, description, moment |
| Maintenance / HVAC | `script_maintenance` | nom, téléphone, adresse, description, moment |

---

## Limites honnêtes du MVP

| Limite | Détail |
|---|---|
| **Disponibilité** | Dépend de l'infra (Vercel + pont realtime long-lived). Aucun SLA garanti dans la version pilote. |
| **Latence** | Cible < 800 ms perçue (p50). Mesuré à 211-386 ms (champion gpt-realtime + server_vad). Non garanti en production. |
| **Multi-tenant** | Mono-tenant par défaut (`DEFAULT_COMPANY_ID`). RLS Postgres différé (ADR-016). |
| **SMS** | Nécessite Twilio configuré. Sans clés → préparé mais non envoyé (loggué). |
| **Enregistrement** | Transcription OpenAI Whisper uniquement. Pas d'enregistrement audio (recordingEnabled: false). |
| **Calendrier** | Prise de RDV = collecte du moment souhaité seulement. Aucune intégration Calendar en MVP. |
| **Relance saisonnière** | Opt-in exprès requis (ADR-015 palier 3) — non implémenté. |
| **Multi-langue EN** | Scripts EN partiels (questions principales seulement). Scripts EN complets = P5. |
| **Voix** | Champion : gpt-realtime (voix OpenAI). Voix fr-CA native (Polly Gabrielle) en A/B test (PR #11, ouverte). |
| **Consentement live** | `consentFromCall()` extrait le consentement via `intelligence.collectedFields`. En appel live, ces champs sont inférés du transcript par rules-v1 (non garanti si la formulation sort du lexique connu). |
| **Simulateur démo** | `/simulator` utilise `DEFAULT_COMPANY_ID` (Plomberie Bélair/Sophie). La démo Maude (`comp_maude`) n'est pas sélectionnable via l'URL publique en MVP. |

---

## Prochaines étapes (ordre de ROI)

1. **Numéro Twilio par PME pilote** — un numéro = un profil. Mapping numéro → companyId dans le store.
2. **Rappel vocal d'appel manqué < 2 min** (ADR-015 palier 1) — ROI le plus visible.
3. **Onboarding self-serve** — `/onboarding` crée une vraie company + agente Maude. Actuellement : brouillon appliqué sur DEFAULT_COMPANY_ID.
4. **A/B voix** — trancher gpt-realtime vs ConversationRelay (Polly Gabrielle fr-CA) à l'oreille.
5. **Multi-tenant complet** — claim Clerk `companyId` + RLS Postgres (ADR-016 prérequis).
6. **Calendrier** — intégration Google Calendar pour la prise de RDV réelle.
7. **Page `/allo-maude` + domaine** — publier sur `allomau.de` ou sous-domaine Vercel.

---

## Tests disponibles

```bash
# Suite complète (186 tests)
npm test

# Tests ciblés par domaine
npm test -- tests/voice-prompt.test.ts      # Prompt + dossier client
npm test -- tests/caller-memory.test.ts     # Mémoire inter-appels
npm test -- tests/voice-scenarios.test.ts   # Scénarios golden (6 cas FR-QC)
npm test -- tests/consent.test.ts           # Consentement + révocation
npm test -- tests/rescue.test.ts            # SMS rescue + CRTC
npm test -- tests/golden-set.test.ts        # Intelligence ≥ 90 % (53 appels annotés)
```

Le simulateur (`/simulator`) permet de rejouer n'importe quel scénario sans téléphone.
Le Voice Lab (`/voice-lab`) teste le cerveau conversationnel étape par étape.
