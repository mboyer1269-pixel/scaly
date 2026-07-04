/**
 * Scripts par industrie — 15 verticales, contenu FR-QC.
 * Chaque script définit : intention principale, infos à collecter, critères d'urgence,
 * critères de transfert, objections fréquentes, action finale, résumé attendu, tags CRM.
 * Les valeurs de référence (valueBaselineCad) sont des HYPOTHÈSES INTERNES à recalibrer
 * avec chaque client — pas des données de marché.
 */
import type { IndustryScript, QualificationQuestion } from "@/domain/script";
import type { Industry } from "@/domain/company";

const COMMON_FORBIDDEN = [
  "Garantir un prix final au téléphone",
  "Promettre une heure d'arrivée exacte sans confirmation humaine",
  "Donner un avis médical, juridique ou financier",
  "Demander un numéro de carte de crédit ou un NAS",
];

const COMMON_TRANSFERS = [
  { condition: "L'appelant demande explicitement de parler à un humain", keywords: ["parler à quelqu'un", "un humain", "une vraie personne", "le propriétaire"] },
  { condition: "L'appelant est très frustré ou menace de partir chez un concurrent", keywords: ["inacceptable", "avocat", "plainte", "concurrent"] },
];

const Q = (fieldKey: QualificationQuestion["fieldKey"], question: string, questionEn: string, required = true): QualificationQuestion => ({
  fieldKey,
  question,
  questionEn,
  required,
});

const BASE_QUESTIONS: QualificationQuestion[] = [
  Q("nom", "Puis-je avoir votre nom, s'il vous plaît ?", "May I have your name, please?"),
  Q("telephone", "Quel est le meilleur numéro pour vous rejoindre ?", "What's the best number to reach you?"),
];

function defineScript(s: Omit<IndustryScript, "language" | "forbiddenPhrases"> & { forbiddenPhrases?: string[] }): IndustryScript {
  return {
    language: "fr",
    forbiddenPhrases: [...COMMON_FORBIDDEN, ...(s.forbiddenPhrases ?? [])],
    ...s,
  };
}

export const INDUSTRY_SCRIPTS: IndustryScript[] = [
  defineScript({
    id: "script_construction",
    industry: "construction_renovation",
    name: "Construction / Rénovation — Soumission et urgences chantier",
    primaryIntent: "demande_soumission",
    greeting: "Bonjour, vous avez joint {company}. Ici {agent}, l'assistante virtuelle. Comment puis-je vous aider aujourd'hui ?",
    greetingEn: "Hello, you've reached {company}. This is {agent}, the virtual assistant. How can I help you today?",
    questions: [
      ...BASE_QUESTIONS,
      Q("adresse", "À quelle adresse se situeraient les travaux ?", "What's the address for the work?"),
      Q("description", "Pouvez-vous me décrire le projet en quelques mots ?", "Can you briefly describe the project?"),
      Q("moment", "Dans quel délai aimeriez-vous commencer les travaux ?", "When would you like the work to start?"),
      Q("budget", "Avez-vous une idée de budget pour ce projet ?", "Do you have a budget in mind?", false),
    ],
    urgencyCriteria: [
      { keywords: ["infiltration", "dégât d'eau", "fuite", "toit coule", "inondé"], level: "critique", note: "Dommage actif à la propriété" },
      { keywords: ["effondré", "dangereux", "structure", "sécurité"], level: "critique", note: "Risque de sécurité" },
      { keywords: ["avant l'hiver", "cette semaine", "rapidement"], level: "haute", note: "Délai serré exprimé" },
    ],
    transferCriteria: [...COMMON_TRANSFERS, { condition: "Projet commercial > 50 000 $ estimé", keywords: ["commercial", "immeuble", "plex"] }],
    commonObjections: [
      { objection: "C'est combien pour une rénovation comme ça ?", response: "Chaque projet est différent — je note les détails et un estimateur vous rappelle avec une soumission gratuite, normalement en moins de 24 h." },
      { objection: "Je veux juste un prix rapide au téléphone.", response: "Je comprends. Pour vous donner un chiffre fiable plutôt qu'une approximation, l'équipe préfère voir le projet. La visite d'estimation est gratuite et sans engagement." },
    ],
    finalAction: "envoyer_soumission",
    expectedSummary: "{nom} demande une soumission pour {description} à {adresse}. Délai : {moment}. Rappel requis pour estimation.",
    crmTags: ["soumission", "construction", "estimation-requise"],
    valueBaselineCad: 8500,
    sampleNeeds: ["refaire la toiture", "rénover la salle de bain", "agrandir le garage", "finir le sous-sol", "changer les fenêtres"],
    urgentNeeds: ["une infiltration d'eau dans le toit", "un dégât d'eau au sous-sol", "un mur qui s'est effondré dans le garage"],
  }),

  defineScript({
    id: "script_garage",
    industry: "garage_auto",
    name: "Garage — Rendez-vous mécanique et urgences routières",
    primaryIntent: "prise_rdv",
    greeting: "{company}, bonjour ! Ici {agent}, assistante virtuelle du garage. Qu'est-ce qu'on peut faire pour votre véhicule ?",
    greetingEn: "{company}, hello! This is {agent}, the shop's virtual assistant. What can we do for your vehicle?",
    questions: [
      ...BASE_QUESTIONS,
      Q("vehicule", "Quelle est la marque, le modèle et l'année de votre véhicule ?", "What's the make, model and year of your vehicle?"),
      Q("description", "Quel est le problème ou le service souhaité ?", "What's the issue or service needed?"),
      Q("moment", "Quand aimeriez-vous passer au garage ?", "When would you like to come in?"),
    ],
    urgencyCriteria: [
      { keywords: ["panne", "ne démarre plus", "remorquage", "sur l'autoroute", "freins"], level: "critique", note: "Véhicule immobilisé ou sécurité (freins)" },
      { keywords: ["voyant moteur", "bruit inquiétant", "surchauffe"], level: "haute", note: "Risque mécanique imminent" },
    ],
    transferCriteria: COMMON_TRANSFERS,
    commonObjections: [
      { objection: "C'est combien pour des freins ?", response: "Ça dépend du véhicule et des pièces. Je peux noter vos infos et le technicien vous confirme un prix avant toute réparation — rien n'est facturé sans votre accord." },
    ],
    finalAction: "confirmer_rdv",
    expectedSummary: "{nom} ({vehicule}) : {description}. RDV souhaité {moment}. Confirmation à envoyer.",
    crmTags: ["rdv-atelier", "mecanique"],
    valueBaselineCad: 650,
    sampleNeeds: ["un changement d'huile", "la pose de mes pneus d'été", "un bruit dans la suspension", "l'inspection avant un long voyage", "l'air climatisé qui ne marche plus"],
    urgentNeeds: ["mon char qui ne démarre plus à matin", "mes freins qui font un bruit de métal", "une surchauffe du moteur sur la 40"],
  }),

  defineScript({
    id: "script_concessionnaire",
    industry: "concessionnaire_auto",
    name: "Concessionnaire — Ventes, service, pièces et financement",
    primaryIntent: "prise_rdv",
    greeting: "{company}, bonjour ! Ici {agent}, l'assistante virtuelle. Vous appelez pour les ventes, le service ou les pièces ?",
    greetingEn: "{company}, hello! This is {agent}, the virtual assistant. Are you calling for sales, service or parts?",
    questions: [
      ...BASE_QUESTIONS,
      Q("description", "C'est pour les ventes, le service, les pièces ou le financement — et quel est votre besoin ?", "Is this for sales, service, parts or financing — and what do you need?"),
      Q("vehicule", "Quel véhicule est concerné, ou quel modèle cherchez-vous ?", "Which vehicle is this about, or which model are you looking for?"),
      Q("moment", "Quand aimeriez-vous passer ou être rappelé ?", "When would you like to come in or be called back?"),
    ],
    urgencyCriteria: [
      { keywords: ["en panne", "remorquage", "accident", "freins", "ne démarre plus"], level: "critique", note: "Véhicule immobilisé ou sécurité" },
      { keywords: ["rappel de sécurité", "acheté la semaine", "sous garantie", "toujours pas de nouvelles", "personne me rappelle"], level: "haute", note: "Rappel constructeur ou client récent frustré — à traiter vite" },
      { keywords: ["essai routier", "faire une offre", "prêt à acheter"], level: "haute", note: "Intention d'achat chaude — speed to lead" },
    ],
    transferCriteria: [
      ...COMMON_TRANSFERS,
      { condition: "Intention d'achat chaude (essai routier, offre, échange) → vendeur ou directeur des ventes", keywords: ["essai routier", "offre", "échange", "acheter"] },
      { condition: "Financement ou crédit → directeur financier (l'IA ne donne JAMAIS de taux ni de conditions)", keywords: ["financement", "taux", "crédit", "mensualités"] },
      { condition: "Statut de réparation ou rendez-vous atelier → conseiller au service", keywords: ["ma voiture", "réparation", "au service", "prête"] },
    ],
    commonObjections: [
      { objection: "Le véhicule sur votre site est-il encore disponible ?", response: "Selon les informations disponibles, je ne peux pas garantir la disponibilité en temps réel — je prends vos coordonnées et un membre de l'équipe vous confirme ça rapidement, avant que le véhicule vous file entre les doigts." },
      { objection: "C'est quoi votre meilleur prix ?", response: "Le prix final se discute avec le vendeur — je note le véhicule qui vous intéresse et on vous rappelle en priorité avec les détails." },
      { objection: "Où en est ma voiture ?", response: "Je note votre nom et votre véhicule, et votre conseiller au service vous rappelle avec le statut exact — vous n'aurez pas à rappeler." },
    ],
    finalAction: "rappeler_immediatement",
    expectedSummary: "{nom} — {description} ({vehicule}). Moment : {moment}. Département identifié, rappel prioritaire.",
    crmTags: ["concessionnaire", "lead-auto"],
    forbiddenPhrases: [
      "Garantir la disponibilité d'un véhicule en inventaire",
      "Annoncer un taux de financement ou des conditions de crédit",
      "Négocier ou promettre un prix de vente",
    ],
    valueBaselineCad: 950,
    sampleNeeds: [
      "savoir si le VUS usagé annoncé sur votre site est encore disponible",
      "un rendez-vous pour un changement d'huile et la pose des pneus",
      "des nouvelles de ma voiture laissée au service",
      "une évaluation de ma voiture pour un échange",
      "les heures du département des pièces",
    ],
    urgentNeeds: [
      "ma voiture achetée la semaine passée qui est en panne",
      "un remorquage vers votre atelier",
      "une lettre de rappel de sécurité reçue par la poste",
    ],
  }),

  defineScript({
    id: "script_clinique",
    industry: "clinique_privee",
    name: "Clinique privée — Prise de rendez-vous et triage non médical",
    primaryIntent: "prise_rdv",
    greeting: "Clinique {company}, bonjour. Ici {agent}, assistante virtuelle. Je peux vous aider à prendre ou déplacer un rendez-vous. Comment puis-je vous aider ?",
    greetingEn: "{company} clinic, hello. This is {agent}, the virtual assistant. I can help you book or move an appointment. How can I help?",
    questions: [
      ...BASE_QUESTIONS,
      Q("description", "Quel type de consultation recherchez-vous ?", "What type of consultation are you looking for?"),
      Q("moment", "Avez-vous des disponibilités à privilégier ?", "Any preferred availability?"),
    ],
    urgencyCriteria: [
      { keywords: ["douleur intense", "urgence", "malaise", "911"], level: "critique", note: "Rediriger vers le 911/811 — JAMAIS de triage médical par l'IA" },
      { keywords: ["aujourd'hui", "le plus tôt possible"], level: "haute", note: "Demande de RDV rapide" },
    ],
    transferCriteria: [...COMMON_TRANSFERS, { condition: "Toute question médicale (symptômes, médication) → transfert au personnel soignant", keywords: ["symptôme", "médicament", "résultat", "prescription"] }],
    commonObjections: [
      { objection: "Pouvez-vous me dire si c'est grave ?", response: "Je ne peux pas donner d'avis médical. Si c'est urgent, composez le 811 ou le 911. Sinon, je peux vous réserver la première plage disponible avec un professionnel." },
    ],
    finalAction: "confirmer_rdv",
    expectedSummary: "{nom} souhaite un RDV : {description}. Dispo : {moment}. Aucun triage médical effectué.",
    crmTags: ["rdv-clinique", "patient"],
    forbiddenPhrases: ["Évaluer des symptômes", "Commenter une médication", "Donner un résultat d'examen"],
    valueBaselineCad: 250,
    sampleNeeds: ["un bilan de santé annuel", "une consultation en physiothérapie", "un rendez-vous de suivi", "une prise de sang"],
    urgentNeeds: ["un rendez-vous aujourd'hui, c'est vraiment douloureux"],
  }),

  defineScript({
    id: "script_dentiste",
    industry: "dentiste",
    name: "Clinique dentaire — RDV, urgences dentaires et rappels",
    primaryIntent: "prise_rdv",
    greeting: "{company}, bonjour ! Ici {agent}, assistante virtuelle. Comment puis-je vous aider ?",
    greetingEn: "{company}, hello! This is {agent}, the virtual assistant. How can I help you?",
    questions: [
      ...BASE_QUESTIONS,
      Q("description", "Est-ce pour un nettoyage, un examen ou un problème particulier ?", "Is this for a cleaning, an exam, or a specific issue?"),
      Q("moment", "Préférez-vous le jour, le soir ou la fin de semaine ?", "Do you prefer daytime, evening or weekend?"),
    ],
    urgencyCriteria: [
      { keywords: ["dent cassée", "rage de dents", "abcès", "enflure", "saigne"], level: "critique", note: "Urgence dentaire — plage d'urgence du jour" },
      { keywords: ["douleur", "sensible"], level: "haute", note: "Douleur active" },
    ],
    transferCriteria: COMMON_TRANSFERS,
    commonObjections: [
      { objection: "Est-ce que c'est couvert par mes assurances ?", response: "La plupart des assurances couvrent les soins de base. L'équipe vérifie votre couverture avant le rendez-vous — apportez simplement votre carte d'assurance." },
    ],
    finalAction: "confirmer_rdv",
    expectedSummary: "{nom} : {description}. Préférence {moment}. Urgence dentaire = plage du jour.",
    crmTags: ["rdv-dentaire", "patient"],
    valueBaselineCad: 480,
    sampleNeeds: ["un nettoyage", "un examen de routine", "un blanchiment", "un plombage à refaire"],
    urgentNeeds: ["une rage de dents insupportable depuis hier", "une dent cassée en mangeant", "une enflure dans la joue"],
  }),

  defineScript({
    id: "script_salon",
    industry: "salon_beaute",
    name: "Salon de beauté — Réservations et forfaits",
    primaryIntent: "prise_rdv",
    greeting: "Salon {company}, bonjour ! Ici {agent}, votre assistante virtuelle. On vous réserve une place ?",
    greetingEn: "{company} salon, hello! This is {agent}, your virtual assistant. Shall we book you in?",
    questions: [
      ...BASE_QUESTIONS,
      Q("description", "Quel service aimeriez-vous réserver ?", "Which service would you like to book?"),
      Q("moment", "Quelle journée et quelle heure vous conviendraient ?", "What day and time work for you?"),
    ],
    urgencyCriteria: [
      { keywords: ["aujourd'hui", "ce soir", "événement", "mariage"], level: "haute", note: "Événement imminent" },
    ],
    transferCriteria: COMMON_TRANSFERS,
    commonObjections: [
      { objection: "Avez-vous une promotion en ce moment ?", response: "Les promotions changent régulièrement — je note votre intérêt et l'équipe vous confirme les offres en vigueur lors de la confirmation du rendez-vous." },
    ],
    finalAction: "confirmer_rdv",
    expectedSummary: "{nom} réserve : {description}, {moment}. Confirmation SMS à envoyer.",
    crmTags: ["reservation", "salon"],
    valueBaselineCad: 120,
    sampleNeeds: ["une coupe et une coloration", "une manucure", "un soin du visage", "un balayage"],
    urgentNeeds: ["une coiffure pour un mariage samedi"],
  }),

  defineScript({
    id: "script_veterinaire",
    industry: "veterinaire",
    name: "Clinique vétérinaire — RDV et urgences animales",
    primaryIntent: "prise_rdv",
    greeting: "Clinique vétérinaire {company}, bonjour. Ici {agent}, assistante virtuelle. Comment va votre compagnon ?",
    greetingEn: "{company} veterinary clinic, hello. This is {agent}, the virtual assistant. How is your companion doing?",
    questions: [
      ...BASE_QUESTIONS,
      Q("animal", "Quel est l'animal et son nom ?", "What kind of animal, and their name?"),
      Q("description", "Quelle est la raison de la consultation ?", "What's the reason for the visit?"),
      Q("moment", "Quand pouvez-vous passer ?", "When can you come in?"),
    ],
    urgencyCriteria: [
      { keywords: ["empoisonné", "ne respire", "accident", "convulsions", "sang"], level: "critique", note: "Urgence vitale — transfert immédiat" },
      { keywords: ["vomit", "ne mange plus", "boite"], level: "haute", note: "Symptômes préoccupants" },
    ],
    transferCriteria: [...COMMON_TRANSFERS, { condition: "Urgence vitale animale → transfert direct au personnel", keywords: ["empoisonné", "accident"] }],
    commonObjections: [
      { objection: "Combien coûte une consultation ?", response: "Le tarif dépend du type de consultation. L'équipe vous confirme les frais exacts à la réservation — aucun soin n'est fait sans votre approbation." },
    ],
    finalAction: "confirmer_rdv",
    expectedSummary: "{nom} — {animal} : {description}. RDV {moment}. Urgences vitales transférées.",
    crmTags: ["rdv-veterinaire", "animal"],
    valueBaselineCad: 320,
    sampleNeeds: ["la vaccination annuelle de mon chien", "un examen pour mon chat qui se gratte", "une coupe de griffes", "un suivi post-opération"],
    urgentNeeds: ["mon chien qui a mangé du chocolat", "mon chat qui s'est fait frapper"],
  }),

  defineScript({
    id: "script_immobilier",
    industry: "courtier_immobilier",
    name: "Courtier immobilier — Acheteurs, vendeurs et visites",
    primaryIntent: "demande_soumission",
    greeting: "Bonjour, bureau de {company}. Ici {agent}, assistante virtuelle. Vous appelez pour acheter, vendre ou pour une visite ?",
    greetingEn: "Hello, {company}'s office. This is {agent}, the virtual assistant. Are you calling to buy, sell, or book a viewing?",
    questions: [
      ...BASE_QUESTIONS,
      Q("propriete", "De quelle propriété ou de quel secteur s'agit-il ?", "Which property or area is this about?"),
      Q("description", "Êtes-vous en démarche d'achat, de vente, ou les deux ?", "Are you buying, selling, or both?"),
      Q("moment", "Quel est votre horizon : ce mois-ci, ce trimestre, ou plus tard ?", "What's your timeline: this month, this quarter, or later?"),
    ],
    urgencyCriteria: [
      { keywords: ["offre", "promesse d'achat", "cette semaine", "déjà vendu"], level: "critique", note: "Transaction active — rappel immédiat" },
      { keywords: ["préapprouvé", "visite"], level: "haute", note: "Acheteur qualifié" },
    ],
    transferCriteria: [...COMMON_TRANSFERS, { condition: "Négociation ou offre en cours → courtier directement", keywords: ["offre", "négociation"] }],
    commonObjections: [
      { objection: "Quelle est votre commission ?", response: "C'est une excellente question pour le courtier — chaque mandat est personnalisé. Je peux organiser un appel découverte gratuit dès aujourd'hui." },
    ],
    finalAction: "rappeler_immediatement",
    expectedSummary: "{nom} — {description} ({propriete}). Horizon : {moment}. Lead à rappeler en priorité.",
    crmTags: ["lead-immobilier", "acheteur-vendeur"],
    valueBaselineCad: 12000,
    sampleNeeds: ["vendre mon condo à Laval", "visiter la maison sur la rue des Érables", "une évaluation gratuite de ma propriété", "acheter un premier duplex"],
    urgentNeeds: ["faire une offre sur une maison vue hier — il y a d'autres acheteurs"],
  }),

  defineScript({
    id: "script_hypotheque",
    industry: "courtier_hypothecaire",
    name: "Courtier hypothécaire — Préqualification et renouvellements",
    primaryIntent: "demande_soumission",
    greeting: "Bonjour, vous avez joint {company}, courtage hypothécaire. Ici {agent}, assistante virtuelle. Comment puis-je vous aider ?",
    greetingEn: "Hello, you've reached {company}, mortgage brokerage. This is {agent}, the virtual assistant. How can I help?",
    questions: [
      ...BASE_QUESTIONS,
      Q("description", "Est-ce pour un achat, un renouvellement ou un refinancement ?", "Is this for a purchase, a renewal or a refinance?"),
      Q("moment", "Quelle est votre échéance ou date butoir ?", "What's your deadline?"),
      Q("courriel", "Quel courriel pour vous envoyer la liste des documents ?", "What email should we send the document list to?", false),
    ],
    urgencyCriteria: [
      { keywords: ["renouvellement", "échéance", "expire", "offre acceptée"], level: "critique", note: "Échéance ferme — risque de pénalité ou de perte de taux" },
      { keywords: ["préapprobation", "ce mois-ci"], level: "haute", note: "Démarche active" },
    ],
    transferCriteria: [...COMMON_TRANSFERS, { condition: "Questions de taux précis ou de stratégie → courtier", keywords: ["taux", "pénalité"] }],
    commonObjections: [
      { objection: "C'est quoi votre meilleur taux ?", response: "Les taux changent chaque jour et dépendent de votre dossier. Le courtier vous donne un taux personnalisé lors d'un appel de 15 minutes — sans frais et sans engagement." },
    ],
    finalAction: "rappeler_immediatement",
    expectedSummary: "{nom} — {description}, échéance {moment}. Dossier à prioriser selon l'échéance.",
    crmTags: ["lead-hypotheque", "prequalification"],
    forbiddenPhrases: ["Citer un taux d'intérêt précis", "Promettre une approbation"],
    valueBaselineCad: 3500,
    sampleNeeds: ["un renouvellement qui s'en vient", "une préapprobation pour un premier achat", "un refinancement pour des rénovations"],
    urgentNeeds: ["mon hypothèque qui arrive à échéance dans deux semaines"],
  }),

  defineScript({
    id: "script_services_pro",
    industry: "services_professionnels",
    name: "Services professionnels — Prise de mandat (comptable, notaire, etc.)",
    primaryIntent: "demande_soumission",
    greeting: "Bonjour, cabinet {company}. Ici {agent}, assistante virtuelle. Comment puis-je diriger votre demande ?",
    greetingEn: "Hello, {company} office. This is {agent}, the virtual assistant. How may I direct your request?",
    questions: [
      ...BASE_QUESTIONS,
      Q("description", "Pouvez-vous me décrire brièvement votre besoin ?", "Can you briefly describe your need?"),
      Q("moment", "Y a-t-il une échéance à respecter ?", "Is there a deadline?"),
    ],
    urgencyCriteria: [
      { keywords: ["échéance", "date limite", "mise en demeure", "impôts"], level: "critique", note: "Échéance légale ou fiscale" },
      { keywords: ["cette semaine", "urgent"], level: "haute", note: "Délai exprimé" },
    ],
    transferCriteria: [...COMMON_TRANSFERS, { condition: "Conseil professionnel spécifique → professionnel en titre", keywords: ["conseil", "avis"] }],
    commonObjections: [
      { objection: "Quels sont vos honoraires ?", response: "Les honoraires dépendent du mandat. Le professionnel vous présente une proposition claire après un premier appel exploratoire — je peux le réserver maintenant." },
    ],
    finalAction: "creer_suivi",
    expectedSummary: "{nom} : {description}. Échéance : {moment}. Appel exploratoire à planifier.",
    crmTags: ["mandat", "services-pro"],
    valueBaselineCad: 1800,
    sampleNeeds: ["mes déclarations de revenus d'entreprise", "l'incorporation de ma compagnie", "un testament notarié", "des états financiers"],
    urgentNeeds: ["une mise en demeure reçue ce matin", "mes impôts en retard avec une lettre de Revenu Québec"],
  }),

  defineScript({
    id: "script_domicile",
    industry: "services_domicile",
    name: "Services à domicile — Interventions et urgences (plomberie, électricité…)",
    primaryIntent: "demande_soumission",
    greeting: "{company}, bonjour ! Ici {agent}, l'assistante virtuelle. Est-ce une urgence ou une demande de service régulière ?",
    greetingEn: "{company}, hello! This is {agent}, the virtual assistant. Is this an emergency or a regular service request?",
    questions: [
      ...BASE_QUESTIONS,
      Q("adresse", "À quelle adresse a-t-on besoin de nous ?", "What's the service address?"),
      Q("description", "Décrivez-moi le problème, s'il vous plaît.", "Please describe the problem."),
      Q("moment", "C'est pour maintenant ou on planifie un moment ?", "Is this for right now, or should we schedule?"),
    ],
    urgencyCriteria: [
      // « eau partout » / « plein d'eau » : formulations réelles entendues au premier appel live (2026-06-11).
      { keywords: ["fuite", "inondé", "inondation", "l'eau monte", "eau partout", "plein d'eau", "dégât d'eau", "plafond coule", "plus de chauffage", "court-circuit", "odeur de gaz", "refoule", "c'est une urgence"], level: "critique", note: "Urgence résidentielle active" },
      { keywords: ["aujourd'hui", "le plus vite possible"], level: "haute", note: "Demande rapide" },
    ],
    transferCriteria: [...COMMON_TRANSFERS, { condition: "Odeur de gaz ou danger électrique → consignes de sécurité + transfert immédiat", keywords: ["gaz", "étincelles", "fumée"] }],
    commonObjections: [
      { objection: "C'est combien le déplacement ?", response: "Les frais de déplacement vous sont confirmés avant l'envoi du technicien, et ils sont déduits si vous acceptez les travaux. Aucune surprise." },
    ],
    finalAction: "rappeler_immediatement",
    expectedSummary: "{nom} à {adresse} : {description}. Urgence : {moment}. Technicien à dispatcher.",
    crmTags: ["intervention", "domicile"],
    valueBaselineCad: 450,
    sampleNeeds: ["un robinet qui goutte", "l'installation d'un chauffe-eau", "une prise électrique à changer", "l'entretien de la fournaise"],
    urgentNeeds: ["un tuyau qui a pété dans le sous-sol, l'eau monte", "plus de chauffage et il fait -20", "le drain qui refoule dans le bain"],
  }),

  defineScript({
    id: "script_restaurant",
    industry: "restaurant",
    name: "Restaurant — Réservations, groupes et traiteur",
    primaryIntent: "prise_rdv",
    greeting: "Restaurant {company}, bonjour ! Ici {agent}, assistante virtuelle. C'est pour une réservation ?",
    greetingEn: "{company} restaurant, hello! This is {agent}, the virtual assistant. Calling for a reservation?",
    questions: [
      Q("nom", "C'est à quel nom ?", "Under what name?"),
      Q("telephone", "Un numéro pour confirmer la réservation ?", "A number to confirm the reservation?"),
      Q("description", "Pour combien de personnes, et une occasion spéciale ?", "For how many people, and any special occasion?"),
      Q("moment", "Quelle date et quelle heure ?", "What date and time?"),
    ],
    urgencyCriteria: [
      { keywords: ["ce soir", "groupe", "20 personnes", "traiteur", "événement corporatif"], level: "haute", note: "Réservation de groupe ou imminente = forte valeur" },
    ],
    transferCriteria: [...COMMON_TRANSFERS, { condition: "Événement privé ou traiteur > 30 personnes → gérant", keywords: ["privatiser", "traiteur"] }],
    commonObjections: [
      { objection: "Avez-vous des options sans gluten / végé ?", response: "Oui, le menu comporte des options végétariennes et sans gluten — je l'indique sur votre réservation pour que la cuisine soit prévenue." },
    ],
    finalAction: "confirmer_rdv",
    expectedSummary: "Réservation {nom} : {description}, {moment}. Confirmation SMS envoyée.",
    crmTags: ["reservation", "restaurant"],
    valueBaselineCad: 180,
    sampleNeeds: ["une table pour deux vendredi soir", "une réservation pour 8 personnes samedi", "un souper d'anniversaire", "le menu du jour"],
    urgentNeeds: ["un souper corporatif de 25 personnes jeudi prochain"],
  }),

  defineScript({
    id: "script_maintenance",
    industry: "maintenance",
    name: "Maintenance — Contrats commerciaux et appels de service",
    primaryIntent: "demande_soumission",
    greeting: "{company} maintenance, bonjour. Ici {agent}, assistante virtuelle. Est-ce un appel de service ou une demande de contrat ?",
    greetingEn: "{company} maintenance, hello. This is {agent}, the virtual assistant. Is this a service call or a contract inquiry?",
    questions: [
      ...BASE_QUESTIONS,
      Q("adresse", "Quelle est l'adresse du bâtiment concerné ?", "What's the building address?"),
      Q("description", "Quel équipement ou système est en cause ?", "Which equipment or system is involved?"),
      Q("moment", "Quel est le niveau de priorité de votre côté ?", "What's the priority on your end?"),
    ],
    urgencyCriteria: [
      { keywords: ["arrêt de production", "panne", "alarme", "hvac", "climatisation morte"], level: "critique", note: "Équipement critique en panne" },
      { keywords: ["préventif", "contrat"], level: "normale", note: "Demande planifiable" },
    ],
    transferCriteria: COMMON_TRANSFERS,
    commonObjections: [
      { objection: "On a déjà un fournisseur.", response: "Parfait — plusieurs clients nous gardent en deuxième fournisseur pour les urgences. Je peux noter vos infos pour qu'on vous envoie notre grille de service ?" },
    ],
    finalAction: "creer_suivi",
    expectedSummary: "{nom} ({adresse}) : {description}. Priorité {moment}. Soumission ou dispatch selon urgence.",
    crmTags: ["maintenance", "b2b"],
    valueBaselineCad: 900,
    sampleNeeds: ["un contrat d'entretien préventif pour nos unités HVAC", "une inspection annuelle", "le remplacement d'un compresseur"],
    urgentNeeds: ["la climatisation du serveur informatique qui est morte", "une alarme de gicleurs qui sonne sans raison"],
  }),

  defineScript({
    id: "script_nettoyage",
    industry: "nettoyage",
    name: "Nettoyage — Soumissions résidentielles et commerciales",
    primaryIntent: "demande_soumission",
    greeting: "{company}, bonjour ! Ici {agent}, assistante virtuelle. C'est pour un nettoyage résidentiel ou commercial ?",
    greetingEn: "{company}, hello! This is {agent}, the virtual assistant. Is this for residential or commercial cleaning?",
    questions: [
      ...BASE_QUESTIONS,
      Q("adresse", "Quelle est l'adresse à nettoyer ?", "What's the address to clean?"),
      Q("description", "Quelle superficie ou combien de pièces, et quelle fréquence ?", "What size or how many rooms, and how often?"),
      Q("moment", "Pour quand aimeriez-vous le premier nettoyage ?", "When would you like the first cleaning?"),
    ],
    urgencyCriteria: [
      { keywords: ["après sinistre", "dégât", "avant déménagement", "demain"], level: "haute", note: "Délai court ou post-sinistre" },
    ],
    transferCriteria: COMMON_TRANSFERS,
    commonObjections: [
      { objection: "C'est combien de l'heure ?", response: "On fonctionne par soumission selon la superficie plutôt qu'à l'heure — c'est plus prévisible pour vous. Je note les détails et vous recevez un prix fixe aujourd'hui même." },
    ],
    finalAction: "envoyer_soumission",
    expectedSummary: "{nom} — {description} à {adresse}. Début : {moment}. Soumission à envoyer.",
    crmTags: ["soumission", "nettoyage"],
    valueBaselineCad: 380,
    sampleNeeds: ["un ménage régulier aux deux semaines", "un grand ménage du printemps", "le nettoyage de nos bureaux le soir", "un nettoyage après construction"],
    urgentNeeds: ["un nettoyage complet avant la remise des clés demain"],
  }),

  defineScript({
    id: "script_consultant",
    industry: "consultant",
    name: "Consultant — Qualification d'appels découverte",
    primaryIntent: "demande_soumission",
    greeting: "Bonjour, bureau de {company}. Ici {agent}, assistante virtuelle. Puis-je prendre quelques informations pour préparer votre appel découverte ?",
    greetingEn: "Hello, {company}'s office. This is {agent}, the virtual assistant. May I take a few details to prepare your discovery call?",
    questions: [
      ...BASE_QUESTIONS,
      Q("description", "Quel est le défi principal sur lequel vous cherchez de l'aide ?", "What's the main challenge you need help with?"),
      Q("budget", "Avez-vous une enveloppe budgétaire approximative ?", "Do you have an approximate budget?", false),
      Q("moment", "Quand souhaitez-vous démarrer ?", "When would you like to start?"),
    ],
    urgencyCriteria: [
      { keywords: ["conseil d'administration", "lancement", "crise", "ce mois-ci"], level: "haute", note: "Mandat à délai court" },
    ],
    transferCriteria: COMMON_TRANSFERS,
    commonObjections: [
      { objection: "Je veux juste parler au consultant directement.", response: "Bien sûr. Ces deux ou trois questions me permettent justement de réserver le bon créneau et que l'appel soit utile dès la première minute." },
    ],
    finalAction: "creer_suivi",
    expectedSummary: "{nom} : défi « {description} ». Budget : {budget}. Démarrage : {moment}. Appel découverte à planifier.",
    crmTags: ["lead-consultation", "decouverte"],
    valueBaselineCad: 2500,
    sampleNeeds: ["structurer notre croissance", "un diagnostic de nos opérations", "de l'aide pour une demande de subvention", "un plan stratégique"],
    urgentNeeds: ["préparer une présentation au CA dans dix jours"],
  }),

  defineScript({
    id: "script_agence",
    industry: "agence",
    name: "Agence — Qualification de nouveaux mandats",
    primaryIntent: "demande_soumission",
    greeting: "Agence {company}, bonjour ! Ici {agent}, assistante virtuelle. Parlez-moi de votre projet !",
    greetingEn: "{company} agency, hello! This is {agent}, the virtual assistant. Tell me about your project!",
    questions: [
      ...BASE_QUESTIONS,
      Q("description", "Quel type de projet avez-vous en tête ?", "What kind of project do you have in mind?"),
      Q("budget", "Quelle enveloppe budgétaire visez-vous ?", "What budget range are you targeting?", false),
      Q("moment", "Quelle est votre date de lancement idéale ?", "What's your ideal launch date?"),
    ],
    urgencyCriteria: [
      { keywords: ["lancement", "campagne", "appel d'offres", "date ferme"], level: "haute", note: "Date de lancement contraignante" },
    ],
    transferCriteria: COMMON_TRANSFERS,
    commonObjections: [
      { objection: "Pouvez-vous m'envoyer votre portfolio ?", response: "Avec plaisir — je note votre courriel et vous recevez le portfolio avec quelques études de cas pertinentes à votre secteur d'ici la fin de la journée." },
    ],
    finalAction: "creer_suivi",
    expectedSummary: "{nom} — projet : {description}. Budget : {budget}. Lancement : {moment}. Brief à préparer.",
    crmTags: ["lead-agence", "nouveau-mandat"],
    valueBaselineCad: 5000,
    sampleNeeds: ["une refonte de notre site web", "une campagne pour le lancement d'un produit", "la gestion de nos réseaux sociaux", "une nouvelle image de marque"],
    urgentNeeds: ["une campagne à lancer avant le Black Friday"],
  }),
];

export function getScriptById(id: string): IndustryScript | undefined {
  return INDUSTRY_SCRIPTS.find((s) => s.id === id);
}

export function getScriptByIndustry(industry: Industry): IndustryScript {
  const found = INDUSTRY_SCRIPTS.find((s) => s.industry === industry);
  if (!found) throw new Error(`Aucun script pour l'industrie ${industry}`);
  return found;
}
