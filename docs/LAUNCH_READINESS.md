# Allô Maude — Launch Readiness Report

Date d’exécution : 25 juin 2026  
Branche : `codex/allo-maude-vertical-slice`

## Verdict

| Portée | Verdict | Motif |
|---|---|---|
| Démonstration locale guidée | **READY** | Le scénario vertical est persisté dans le repository partagé et relu dans les vraies surfaces. |
| Application locale sans démo | **UTILISABLE** | Préparation, couverture, réglages, appels, suivis, révisions et readiness sont accessibles indépendamment du simulateur. |
| Aperçu commercial persistant | **NOT READY** | Le mode mémoire est éphémère; l’aller-retour PostgreSQL n’a pas réussi. |
| Premier appel téléphonique réel | **NOT READY** | `pilot:check` échoue sur PostgreSQL inaccessible à `localhost:5432`; le transport IA temps réel reste non configuré. |

Aucun défaut critique connu n’a été observé dans la tranche testée. Ce verdict ne prétend pas que les fournisseurs externes ou un appel téléphonique réel ont été validés.

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

La sauvegarde de la politique de couverture a également été exécutée depuis `/prepare`.

## Commandes exécutées

| Commande | Résultat |
|---|---|
| `npm run typecheck` | PASS |
| `npm test` | PASS — 30 fichiers, 234 tests |
| `npm run build` | PASS — 24 pages générées, route `/allo-maude` incluse |
| `npm run demo:check` | PASS local; aperçu commercial refusé en mémoire |
| `npm run pilot:check` | FAIL attendu et bloquant — PostgreSQL inaccessible à `localhost:5432` |
| `npm run app:local -- --port 3017` | PASS — HTTP 200 sur `/allo-maude` |

Le premier typecheck lancé en parallèle du build a rencontré une course sur `.next/types`. Il a été rejoué séquentiellement après le build et a réussi.

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

Résultat :

- contraste et contenu lisibles sur la page publique;
- frontière de marque Allô Maude respectée;
- Scaly limité au contexte technique;
- aucune erreur console détectée;
- navigation vers les preuves persistées fonctionnelle;
- readiness démo et readiness appels réels séparés.

## Blocages avant un pilote réel

1. Démarrer ou fournir PostgreSQL, appliquer les migrations et réussir l’aller-retour `verifyLive`.
2. Activer l’authentification et affecter explicitement chaque session à un tenant.
3. Configurer et vérifier le transport voix temps réel; l’état actuel utilise seulement le repli humain `<Dial>`.
4. Implémenter le mapping numéro Twilio → `companyId` avant un deuxième client.
5. Configurer `CRON_SECRET` pour automatiser la purge Loi 25.
6. Exécuter un appel réel bout en bout et enregistrer sa preuve externe avant d’utiliser le statut `Vérifié`.

## Commande de lancement

```bash
npm run app:local
```

URL : `http://127.0.0.1:3000/allo-maude`

Ce mode force `STORE_PROVIDER=memory`. Il est adapté à la démonstration locale uniquement.
