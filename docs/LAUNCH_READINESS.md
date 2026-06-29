# Allô Maude — Launch Readiness Report

Date d'exécution : 29 juin 2026
Branche : `codex/production-readiness-cleanup`
PR : https://github.com/mboyer1269-pixel/scaly/pull/16

## Verdict

| Portée | Verdict | Motif |
|---|---|---|
| Démonstration locale guidée | **READY** | Le flow vertical reste couvert par `demo:check` et les tests. |
| Application web protégée | **READY DEV / À CONFIGURER PROD** | Clerk dev actif, `SCALY_AUTH_MODE=required` testé; Clerk production doit recevoir ses clés et claims. |
| Persistance commerciale | **READY** | Prisma/Postgres vérifié avec Neon par aller-retour live. |
| Premier appel téléphonique réel | **READY EN REPLI HUMAIN** | Twilio signé, tenant résolu par numéro appelé, fallback `<Dial>` actif; preuve d'appel réel à exécuter. |
| IA vocale temps réel | **NOT READY PROD** | `SCALY_REALTIME_WS_URL` absent; le téléphone fonctionne sans IA via repli humain. |
| Purge/digest automatisés | **READY APRÈS DÉPLOIEMENT CRON** | `CRON_SECRET` est configuré sur Vercel; `vercel.json` déclare purge et digest. |

## Commandes vérifiées

| Commande | Résultat |
|---|---|
| `npm run db:generate` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 36 fichiers, 274 tests |
| `npm run build` | PASS |
| `npm audit --omit=dev` | PASS — 0 vulnérabilité |
| `npm run db:migrate` avec Neon | PASS — aucune migration en attente |
| `SCALY_AUTH_MODE=required STORE_PROVIDER=prisma DATABASE_URL=<Neon> npm run pilot:check` | PASS exit 0, verdict WARN attendu |

## Ce qui est réellement prêt

- Clerk est intégré dans l'application existante; les routes sensibles bloquent le fallback dangereux d'un non-founder sans `companyId`.
- Neon/Postgres est opérationnel derrière Prisma; `verifyLive()` fait écriture, relecture et suppression.
- Les routes de session sensibles filtrent par tenant résolu.
- Les webhooks Twilio voix/SMS résolvent le tenant par le numéro appelé (`To`/`Called`) et refusent les cas absents, non mappés ou ambigus.
- Les appels entrants sans realtime actif persistent une preuve de repli humain `source:"live"` et transfèrent vers `transferPhone`.
- Les états locaux d'outillage et secrets restent hors Git.

## Restants avant production publique

1. Confirmer les claims Clerk production du pilote : `publicMetadata.role` et `publicMetadata.companyId`.
2. Configurer un vrai numéro Twilio par tenant (`Company.twilioPhoneNumber`) et pointer le webhook vers `/api/voice/incoming`.
3. Exécuter un appel réel signé Twilio et vérifier : transfert humain, appel persisté, preuve readiness.
4. Vérifier la première exécution Vercel Cron : `/api/cron/purge` et `/api/cron/digest` doivent recevoir `Authorization: Bearer <CRON_SECRET>`.
5. Brancher `SCALY_REALTIME_WS_URL` seulement quand le pont realtime est joignable et OpenAI configuré.
6. Faire les 50 appels tests FR/EN avec mesures de latence avant de vendre l'IA vocale comme vérifiée.
7. Ajouter RLS Postgres avant self-serve multi-client.

## Commande locale

```bash
npm run app:local
```

URL : `http://127.0.0.1:3000/allo-maude`

Ce mode force `STORE_PROVIDER=memory`. Il sert à la démonstration locale, pas au pilote persistant.
