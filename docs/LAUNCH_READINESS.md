# Allô Maude — Launch Readiness Report

Date d'exécution : 30 juin 2026
Branche : `main`
Dernières PR : https://github.com/mboyer1269-pixel/scaly/pull/16, https://github.com/mboyer1269-pixel/scaly/pull/17

## Verdict

| Portée | Verdict | Motif |
|---|---|---|
| Démonstration locale guidée | **READY** | Le flow vertical reste couvert par `demo:check` et les tests. |
| Application web protégée | **READY / CLAIMS PROD À CONFIRMER** | Clerk actif avec `SCALY_AUTH_MODE=required`; les claims `role` et `companyId` de l'utilisateur pilote doivent être confirmés côté Clerk production. |
| Persistance commerciale | **READY** | Prisma/Postgres vérifié avec Neon par aller-retour live. |
| Premier appel téléphonique réel | **VERIFIED EN REPLI HUMAIN** | Twilio signé, tenant résolu par numéro appelé, fallback `<Dial>` actif; appel réel persisté et preuve `live_call` vérifiée. |
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

## Preuve terrain

Premier appel réel vérifié en repli humain :

- heure : 2026-06-30T02:17:26.494Z;
- tenant : `comp_belair`;
- callId : `call_twilio_CA3f3e533a6a5bf615b17869ad5c37bbb1`;
- Twilio externalId : `CA3f3e533a6a5bf615b17869ad5c37bbb1`;
- statut appel : `transferred`;
- source : `live`;
- preuve readiness : `evidence_call_twilio_CA3f3e533a6a5bf615b17869ad5c37bbb1`, statut `verified`.

## Ce qui est réellement prêt

- Clerk est intégré dans l'application existante; les routes sensibles bloquent le fallback dangereux d'un non-founder sans `companyId`.
- Neon/Postgres est opérationnel derrière Prisma; `verifyLive()` fait écriture, relecture et suppression.
- Les routes de session sensibles filtrent par tenant résolu.
- Les webhooks Twilio voix/SMS résolvent le tenant par le numéro appelé (`To`/`Called`) et refusent les cas absents, non mappés ou ambigus.
- Les appels entrants sans realtime actif persistent une preuve de repli humain `source:"live"` et transfèrent vers `transferPhone`; ce chemin a été vérifié par un appel réel.
- Les états locaux d'outillage et secrets restent hors Git.

## Restants avant production publique

1. Confirmer les claims Clerk production du pilote : `publicMetadata.role` et `publicMetadata.companyId`.
2. Vérifier la première exécution Vercel Cron : `/api/cron/purge` et `/api/cron/digest` doivent recevoir `Authorization: Bearer <CRON_SECRET>`.
3. Brancher `SCALY_REALTIME_WS_URL` seulement quand le pont realtime est joignable et OpenAI configuré.
4. Faire les 50 appels tests FR/EN avec mesures de latence avant de vendre l'IA vocale comme vérifiée.
5. Répéter la preuve d'appel par tenant avant chaque ajout de client réel.
6. Ajouter RLS Postgres avant self-serve multi-client.

## Commande locale

```bash
npm run app:local
```

URL : `http://127.0.0.1:3000/allo-maude`

Ce mode force `STORE_PROVIDER=memory`. Il sert à la démonstration locale, pas au pilote persistant.
