# ⚠️ Rotation de secrets requise

Statut : **OUVERT** — à fermer une fois la rotation faite et vérifiée.

## Quoi

Le **mot de passe du rôle Postgres Neon** (`neondb_owner`, projet « Allô Maude »
`orange-scene-47199486`) a été affiché en clair dans un transcript de session
d'agent le 2026-07-02 (récupération de la chaîne de connexion pendant le
branchement de la base). Un transcript n'est pas un canal public, mais la règle
est simple : **un secret affiché est un secret compromis**.

Aucun secret n'est présent dans les fichiers suivis par git (`npm run
security:check` le vérifie), ni dans l'historique de commits.

## Procédure de rotation (10 minutes)

1. **Neon** : Console → projet « Allô Maude » → Roles → `neondb_owner` →
   *Reset password* (ou `neonctl roles …`). Copier la nouvelle URL **pooler**.
2. **Vercel** : Settings → Environment Variables → remplacer `DATABASE_URL`
   (Production + Preview) par la nouvelle URL → redéployer.
3. **Local** : remplacer `DATABASE_URL` dans `.env` **et** `.env.local`
   (attention : `.env.local` a priorité).
4. Vérifier : `npm run pilot:check` (aller-retour réel en base doit passer) et
   `https://<prod>/api/health?live=1`.
5. Fermer ce dossier : passer le statut à FERMÉ avec la date.

## Prévention en place

- `npm run security:check` — scanner local (fichiers .env trackés + motifs de
  credentials), branché en CI.
- `.env` / `.env.local` sont dans `.gitignore` (vérifié).
- Règle d'agent : ne jamais réafficher une chaîne de connexion ; utiliser des
  placeholders (`<masqué>`) dans toute sortie.
