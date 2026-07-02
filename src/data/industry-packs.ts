/**
 * Industry Packs — profils métiers d'Allô Maude.
 *
 * 3 packs initiaux : concessionnaire automobile, clinique dentaire, PME générale
 * (qui sert aussi de REPLI pour toute industrie sans pack dédié — jamais de crash).
 *
 * Ajouter un métier = ajouter UN objet ici + (si nouvelle industrie) un
 * IndustryScript dans industry-scripts.ts. Zéro code ailleurs.
 *
 * HONNÊTETÉ : les statuts d'add-ons reflètent ce qui existe VRAIMENT dans le
 * produit (inclus = livré, a_venir = pas encore construit). Les chiffres de
 * marché cités dans les descriptions sont des estimations d'études d'industrie,
 * pas des promesses de résultat.
 */
import type { IndustryPack } from "@/domain/pack";

/** Add-ons déjà livrés par le socle Allô Maude (P3) — partagés par tous les packs. */
const CORE_ADDONS: IndustryPack["addOns"] = [
  { id: "addon_sms_resume", name: "Résumé SMS/courriel après appel", description: "Chaque appel qualifié est résumé et envoyé à l'équipe par texto ou courriel.", status: "inclus" },
  { id: "addon_rescue_sms", name: "Rescue d'appels manqués", description: "SMS automatique à l'appelant manqué pendant que le lead est encore chaud.", status: "inclus" },
  { id: "addon_suivi_j2", name: "Suivi automatique J+2", description: "Relance consentie deux jours après l'appel si le dossier est resté sans réponse.", status: "inclus" },
];

/** Règles de relance annulation communes — consentement verbatim (ADR-018), refus final. */
const CANCELLATION_RULES_BASE = [
  "Si l'appelant veut annuler son rendez-vous, propose D'ABORD de le déplacer plutôt que de l'annuler sec — « Je peux vous replacer tout de suite, ça vous éviterait de rappeler. »",
  "Si l'annulation est confirmée, note la date et l'heure de la plage libérée dans le résumé : elle sera offerte aux clients de la liste de relance.",
  "Si l'appelant voudrait un rendez-vous PLUS TÔT et que rien ne semble disponible, offre la liste de relance : « Si une place se libère avant, est-ce que vous aimeriez qu'on vous appelle ou qu'on vous texte ? » Note sa réponse EXACTE — c'est un consentement.",
  "Un refus d'inscription à la liste est FINAL : n'insiste jamais et note le refus.",
];

export const PACK_CONCESSIONNAIRE: IndustryPack = {
  id: "pack_concessionnaire",
  industry: "concessionnaire_auto",
  scriptId: "script_concessionnaire",
  name: "Concessionnaire automobile",
  shortDescription:
    "Ventes, service, pièces et financement : Maude route chaque appel au bon département et capte les leads après les heures — là où, selon les études de l'industrie, un appel sur quatre se perd.",
  frequentIntents: [
    { intent: "question_info", label: "Disponibilité d'un véhicule en inventaire", example: "Le RAV4 usagé sur votre site est-il encore disponible ?" },
    { intent: "prise_rdv", label: "Rendez-vous au service (entretien, pneus, réparation)", example: "J'aurais besoin d'un changement d'huile cette semaine." },
    { intent: "suivi_dossier", label: "Statut de réparation (« où est ma voiture ? »)", example: "Ma voiture est chez vous depuis hier, est-elle prête ?" },
    { intent: "question_info", label: "Pièces et accessoires", example: "Avez-vous des balais d'essuie-glace pour un Civic 2021 ?" },
    { intent: "demande_soumission", label: "Financement, fin de location, échange", example: "Ma location finit dans deux mois, qu'est-ce que vous m'offrez ?" },
  ],
  teamRoles: ["Conseiller aux ventes", "Directeur des ventes", "Conseiller au service", "Commis aux pièces", "Directeur financier"],
  transferRouting: [
    { department: "Ventes", triggers: ["essai routier", "acheter", "offre", "échange", "prix"], description: "Intention d'achat chaude → vendeur disponible ou directeur des ventes, rappel prioritaire sinon." },
    { department: "Service", triggers: ["rendez-vous", "réparation", "entretien", "ma voiture", "prête"], description: "RDV atelier et statuts de réparation → conseiller au service." },
    { department: "Pièces", triggers: ["pièce", "accessoire", "commande"], description: "Disponibilité et commandes de pièces → commis aux pièces." },
    { department: "Financement", triggers: ["financement", "taux", "crédit", "mensualités"], description: "Toute question de crédit → directeur financier. L'IA ne donne jamais de taux." },
  ],
  cautionPhrases: [
    "Selon les informations disponibles, je vais faire confirmer la disponibilité du véhicule par l'équipe avant de vous faire déplacer.",
    "Les taux et conditions de financement sont confirmés uniquement par le directeur financier.",
    "Le prix final s'établit avec le vendeur — je ne peux pas négocier au téléphone, mais je note ce qui vous intéresse.",
  ],
  sampleAnswers: [
    {
      caller: "Le CR-V 2022 gris sur votre site, il est encore là ?",
      maude: "Bonne question ! Selon les informations disponibles, je ne peux pas vous garantir la disponibilité en temps réel — je prends votre nom et votre numéro, et un conseiller vous confirme ça dans les plus brefs délais, avant que quelqu'un d'autre parte avec.",
    },
    {
      caller: "Ça fait deux jours que ma voiture est au service pis personne me rappelle.",
      maude: "Oh, je comprends que c'est frustrant. Je note votre nom et votre véhicule tout de suite, et votre conseiller au service vous rappelle avec le statut exact — vous n'aurez pas à rappeler une troisième fois.",
    },
  ],
  addOns: [
    ...CORE_ADDONS,
    { id: "addon_inventaire", name: "Connexion à l'inventaire", description: "Maude répond à « est-ce encore disponible ? » depuis votre inventaire réel (site web ou flux).", status: "a_venir" },
    { id: "addon_statut_service", name: "Statut de réparation proactif", description: "SMS de statut automatique — jusqu'à 75 % des appels d'après-midi sont des « où est ma voiture ? » selon les études de l'industrie.", status: "a_venir" },
  ],
  cancellation: {
    enabled: true,
    offerReschedule: true,
    offerRecallList: true,
    freedSlotSmsTemplate:
      "Bonjour {name}, une place vient de se libérer au service chez {company} le {slot}. Répondez OUI pour la prendre — premier arrivé, premier servi. Répondez STOP pour ne plus recevoir ces alertes.",
    promptRules: CANCELLATION_RULES_BASE,
  },
  knowledgeSources: [
    { kind: "inventory", label: "Inventaire véhicules (site ou flux)", status: "a_venir" },
    { kind: "website", label: "Site du concessionnaire (heures, promotions)", status: "a_venir" },
  ],
};

export const PACK_DENTAIRE: IndustryPack = {
  id: "pack_dentaire",
  industry: "dentiste",
  scriptId: "script_dentiste",
  name: "Clinique dentaire",
  shortDescription:
    "Nouveaux patients, urgences dentaires et gestion d'horaire — sans jamais donner d'avis médical. Le mode relance annulation transforme chaque plage libérée en occasion de la combler.",
  frequentIntents: [
    { intent: "prise_rdv", label: "Nouveau patient", example: "Je cherche un nouveau dentiste, prenez-vous des patients ?" },
    { intent: "urgence", label: "Urgence dentaire (douleur, dent cassée, abcès)", example: "J'ai une rage de dents depuis hier soir." },
    { intent: "prise_rdv", label: "Prise ou déplacement de rendez-vous", example: "Je voudrais devancer mon nettoyage si possible." },
    { intent: "annulation", label: "Annulation de rendez-vous", example: "Je dois annuler mon rendez-vous de demain." },
    { intent: "question_info", label: "Assurances et couverture", example: "Est-ce que mon plan couvre le nettoyage ?" },
  ],
  teamRoles: ["Secrétaire / coordonnatrice", "Hygiéniste dentaire", "Dentiste", "Responsable facturation et assurances"],
  transferRouting: [
    { department: "Urgences cliniques", triggers: ["douleur intense", "enflure", "saigne", "abcès"], description: "Urgence dentaire → plage d'urgence du jour ou personnel clinique." },
    { department: "Facturation / assurances", triggers: ["assurance", "facture", "réclamation", "couverture"], description: "Détails de couverture → responsable facturation. Maude ne confirme jamais une couverture." },
    { department: "Personnel clinique", triggers: ["symptôme", "médicament", "traitement", "résultat"], description: "Toute question clinique → hygiéniste ou dentiste. Jamais d'avis médical par l'IA." },
  ],
  cautionPhrases: [
    "Je ne donne jamais de diagnostic ni d'avis médical — par contre, je peux vous réserver la première plage disponible.",
    "La couverture exacte de vos assurances est vérifiée par l'équipe avant le rendez-vous.",
    "Selon les informations disponibles, je fais confirmer l'horaire exact par la clinique.",
  ],
  sampleAnswers: [
    {
      caller: "J'ai une dent qui élance depuis hier, c'est grave ?",
      maude: "Oh, une douleur qui dure, ce n'est pas plaisant. Je ne peux pas vous dire si c'est grave — je ne donne pas d'avis médical — mais on garde des plages d'urgence chaque jour : je vous en réserve une ce matin ?",
    },
    {
      caller: "Je dois annuler mon nettoyage de jeudi.",
      maude: "Pas de souci, ça arrive ! Avant d'annuler, je peux vous replacer tout de suite — ça vous éviterait de rappeler. Sinon j'annule, et la place sera offerte à un patient qui attend.",
    },
  ],
  addOns: [
    ...CORE_ADDONS,
    { id: "addon_relance_annulation", name: "Relance annulation automatique", description: "Quand une plage se libère, les patients de la liste de relance reçoivent un SMS « premier arrivé, premier servi ». Les études de l'industrie estiment qu'une liste automatisée comble 40-60 % des annulations, contre 10-20 % à la main.", status: "a_venir" },
    { id: "addon_rappels_rdv", name: "Rappels de rendez-vous", description: "Rappel SMS avant le rendez-vous pour réduire les absences.", status: "a_venir" },
  ],
  cancellation: {
    enabled: true,
    offerReschedule: true,
    offerRecallList: true,
    freedSlotSmsTemplate:
      "Bonjour {name}, une place vient de se libérer chez {company} le {slot}. Répondez OUI pour la prendre — premier arrivé, premier servi. Répondez STOP pour ne plus recevoir ces alertes.",
    promptRules: [
      ...CANCELLATION_RULES_BASE,
      "Si l'annulation concerne une douleur ou un traitement en cours, rappelle doucement que la clinique recommande de ne pas trop tarder — sans dramatiser ni donner d'avis médical.",
    ],
  },
  knowledgeSources: [
    { kind: "faq", label: "FAQ de la clinique (assurances, politiques)", status: "a_venir" },
    { kind: "website", label: "Site de la clinique (équipe, services)", status: "a_venir" },
  ],
};

export const PACK_PME: IndustryPack = {
  id: "pack_pme",
  industry: "services_professionnels",
  scriptId: "script_services_pro",
  name: "PME et services professionnels",
  shortDescription:
    "Prise de message intelligente, qualification et transfert par département pour toute PME — le pack de départ quand votre métier n'a pas encore son pack dédié.",
  frequentIntents: [
    { intent: "question_info", label: "Prise de message et demande générale", example: "J'aimerais laisser un message pour la personne responsable." },
    { intent: "demande_soumission", label: "Qualification d'un nouveau client", example: "J'aurais besoin d'une soumission pour vos services." },
    { intent: "suivi_dossier", label: "Suivi d'un dossier en cours", example: "Je voulais savoir où en est mon dossier." },
    { intent: "prise_rdv", label: "Prise ou déplacement de rendez-vous", example: "Est-ce qu'on peut déplacer notre rencontre de mardi ?" },
    { intent: "plainte", label: "Plainte ou insatisfaction", example: "Je ne suis vraiment pas satisfait du service." },
  ],
  teamRoles: ["Réception", "Responsable de compte / de dossier", "Direction"],
  transferRouting: [
    { department: "Responsable de dossier", triggers: ["mon dossier", "suivi", "la personne qui s'occupe"], description: "Suivi d'un dossier existant → la personne responsable, ou prise de message détaillée." },
    { department: "Direction", triggers: ["plainte", "insatisfait", "propriétaire", "gérant"], description: "Plainte ou demande sensible → direction, avec résumé complet de l'appel." },
  ],
  cautionPhrases: [
    "Selon les informations disponibles, je préfère faire confirmer ce détail par l'équipe plutôt que de me tromper.",
    "Je ne donne pas d'avis professionnel — juridique, comptable ou médical — mais je note votre question pour la bonne personne.",
  ],
  sampleAnswers: [
    {
      caller: "Je voulais parler à quelqu'un mais je tombe toujours sur la boîte vocale.",
      maude: "Vous êtes au bon endroit — je prends votre message au complet et la bonne personne vous rappelle. C'est à quel sujet ?",
    },
  ],
  addOns: [
    ...CORE_ADDONS,
    { id: "addon_relance_annulation", name: "Relance annulation automatique", description: "Quand un rendez-vous s'annule, les clients en attente reçoivent un SMS pour combler la plage.", status: "a_venir" },
  ],
  cancellation: {
    enabled: true,
    offerReschedule: true,
    offerRecallList: true,
    freedSlotSmsTemplate:
      "Bonjour {name}, une plage vient de se libérer chez {company} le {slot}. Répondez OUI pour la prendre. Répondez STOP pour ne plus recevoir ces alertes.",
    promptRules: CANCELLATION_RULES_BASE,
  },
  knowledgeSources: [
    { kind: "website", label: "Site de l'entreprise (services, équipe)", status: "a_venir" },
    { kind: "documents", label: "Documents internes (politiques, grilles)", status: "a_venir" },
  ],
};

export const INDUSTRY_PACKS: IndustryPack[] = [PACK_CONCESSIONNAIRE, PACK_DENTAIRE, PACK_PME];

/** Pack de repli : PME générale. Toute industrie sans pack dédié tombe ici — jamais de crash. */
export const GENERAL_PACK = PACK_PME;

/** Pack STRICTEMENT dédié à l'industrie, sinon undefined. C'est ce que le prompt temps réel
 * utilise : une industrie sans pack garde exactement son comportement d'avant. */
export function findIndustryPack(industry: string): IndustryPack | undefined {
  return INDUSTRY_PACKS.find((p) => p.industry === industry);
}

/** Pack de l'industrie, avec repli PME générale (UI, démos, onboarding). Ne lance jamais. */
export function getIndustryPack(industry: string): IndustryPack {
  return findIndustryPack(industry) ?? GENERAL_PACK;
}
