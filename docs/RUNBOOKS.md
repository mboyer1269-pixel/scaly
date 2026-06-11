# Runbooks & SLA internes (P4)

Objectifs internes pour la phase pilote — pas des SLA contractuels publiés.
Règle générale : le téléphone du client ne casse JAMAIS en silence (le repli
`<Dial>` transfère à l'humain si la pile IA tombe).

## SLA internes (pilote)

| Domaine | Cible | Mesure |
|---|---|---|
| Réponse aux appels (quand Twilio est up) | 100 % décrochés ou repli `<Dial>` | journaux Twilio + audit |
| Rappel d'appel manqué | SMS < 2 min | horodatage action vs appel |
| Pouls quotidien | envoyé chaque jour à l'heure configurée ± 15 min | audit `pouls_quotidien` |
| Webhook Stripe | appliqué < 1 min après l'événement | dashboard Stripe (livraisons) |
| Incident majeur (téléphonie morte) | mitigation < 30 min ouvrées | ce runbook |
| Restauration de données | sauvegardes du fournisseur Postgres (Neon : PITR) | test de restauration trimestriel |

## Runbook 1 — La téléphonie ne répond plus

1. **Vérifier le repli d'abord** : appeler le numéro. Si `<Dial>` transfère à
   l'humain, le client est dégradé mais pas cassé — sévérité mineure.
2. Consulter le dashboard Twilio (statut des webhooks, erreurs 11200).
3. Causes fréquentes : URL publique changée (ngrok redémarré → mettre à jour
   `SCALY_PUBLIC_URL` et la config du numéro), pont realtime tombé
   (`npm run realtime`, vérifier `SCALY_REALTIME_WS_URL`), quota OpenAI.
4. Si le pont est instable : retirer `SCALY_REALTIME_WS_URL` → le webhook sert
   le repli `<Dial>` systématique. Le téléphone marche, l'IA est en pause.
5. Post-mortem dans l'audit + entrée incident dans /status.

## Runbook 2 — Le webhook Stripe échoue (abonnements désynchronisés)

1. Dashboard Stripe → Développeurs → Webhooks : examiner les livraisons en
   échec (signature ? 5xx ? URL ?).
2. Signature invalide = `STRIPE_WEBHOOK_SECRET` désynchronisé (régénéré dans
   Stripe sans mise à jour de l'env, ou l'inverse). Resynchroniser, redéployer.
3. Stripe retente automatiquement pendant 3 jours ; le handler est idempotent
   (dédup par id d'événement via l'audit) — relancer les livraisons échouées
   depuis le dashboard est SANS RISQUE.
4. Vérité de réconciliation : l'état dans Stripe fait foi. Comparer
   `company.billing` (carte Abonnement de /settings) au dashboard Stripe ;
   au besoin, relivrer le dernier événement d'abonnement depuis Stripe.
5. Ne JAMAIS éditer `planId`/`billing` à la main en base sans tracer une
   entrée d'audit expliquant pourquoi.

## Runbook 3 — Postgres indisponible

1. Symptôme : 500 sur tout l'app ; `/api/health` montre le store en erreur.
2. Vérifier le fournisseur (Neon : status page, compute suspendu, quota).
3. La téléphonie continue de répondre (repli `<Dial>` ne dépend pas de la
   base) ; les appels IA en cours peuvent perdre leur trace — assumé.
4. Si l'indisponibilité dure : `STORE_PROVIDER=memory` remet une démo
   fonctionnelle (SANS données clients) — uniquement pour montrer le produit,
   jamais pour servir un client réel.
5. Après rétablissement : vérifier `/status?live=1` (aller-retour réel) et la
   purge Loi 25 (`npm run db:purge`) si elle a sauté.

## Runbook 4 — Fuite ou soupçon de fuite de données (Loi 25)

1. Couper l'accès en cause (rotation de la clé/secret compromis en premier).
2. Inventorier : quelles tables, quelles périodes, quels renseignements
   personnels (transcripts = verbatims clients).
3. Loi 25 : registre des incidents OBLIGATOIRE ; notification à la CAI et aux
   personnes concernées si « risque de préjudice sérieux ». Consulter
   docs/COMPLIANCE.md et l'avis juridique (prérequis P2B).
4. La purge automatique limite l'exposition : vérifier que `retentionDays`
   était bien appliqué (audit `transcripts_purgés`).

## Posture sécurité P4 (état réel, sans théâtre)

- Webhooks/crons : signature Twilio, HMAC Stripe (rejeu refusé + idempotence),
  Bearer `CRON_SECRET`. Secrets jamais commités (`.env.example` fait foi).
- Rate limiting fenêtre glissante par instance : onboarding LLM 5/10 min,
  checkout 10/10 min, simulateur 30/10 min (ADR-016).
- SSRF : le fetch d'onboarding refuse loopback/privé/link-local/métadonnées
  cloud, redirections validées saut par saut (limite : pas de résolution DNS).
- Champs protégés serveur : `planId` et `billing` inaccessibles au
  `PUT /api/company` (réservés au webhook Stripe).
- RLS Postgres : différé au multi-tenant réel — décision et prérequis dans
  ADR-016.
- Auth : Clerk par feature flag (ADR-013) ; interdit de déployer public sans
  les clés. Webhooks externes et /pricing explicitement publics dans le
  middleware (ils s'auto-protègent).
