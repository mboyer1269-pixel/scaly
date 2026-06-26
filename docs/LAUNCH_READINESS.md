# Allô Maude — Launch Readiness Report

Date d’exécution : 26 juin 2026
Branche : `codex/allo-maude-vertical-slice`

## Verdict

| Portée | Verdict | Motif |
|---|---|---|
| Démonstration locale guidée | **READY** | Le scénario vertical est persisté dans le repository partagé et relu dans les vraies surfaces. |
| Application locale sans démo | **UTILISABLE** | Préparation, couverture, réglages, appels, suivis, révisions et readiness sont accessibles indépendamment du simulateur. |
| Aperçu commercial persistant | **NOT READY** | Le mode mémoire est éphémère; l’aller-retour PostgreSQL n’a pas réussi. |
| Premier appel téléphonique réel | **NOT READY** | `pilot:check` échoue sur PostgreSQL inaccessible à `localhost:5432`; le transport IA temps réel reste non configuré. |
| Structure mobile pilote interne | **READY** | Expo, API mobile versionnée, confidentialité, deep links et metadata stores sont présents. |
| Soumission App Store / Google Play | **NOT READY** | Auth mobile native par utilisateur absente; audit Expo contient encore des vulnérabilités modérées transitives. |

Aucun défaut critique connu n’a été observé dans la tranche testée après correction des problèmes listés plus bas. Ce verdict ne prétend pas que les fournisseurs externes, les stores mobiles ou un appel téléphonique réel ont été validés.

## Preuve verticale exécutée

Scénario : `Critical water damage`  
Source : `simulator`  
Seed : `0`

Résultat relu dans le navigateur :

- appel `call_comp_belair_s0` en français;
- urgence critique détectée;
- téléphone et adresse capturés;
- transfert humain demandé;
- 3 actions persistées;
- 1 élément de révision persisté;
- audit enregistré;
- statut `Simulé` dérivé de la provenance;
- appel présent dans Appels;
- actions présentes dans À suivre;
- révision présente dans À améliorer;
- Overview mis à jour;
- preuve présente dans Préparation démo.

La sauvegarde de la politique de couverture a également été exécutée depuis `/prepare`. Cette preuve couvre la persistance de la configuration, pas un routage téléphonique externe.

## Commandes exécutées

| Commande | Résultat |
|---|---|
| `npm run typecheck` | PASS |
| `npm test -- --reporter=dot` | PASS — 34 fichiers, 258 tests |
| `npm run build` | PASS — build Next.js complet |
| `npm run demo:check` | PASS local; aperçu commercial refusé en mémoire |
| `npm run mobile:check` | PASS structure mobile; stores refusés honnêtement |
| `npm --prefix apps/mobile run typecheck` | PASS |
| `npm audit --json` | PASS — 0 vulnérabilité racine |
| `npm --prefix apps/mobile audit --json` | FAIL — 10 vulnérabilités modérées Expo transitives |
| `npm run pilot:check` | FAIL attendu et bloquant — PostgreSQL inaccessible à `localhost:5432` |
| Smoke HTTP local `127.0.0.1:3017` | PASS — 14 routes/API principales en HTTP 200 |

## Vérification navigateur

Routes inspectées sur `http://127.0.0.1:3017` :

- `/allo-maude`
- `/prepare`
- `/simulator`
- `/calls`
- `/follow-up`
- `/learn`
- `/dashboard`
- `/readiness/demo`
- `/readiness/live`
- `/readiness/mobile`
- `/privacy`
- `/onboarding`
- `/api/health`
- `/api/mobile/v1/overview`

Résultat :

- contraste et contenu lisibles sur la page publique;
- frontière de marque Allô Maude respectée;
- Scaly limité au contexte technique;
- aucun échec HTTP détecté sur les routes fumées;
- navigation vers les preuves persistées fonctionnelle;
- readiness démo, readiness appels réels et readiness mobile séparés.

## Corrections appliquées pendant l’audit

- Anti-IDOR ajouté sur `/api/voice-lab/save` : une session forgée ne peut plus être sauvegardée dans un autre tenant, sauf rôle `founder`.
- Politique mobile fail-closed en production : les routes mobiles exigent `MOBILE_API_BEARER_TOKEN`, même si le web est en `SCALY_AUTH_MODE=demo-open`, sauf ouverture explicite `SCALY_MOBILE_AUTH_MODE=demo-open`.
- Readiness mobile séparée : structure pilote interne `READY`, soumission stores `NOT READY` tant que l’auth native utilisateur n’est pas branchée.
- Suppression de compte corrigée : les compteurs `readinessEvidence` et `usagePeriods` sont séparés; suppression Prisma intégrée dans une transaction unique.
- Garde SSRF onboarding durcie contre les IPv4 mappées IPv6 (`::ffff:127.0.0.1`) et les IPv6 littérales.
- Checkout Stripe durci : URLs de retour dérivées de `SCALY_PUBLIC_URL` ou de l’URL serveur, pas d’un header `Origin` hostile.
- Frontière de marque corrigée dans Stripe : les noms produits visibles client utilisent Allô Maude, pas Scaly.

## Blocages avant un pilote réel

1. Démarrer ou fournir PostgreSQL, appliquer les migrations et réussir l’aller-retour `verifyLive`.
2. Activer l’authentification et affecter explicitement chaque session à un tenant.
3. Configurer et vérifier le transport voix temps réel; l’état actuel utilise seulement le repli humain `<Dial>`.
4. Implémenter le mapping numéro Twilio → `companyId` avant un deuxième client.
5. Configurer `CRON_SECRET` pour automatiser la purge Loi 25.
6. Exécuter un appel réel bout en bout et enregistrer sa preuve externe avant d’utiliser le statut `Vérifié`.
7. Remplacer le bearer mobile partagé par une authentification native par utilisateur avant soumission App Store / Google Play.
8. Résoudre les 10 vulnérabilités modérées transitives Expo avant dépôt stores.

## Commande de lancement

```bash
npm run app:local
```

URL : `http://127.0.0.1:3000/allo-maude`

Ce mode force `STORE_PROVIDER=memory`. Il est adapté à la démonstration locale uniquement.
