# Analyse marché — réceptionnistes IA vocales (juin 2026)

Recherche du 2026-06-11. Sources citées en bas. Règle de vérité : les prix et
faits ci-dessous viennent des sites/comparatifs publics à cette date — à
revérifier avant toute décision de prix.

## Le paysage

### États-Unis — marché encombré, EN d'abord
| Joueur | Positionnement | Prix affichés |
|---|---|---|
| Rosie | PME / services à domicile | 49 → 299 $US/mois |
| Goodcall | PME Google-centriques, EN seulement | 59-79 → 249 $US/mois |
| Smith.ai | Hybride IA + humains, pro/juridique | ~292 $US/mois ; EN + ES |
| Sameday AI | HVAC/plomberie, dispatch ServiceTitan | 449 $US/mois et + |
| Avoca | Plateforme home services (ServiceTitan) | n/d |

Constats : (1) le créneau « services à domicile » est validé — plusieurs
joueurs dédiés, prix soutenus ; (2) le français y est absent ou générique
(« 90+ langues » = STT/TTS génériques, pas le FR-QC parlé, pas la Loi 25,
pas le code-switching en plein appel) ; (3) **la relance sortante est en train
de devenir un standard** : rappel de lead < 3 s (« speed to lead » — 78 % des
clients achètent du premier répondant), relance de soumissions devenues
froides, rappels saisonniers, confirmations anti no-show.

### Québec — premiers joueurs, offre horizontale
- **Agent IA Vocal** (agentiavocal.ca) : bilingue FR/EN, 24/7, RDV, CRM,
  forfaits « dès 199 $CA/mois » mais prix non détaillés publiquement ; cible
  horizontale (dentistes, garages, restaurants, assurances…) ; aucune preuve
  de ROI chiffrée affichée, pas de SLA publié.
- CyberPerformance, Allesi : offres naissantes, peu de profondeur publiée.
- Les services humains traditionnels (réceptionnistes virtuelles) restent
  chers (>300 $/mois pour un volume sérieux) et ferment la nuit.

## Où Scaly gagne (et comment le prouver)

1. **FR-QC réel + bilinguisme démontré** — pas « multilingue » générique :
   code-switching en plein appel (scénario `vs_bilingue_gatineau` verrouillé
   en CI), idiome québécois dans le NLU. Les leaders US ne suivront pas vite.
2. **ROI affiché dans le produit, pas en témoignage** — « valeur sauvée /
   mois » calculée par appel (barème par industrie, recalibré par client).
   Personne au QC n'affiche ça. C'est LA réponse à « combien tu me sauves ? ».
3. **Vertical services à domicile d'abord** — urgences (dégât d'eau, plus de
   chauffage à -20), dispatch, fast-track : le coût d'un appel manqué y est
   maximal et mesurable. L'horizontal (dentistes ET restaurants ET assurances)
   dilue le produit — c'est le pari inverse d'Agent IA Vocal.
4. **Conformité comme caractéristique vendable** — purge Loi 25 automatique,
   audit trail, consentement tracé (voir relance ci-dessous). Pour une PME,
   « conforme par défaut » enlève une angoisse réelle.
5. **Prix transparent publié** — différenciateur immédiat vs le « contactez-
   nous » ambiant au QC.

## Verdict — agent de relance et de suivi (ADR-015)

**Pas trop poussé : nécessaire.** C'est déjà un standard émergent aux US et
un trou dans l'offre QC. MAIS le cadre CRTC tranche le périmètre :

- Un message enregistré/synthétisé de **sollicitation** (CMA/composeur-
  messager) exige un **consentement exprès préalable** — peu importe la
  relation d'affaires. La LNNTE exempte la relation d'affaires existante
  (≤ 18 mois), mais pas les règles CMA pour la sollicitation.
- Ne sont PAS de la sollicitation : rappeler un client qui vient d'appeler,
  confirmer/rappeler un RDV, donner suite à une soumission qu'il a demandée.
- Heures permises : 9 h-21 h 30 semaine, 10 h-18 h fin de semaine ;
  identification et numéro de rappel obligatoires.

Périmètre retenu, par ordre de ROI :
1. **Rappel d'appel manqué/abandonné** (< 2 min) — réponse à une demande du
   client, pas de la sollicitation. P3, priorité 1 (avec le SMS déjà planifié).
2. **Suivi de soumission** (J+2) — consentement exprès capté PENDANT l'appel
   entrant (« Voulez-vous qu'on vous rappelle si vous n'avez pas de
   nouvelles ? ») et tracé verbatim dans le flight recorder. P3.
3. **Réactivation saisonnière** (entretien fournaise…) — sollicitation :
   opt-in exprès seulement, plus tard (P5).

**L'arme : « relance conforme par conception »** — le consentement est capté
en plein appel, horodaté, verbatim, consultable. Dès P2B, le prompt de
l'agente pose la question de consentement au rappel ; le champ existe dans la
fiche. Aucun concurrent QC ne montre ça.

## Sources
- agentiavocal.ca (offre, langues, industries) ; cyberperformance.ca ; allesi.ca
- Comparatifs 2026 : almcorp.com, solvea.cx, withallo.com, getvoip.com,
  hicira.com, getaira.io, cloudtalk.io (bilingue), heyrosie.com/pricing
- Relance/« speed to lead » : leadtruffle.co, serviceagent.ai,
  predictivesalesai.com, agentzap.ai, bland.ai
- CRTC : crtc.gc.ca/fra/reglest-trules.htm (règles télémarketing/CMA),
  crtc.gc.ca/fra/phone/telemarketing/exempt.htm (LNNTE, relation d'affaires)
