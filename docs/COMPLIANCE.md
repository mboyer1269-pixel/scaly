# Conformité — base sérieuse (Québec / Canada)

> Honnêteté : ce document est une base de travail technique, PAS un avis juridique.
> Avant les premiers appels réels avec de vraies données personnelles : validation par un avocat (Loi 25). C'est un jalon bloquant de P2.

## Cadre applicable
- **Loi 25 (Québec)** : consentement, transparence sur les moyens technologiques, minimisation, droit à l'effacement, registre des incidents, responsable de la protection des renseignements personnels (RPRP) à désigner.
- **Loi 96 (Québec, Charte de la langue française)** : une entreprise qui sert le public au Québec doit pouvoir le servir EN FRANÇAIS. Une réceptionniste (humaine ou IA) anglophone-seulement expose l'entreprise à des plaintes à l'OQLF. **Côté Scaly c'est une force, pas une contrainte** : le français d'abord est notre défaut de conception (accueil FR, bascule EN sur demande de l'appelant — conforme), et chaque concurrent EN-only au Québec a un problème de Loi 96 que nous n'avons pas. Argument de vente documenté, à utiliser tel quel.
- **PIPEDA (fédéral)** : finalités, consentement, mesures de sécurité.
- **Enregistrement d'appels** : le Canada permet le consentement d'une seule partie, MAIS la transparence Loi 25 + la confiance client imposent l'annonce. Décision produit : mention d'enregistrement annoncée quand l'enregistrement est actif, point.

## Coffre de consentements (ADR-018) — implémenté
- Le consentement est un objet de première classe PAR PERSONNE (numéro canonique), plus seulement une note dans la fiche d'un appel : verbatim exact + canal + appel source + horodatage. Registre visible dans `/consents`.
- **Retrait aussi simple que le consentement** (exigence Loi 25) : un texto « STOP / ARRÊT » de n'importe quel appelant révoque tous ses consentements immédiatement, tracé dans l'audit, et la barrière de relance (J+2 et toute relance future) le respecte sans exception. Une révocation n'est jamais ressuscitée par automatisme.
- Le REFUS est enregistré au même titre que le oui : ne pas re-solliciter quelqu'un qui a dit non.

## Ce qui est DÉJÀ implémenté (P0)
- `CompliancePolicy` par entreprise : divulgation IA, enregistrement on/off, mention d'enregistrement, rétention (jours), minimisation PII — modifiable dans l'UI Réglages.
- Divulgation IA dans les scripts d'accueil (« assistante virtuelle »).
- Audit trail : journal des modifications de configuration + audit par action (qui/quoi/quand).
- Séparation des tenants par `companyId` dans toutes les requêtes du repository.
- Règles de sécurité agent non négociables (jamais de carte de crédit/NAS, pas d'avis médical/juridique, transfert humain sur demande).
- `recordingUrl: null` tant que l'enregistrement réel n'existe pas — le type même du domaine interdit de prétendre.

## Ce qui est PRÉPARÉ (pas encore actif)
- Rétention : champ `retentionDays` présent ; le job de purge automatique arrive avec Postgres (P1).
- Droit à l'effacement : endpoint de suppression par appelant prévu en P1 (`DELETE /api/callers/:phone` — design).
- Registre d'incidents : structure `AdminIncident` en place, processus en P1.

## Avant les appels réels (bloquants P2)
1. Désigner le RPRP (fondateur au départ) + politique de confidentialité publiée.
2. DPA / conditions des sous-traitants : Twilio, OpenAI, ElevenLabs (transferts hors Québec → évaluation des facteurs, clauses contractuelles).
3. Résidence des données : Postgres en région canadienne ; transcriptions chez les providers IA = transfert à documenter et minimiser (pas d'envoi du numéro complet, pseudonymisation où possible).
4. Job de purge selon `retentionDays` + preuve de purge dans l'audit.
5. Chiffrement au repos (Postgres managé) et en transit (TLS partout) — standard, à vérifier.
