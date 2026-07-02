# Modes pilotes — human_fallback / shadow_mode / realtime_ai

> Le mode est déterminé par la configuration, pas par le code : le MÊME webhook
> (`/api/voice/incoming`) sert les trois, et depuis l'Event Boundary v1
> (ADR-020) les trois produisent les MÊMES événements de base — on passe d'un
> mode à l'autre **sans recoder la persistance**.

**Pourquoi ton appel tombe en fallback aujourd'hui** : `SCALY_REALTIME_WS_URL`
n'est pas configurée en production Vercel. Ce n'est pas un bug — c'est le mode
`human_fallback` assumé. Le pont realtime (`npm run realtime`) est un processus
WebSocket long-vécu que Vercel ne peut pas héberger : il tourne aujourd'hui en
local via ngrok seulement. Pour passer en `realtime_ai` en prod, il faut
héberger le pont (Fly.io/Railway/VPS) et poser son URL `wss://` dans Vercel.

---

## 1. `human_fallback` — le mode actuel en production

**Déclencheur** : `SCALY_REALTIME_WS_URL` absente (ou pont injoignable en plein
appel — même résultat via le callback `action`).

**Promesse client honnête** : « Votre numéro d'affaires ne manque plus jamais
un appel : chaque appel entrant est transféré à votre équipe, tracé, et visible
dans votre tableau de bord. » **On ne vend PAS l'IA vocale dans ce mode.**

**Comportement technique** : webhook signé → résolution du tenant → court
message d'accueil → `<Dial>` vers `transferPhone`. Le téléphone ne casse
jamais.

**Données produites** :
- `Call` persisté (status `transferred`, idempotent par callSid), preuve
  `live_call`, audit.
- Événements : `call.session_started` (engineConfigured=human_fallback),
  `runtime.realtime_unavailable`, `call.transferred`.
- PAS de transcript riche (une ligne générique), pas de consentement capté en
  appel, pas d'intelligence exploitable.

**Limites** : zéro qualification automatique, zéro capture de liste d'attente
en appel, le propriétaire répond lui-même. La boucle SMS gap-recovery
fonctionne quand même (saisie manuelle via /annulations).

**Quoi tester avant vente** : un appel réel aboutit chez l'humain en < 5 s ;
l'appel apparaît dans /calls ; `pilot:check` PASS partout sauf le WARN
transport (attendu).

---

## 2. `shadow_mode` — l'IA écoute et documente, l'humain parle

**Déclencheur** : `SCALY_REALTIME_WS_URL` posée, mais l'agente configurée pour
transférer immédiatement (politique de transfert agressive) OU pont actif avec
plafond de durée court. L'IA accueille, capte le contexte (nom, raison,
urgence, consentement), puis passe l'appel à l'humain.

**Promesse client honnête** : « Une assistante prend l'appel, note qui appelle
et pourquoi, demande le consentement de rappel, puis vous transfère l'appel
avec le contexte par texto. Vous parlez encore à tous vos clients — mais vous
ne perdez plus jamais le contexte. »

**Comportement technique** : `<Connect><Stream>` vers le pont → quelques tours
IA → `transfer_to_human` → SMS de contexte au propriétaire (déjà en place dans
`/api/voice/complete`) → `<Dial>`.

**Données produites** :
- `Call` complet avec transcript partiel réel + intelligence + checkpoints.
- Événements : `call.session_started`, `call.transferred` (engine=realtime),
  `consent.captured` si capté, `opportunity.detected` si signal.
- La liste d'attente (« appelez-moi si une place se libère ») EST captée.

**Limites** : latence du pont visible ; l'appelant parle à deux interlocuteurs ;
le plafond de durée doit être réglé pour ne pas frustrer.

**Quoi tester avant vente** : le transfert arrive avec le SMS de contexte ; le
consentement capté apparaît dans /consents ; l'entrée waitlist apparaît dans
/annulations ; les événements des deux chemins portent le même callSid.

---

## 3. `realtime_ai` — Maude prend l'appel au complet

**Déclencheur** : `SCALY_REALTIME_WS_URL` posée + pont sain + OpenAI configuré.

**Promesse client honnête** : « Maude répond 24/7 en français québécois,
qualifie l'appel, capte les demandes et les consentements, remplit les
annulations par texto, et transfère à un humain quand c'est important. » On dit
AUSSI : « si notre service a un pépin, l'appel est automatiquement transféré à
votre équipe — le téléphone ne casse jamais. »

**Comportement technique** : `<Connect><Stream>` → conversation complète →
`/api/voice/complete` → intelligence, actions, consentements, waitlist,
notifications, demandes d'avis. Panne en plein appel → callback `action` →
`<Dial>` + brouillon checkpointé préservé.

**Données produites** :
- Tout le pipeline : `Call` complet, actions, consentements, waitlist,
  notifications owner, review requests.
- Événements : `call.session_started`, `call.completed` (+ `call.transferred`
  si transfert), `consent.captured`, `opportunity.detected`,
  `recovery.gap_opened` / `offer_sent` / `offer_confirmed`,
  `owner.notification_sent`, `runtime.failure` si panne.

**Limites** : dépend d'un pont hébergé hors Vercel (processus WS long-vécu) ;
latence OpenAI Realtime réelle (~400 ms perçue mesurée) ; coût par minute ;
qualité fr-CA à valider par appels réels (premier appel noté 5-6/10, correctifs
empathie/VAD mergés — la boucle transcript→code continue).

**Quoi tester avant vente** : le smoke test complet du 819 414-1269 (plan dans
la PR #34) : appel → consentement → waitlist → plage → SMS → OUI → « Plage
comblée » → /roi. PLUS : couper le pont en plein appel et vérifier le repli
`<Dial>` + `runtime.failure` émis.

---

## Matrice de bascule (aucun code à changer)

| De → vers | Action |
|---|---|
| human_fallback → shadow/realtime | Héberger le pont, poser `SCALY_REALTIME_WS_URL` + `REALTIME_SHARED_SECRET` (les deux côtés) + `OPENAI_API_KEY`, redéployer |
| realtime → human_fallback (urgence) | Retirer `SCALY_REALTIME_WS_URL`, redéployer — runbook existant |
| shadow ↔ realtime | Régler la politique de transfert de l'agente (config, pas code) |

Les événements de la frontière restent identiques dans les trois modes — c'est
la garantie ADR-020 : Oria consommera la même chose, peu importe le mode.
