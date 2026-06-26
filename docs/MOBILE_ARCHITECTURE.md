# Architecture mobile Allô Maude

Décision : l'application mobile est un compagnon opérationnel Expo. Elle ne remplace pas le workspace web.

## Source de vérité

- Web Next.js : onboarding, réglages, billing, simulation, readiness, API.
- PostgreSQL/Prisma : persistance commerciale.
- Expo mobile : consultation et actions rapides pour propriétaire de PME.

## Contrat API

Le mobile consomme uniquement `/api/mobile/v1/*`.

Endpoints actuels :

- `GET /api/mobile/v1/overview`
- `GET /api/mobile/v1/calls`
- `GET /api/mobile/v1/follow-up`
- `GET /api/mobile/v1/privacy/export`
- `POST /api/mobile/v1/privacy/delete-account`

Ces routes sont publiques au middleware Clerk, mais auto-protégées par bearer token côté route. En production, `MOBILE_API_BEARER_TOKEN` est requis, même si l'app web est volontairement en `SCALY_AUTH_MODE=demo-open`. Pour ouvrir volontairement les routes mobiles en démo locale/publique, il faut poser `SCALY_MOBILE_AUTH_MODE=demo-open`.

Important : ce bearer partagé est un mécanisme de pilote interne, pas une authentification commerciale multi-client. Le gate `mobile:check` sépare donc :

- `Structure mobile` : prête quand l'app Expo, les routes versionnées, la confidentialité et le bearer pilote existent.
- `Soumission App Store / Google Play` : non prête tant qu'une authentification utilisateur native n'est pas branchée.

## Portée MVP mobile

- Vue d'ensemble.
- Appels récents.
- Actions à suivre.
- Export de données.
- Suppression de compte.
- Deep link scheme `allomaude://`.

## Hors portée mobile v1

- Billing Stripe.
- Onboarding complet.
- Studio de simulation avancée.
- Admin/founder.
- Configuration téléphonique.

Ces surfaces restent web pour réduire le risque App Store / Play Store et garder un seul cockpit de configuration.

## Avant soumission stores

- Remplacer le bearer interne par auth native durable ou distribution pilot contrôlée.
- Ajouter assets finaux : icône, splash, captures d'écran.
- Résoudre/valider les vulnérabilités npm moderate d'Expo.
- Configurer comptes Apple Developer, Google Play Console, Expo/EAS.
- Tester build EAS iOS et Android.
