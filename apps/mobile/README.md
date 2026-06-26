# Allô Maude mobile

Application compagnon Expo pour les propriétaires de PME.

Portée MVP :

- Vue d'ensemble opérationnelle.
- Appels récents.
- Actions à suivre.
- Export et suppression des données.
- Deep links `allomaude://`.
- Notifications prévues pour urgences et actions critiques.

Le web Next.js reste le backend et la source de vérité. L'app mobile consomme `/api/mobile/v1/*`.

État d'authentification :

- Le token `EXPO_PUBLIC_MOBILE_API_BEARER_TOKEN` sert seulement à un pilote interne contrôlé.
- Avant une publication App Store / Google Play multi-client, remplacer ce bearer partagé par une authentification utilisateur native.

Commandes :

```bash
npm install
npm run start
```

Avant stores :

```bash
npx eas-cli@latest init
npx eas-cli@latest build --profile production
```
