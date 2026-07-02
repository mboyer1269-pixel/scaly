# Revenue Recovery OS v1 — gap recovery loop + Opportunités + ROI + sécurité

## Résumé produit

Allô Maude ne se contente plus de répondre au téléphone : elle **récupère l'argent
qui fuit** — annulations, appels manqués, leads qui refroidissent, suivis oubliés.
Cette PR livre la boucle complète « Remplissage intelligent des annulations »
(capability `appointment_gap_recovery`) et les trois surfaces qui la rendent
vendable, avec consentement, audit et FR-CA de bout en bout.

Boucle démontrable en 5 minutes : appel entrant → « appelez-moi si une place se
libère » capté → plage libérée ouverte en 5 secondes → SMS consenti aux bons
candidats (max 3, premier OUI l'emporte) → confirmation automatique par texto →
les non-retenus prévenus honnêtement → notification « 🎉 Plage comblée » + ROI.

## Surfaces livrées

- **/annulations** — formulaire « une plage vient de se libérer ? », liste
  d'attente captée en appel (consentement visible), fil plages→offres avec
  badges, actions « A dit oui / A dit non / Retirer », valeur récupérée estimée,
  « Pourquoi » chaque candidat a été choisi. Zéro mensonge sans Twilio (tout
  reste `prepared`, dit tel quel).
- **/opportunites** — Smart Recovery Queue : une file unique triée (urgence
  puis valeur) — appels à sauver, annulations à remplir, clients à rattraper,
  soumissions dues, leads chauds, décisions en attente. Raison + valeur +
  prochaine action par item.
- **/roi** — pourquoi le client paie, en 10 secondes : valeur protégée
  (déclaré vs estimé distingués), multiple du forfait, annulations comblées,
  encore à risque, consentements, blocages montrés.

## Moteur (nouveaux modules)

- Capability registry (`domain/capability`, `data/capabilities`) — les packs
  déclarent, le moteur exécute ; capability inconnue = échec propre.
- 4 industry packs au contrat identique (concessionnaire, dentaire, clinique
  privée/esthétique, PME générale = repli universel).
- Modèles persistés `WaitlistEntry` / `AppointmentGap` / `RecoveryOffer`
  (companyId obligatoire, idempotence par clé unique, annulation idempotente,
  migration additive `20260702000000_gap_recovery` — **déjà appliquée sur la
  base Neon de prod**).
- OUI/NON entrant dans `/api/sms/incoming` (après STOP, avant digest owner),
  réponses tardives honnêtes, courtoisie « plage prise » aux non-retenus avec
  consent gate revérifié à l'envoi, expiration 48 h (cron + paresseuse).

## Sécurité / conformité

- `npm run security:check` (branché en CI) — interdit tout `.env` tracké,
  détecte les motifs de credentials dans les fichiers suivis.
- **`SECURITY_ROTATION_REQUIRED.md` : rotation du mot de passe Neon REQUISE**
  (affiché dans un transcript d'agent → traité comme compromis). À faire avant
  ou juste après merge — procédure en 5 étapes incluse.
- STOP/révocation prioritaire sur tout (y compris la courtoisie), consentement
  verbatim (ADR-018), purge Loi 25 étendue aux notes d'intention de la liste
  d'attente, rate limiting sur les routes qui déclenchent des SMS.
- `docs/SECURITY_READINESS.md` — état honnête (en place / partiel / manquant).

## Validation

- `npm run security:check` : ✅ 351 fichiers, aucun secret
- `npm run typecheck` : ✅
- `npm test` : ✅ 507/507 (59 fichiers)
- `npm run build` : ✅
- `npx prisma validate` : ✅
- `npm run pilot:check` : 🟡 WARN attendu (pont realtime local non démarré —
  repli `<Dial>` actif, le téléphone ne casse pas) ; tout le reste PASS,
  aller-retour Neon réel inclus.

## Limites honnêtes

- La réponse OUI ne marche en prod qu'après déploiement de cette branche (le
  webhook SMS Twilio pointe déjà sur `/api/sms/incoming` prod).
- Pas de calendrier/PMS/DMS : la plage est décrite en mots (« jeudi 14 h ») —
  c'est le choix v1, l'adapter calendrier viendra après validation marché.
- Valeurs ROI = montants mentionnés en appel ou barème d'industrie (hypothèse
  affichée comme telle, à recalibrer par client).
- Rate limiting en mémoire par instance (suffisant pilote, pas anti-DDoS).
- Ouverture de plage manuelle (l'ouverture auto sur appel d'annulation analysé
  est un P2).

## Plan smoke test — 819 414-1269 (après merge + deploy)

1. `npm run realtime` + ngrok, `SCALY_REALTIME_WS_URL` posée (sinon repli
   humain — acceptable pour tester la boucle SMS seule).
2. Appeler le 819 414-1269 : « Je peux venir plus tôt si quelqu'un annule »,
   consentir au texto quand Maude le demande, raccrocher.
3. Vérifier `/annulations` : l'entrée apparaît avec « SMS ok ».
4. Ouvrir une plage (« demain 14 h ») → le SMS d'offre part au numéro capté.
5. Répondre **OUI** → offre confirmée, plage « Comblée ✓ », notification
   « 🎉 Plage comblée », `/roi` reflète la valeur.
6. Répondre **STOP** depuis un autre scénario → plus aucun envoi, registre
   des consentements à jour.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
