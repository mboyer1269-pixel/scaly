# Stratégie produit Scaly — le wedge et le plan (juin 2026)

Document de direction. Complète docs/MARKET.md (paysage concurrentiel) avec
les décisions produit. Opinions tranchées, assumées, révisables sur données.

## 1. Décision recommandée

**Scaly n'est pas un « AI receptionist ». C'est un système de récupération
de revenus téléphoniques pour PME de services, bilingue FR-QC/EN, qui prouve
son ROI dans le produit.** Le réceptionniste IA est le moyen ; le produit
vendu est : *aucun appel payant ne meurt sans trace, et tu vois combien
chaque mois t'aurait coûté sans nous.*

Conséquences concrètes de cette décision :
- Le dashboard ouvre sur l'argent (« protégé », « à risque », multiplicateur
  vs prix du plan) et sur la file « Appels à sauver maintenant » — pas sur
  des statistiques de volume. Fait (2026-06-11).
- La démo de vente, c'est le dashboard après 14 jours, pas la voix. La voix
  doit être bonne ; le dashboard doit être imbattable.
- Tout ce qui ne sert pas « capturer → qualifier → récupérer → prouver »
  passe après.

## 2. Les douleurs du marché → produit

| Douleur documentée | Insight | Réponse Scaly | État |
|---|---|---|---|
| Voix robotique → le client raccroche (plaintes massives GoHighLevel, Goodcall « robotic feel ») | La PME a peur d'avoir l'air cheap | OpenAI Realtime audio↔audio + divulgation IA assumée et chaleureuse ; benchmark voix FR-QC aux 50 appels tests | P2B |
| Boucles sans issue, impossible d'avoir un humain | La confiance se perd en UN appel raté | Transfert humain NON NÉGOCIABLE (mot « humain » = transfert immédiat, testé en CI) + repli `<Dial>` si la pile tombe | Fait |
| Facturation surprise (Ruby arrondit au 30 s, facture le spam ; Smith.ai transfère sans consentement et gonfle la facture) | Le pricing opaque tue le renouvellement | Prix mensuel publié, spam refusé NON facturé, transferts inclus ; le dashboard montre le coût vs la valeur chaque mois | À verrouiller P4 |
| Urgence de 4 200 $ qui finit sur une boîte vocale | L'urgence est LE moment de vérité des métiers de service | Fast-track urgence (adresse + tél seulement → équipe de garde), testé scénario par scénario | Fait (lab) |
| Français absent ou « 90+ langues » générique | Le FR-QC parlé (pis, là, ben) et le code-switching ne s'improvisent pas | NLU FR-QC dédié + scénario bilingue verrouillé en CI + compteur « appels servis en anglais » sur le dashboard | Fait |
| ROI invisible → churn (« waste of money ») | Personne ne renouvelle un gadget | ROI snapshot : protégé $, multiplicateur vs plan, « appels qui auraient été perdus » | Fait |
| Pas de relance : le lead manqué refroidit en minutes | La majorité des clients achètent du premier répondant | File de sauvetage avec chrono (fenêtre critique 15 min) + SMS auto + rappel vocal P3, conforme CRTC (ADR-015) | File faite ; SMS/rappel P3 |
| Onboarding long, réglages perdus | Une PME n'a pas d'admin système | Templates par industrie (15 scripts existants) = config en minutes ; pas de page blanche | Fait (à packager) |
| Conformité ignorée (consentement, rétention) | Au Québec c'est une angoisse réelle (Loi 25) | Purge automatique, audit trail, consentement de rappel capté verbatim en appel | Fait |

## 3. Le wedge

**« On sauve les appels que tu perds — et on te montre le montant. »**

Pourquoi nous et pas un autre :
1. **Le moment de vérité** : 28-42 % des appels de PME manqués aux heures
   ouvrables, ~100 % après 17 h (stat de fournisseurs du secteur — à VALIDER
   sur nos propres pilotes avant de l'utiliser en vente). Le concurrent vend
   « on répond » ; Scaly vend « voici les 3 240 $ qu'on t'a sauvés ce
   mois-ci » — affiché, pas raconté.
2. **FR-QC réel** : les leaders US sont EN(+ES). Le joueur QC est horizontal
   et sans preuve. Le code-switching en plein appel est verrouillé en CI chez
   nous — c'est une barrière technique ET culturelle.
3. **La confiance par l'honnêteté** : latences simulées étiquetées, barèmes
   affichés comme hypothèses, transfert humain garanti, repli téléphonique
   qui ne casse jamais. Dans un marché qui sur-promet, l'honnêteté vérifiable
   est un avantage déloyal.
4. **Vertical d'abord** : services à domicile (plomberie, CVC, électricité) —
   le coût d'un appel manqué y est maximal, mesurable, urgent. On gagne là,
   puis on élargit avec les 14 autres scripts déjà écrits.

## 4. La vision « 60 secondes » (état : implémentée v1)

Le propriétaire ouvre Scaly et voit, sans cliquer :
1. **Ce que Scaly lui rapporte** — X $ protégés, N appels qui auraient été
   perdus, multiplicateur vs prix du plan, preuve bilingue chiffrée.
2. **Appels à sauver MAINTENANT** — chrono par appel (fenêtre critique /
   encore chaud / refroidi), valeur à risque, prochaine action en clair,
   export CSV de la file.
3. Urgences ouvertes, opportunités chaudes par valeur, actions en attente.

V2 (avec les vraies données P2B/P3) : bouton « Rappeler » qui déclenche le
rappel vocal/SMS depuis la file ; notification propriétaire < 2 min ;
**pouls quotidien par texto** — « Aujourd'hui : 3 chauds (4 100 $), 1 mécontent
à rappeler, 2 appels sauvés » — parce que le propriétaire vit dans ses textos,
pas dans un dashboard ; et **répondre au texto, c'est parler à sa
réceptionniste** (v1 mots-clés CHAUDS/MÉCONTENTS/RÉSUMÉ, v2 conversationnel).
Le dashboard devient la preuve ; le texto devient l'habitude quotidienne.

## 5. Features prioritaires (ordre d'exécution)

1. **P2B — premier appel réel** (numéro + ngrok, runbook prêt) puis 50 appels
   tests FR/EN. Tout le reste est théorique tant que ça n'a pas eu lieu.
2. **P3.1 — Missed-call rescue actif** : SMS Twilio réel < 2 min + rappel
   vocal (ADR-015 palier 1). C'est le wedge qui devient réel.
3. **P3.2 — Pouls quotidien par texto** (chauds, mécontents, sauvés, $) +
   réponse par mots-clés = parler à sa réceptionniste. Même tuyau Twilio que
   P3.1, coût marginal nul, et c'est l'habitude quotidienne qui tue le churn.
4. **P3.3 — Suivi de soumission J+2** avec consentement capté (palier 2).
5. **P3.4 — Onboarding magique** : URL du site + 2 phrases → brouillon de
   persona/config (LLM), éditable, jamais actif sans approbation. Réduit
   l'onboarding pilote de jours à minutes — c'est une feature de VENTE.
6. **P4 — pricing public honnête** : mensuel fixe, spam non facturé,
   transferts inclus — chaque irritant de facturation documenté chez les
   concurrents devient une ligne de notre page prix.

Idées écartées (pour l'instant, avec raison) :
- *Éditeur de scripts self-serve* : la PME ne veut pas éditer des scripts,
  elle veut que ça marche (templates > éditeur). P5.
- *Multi-canal (web chat, WhatsApp)* : dilue le wedge téléphonique. Non.
- *Marketplace d'intégrations* : 3 intégrations qui marchent (SMS, Calendar,
  un CRM) battent 30 logos.

## 6. Message de positionnement

> **« Chaque appel manqué, c'est un client qui appelle ton compétiteur.
> Scaly répond en français pis en anglais, 24/7, transfère les urgences à
> un humain en quelques secondes — et te montre chaque mois combien
> d'argent il t'a sauvé. »**

Variante courte (signature) : **« Scaly — on sauve les appels que tu perds. »**
