# Sécurité et conformité — état honnête

Dernière mise à jour : 2026-07-02. Ce document dit ce qui est EN PLACE, ce qui
est PARTIEL, et ce qui MANQUE avant un client entreprise. Pas de théâtre.

## En place (vérifié par tests ou gate)

| Contrôle | Où | Preuve |
| --- | --- | --- |
| Signature Twilio (voix + SMS) | `/api/voice/incoming`, `/api/sms/incoming` | `validateTwilioSignature`, tests `twilio.test.ts` ; 403 si invalide |
| STOP / opt-out prioritaire sur tout | `/api/sms/incoming` (traité AVANT toute logique) | `isRevocationMessage`, révocation du coffre entier ; tests `consent.test.ts` |
| Coffre de consentements (ADR-018) | `Consent` (par personne, verbatim, révocable) | un refus est FINAL ; consent gate re-vérifié À CHAQUE envoi (offres, suivis, courtoisie) |
| Isolation tenant | `resolveCompanyId()` session (ADR-017) + `companyId` sur toute table | tests `tenant.test.ts`, `pr2-auth-tenant`, `pr3-twilio-tenant`, cross-tenant gap recovery |
| Purge Loi 25 | `/api/cron/purge` (transcripts, sessions vocales, notes d'intention waitlist) | rétention par tenant (`compliance.retentionDays`) ; tests `purge.test.ts`, `gap-recovery.test.ts` |
| Suppression de compte | `deleteCompanyData` (tous les moteurs, audit dé-tenanté) | tests `privacy.test.ts` |
| Secrets webhooks internes | `REALTIME_SHARED_SECRET` (obligatoire en prod), `CRON_SECRET` | 503 honnête si absents |
| Rate limiting | onboarding, checkout, simulate, gap-recovery gaps/offers | fenêtre glissante en mémoire (limite PAR INSTANCE — voir Limites) |
| Scanner anti-secret | `npm run security:check` (CI) | fichiers .env trackés interdits + motifs credentials |
| Audit trail | `AuditLog` (+ audit par action) | événements par étape gap recovery ; consultable via `getAuditLog` |

## Partiel

- **Rate limiting** : en mémoire par instance serverless — un plafond global
  exigerait Upstash/Redis ou le WAF Vercel. Suffisant pilote, pas anti-DDoS.
- **Audit viewer** : le journal existe (`AuditLog`, lisible via le store et la
  page /status en partie) mais il n'y a pas encore de page owner-facing dédiée
  filtrable par entité. Format stable : `{ at, companyId, actor, event, detail }`.
- **RBAC** : founder/owner/staff via Clerk `publicMetadata.role` — les routes
  founder sont protégées ; la granularité fine par action reste à faire.
- **Rotation de secrets** : procédure documentée (SECURITY_ROTATION_REQUIRED.md)
  mais manuelle — pas de gestionnaire de secrets ni de rotation automatique.

## Manquant avant un client « enterprise » / SOC 2

1. **RLS Postgres** (défense en profondeur sous Prisma) — décision ADR-016 :
   différé tant que chaque requête passe par `resolveCompanyId()` testé.
2. **Chiffrement applicatif des verbatims** (transcripts/consentements sont en
   clair dans Postgres ; Neon chiffre au repos, mais pas de chiffrement par
   tenant).
3. **Gestion de secrets centralisée** (Vercel env aujourd'hui ; pas de vault).
4. **Journalisation d'accès** (qui a LU quoi — on journalise les écritures).
5. **Programme SOC 2 / pentest tiers** — rien d'engagé ; ne pas le prétendre.
6. **DPA / sous-traitants** : OpenAI, Twilio, Neon, Vercel, Clerk à documenter
   dans la politique de confidentialité client.

## Règles d'or opérationnelles

- Un secret affiché (log, transcript, ticket) = compromis → rotation.
- Jamais de vraie clé dans un fichier tracké — `security:check` casse la CI.
- Tout SMS sortant commercial passe par le consent gate ; STOP l'emporte sur tout.
- Les claims marché dans les docs sont sourcées ou marquées « estimation ».
