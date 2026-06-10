/**
 * Personas d'appelants pour le simulateur — comportements FR-QC réalistes.
 * Tous les noms, numéros et adresses sont FICTIFS (préfixe 555).
 */
import type { CallerPersona } from "@/domain/persona";
import type { FieldKey } from "@/domain/script";

/** Banque de réponses par défaut quand un persona n'a pas de réponse spécifique. */
export const FIELD_BANK: Record<FieldKey, string[]> = {
  nom: ["Marc-André Gagnon", "Julie Tremblay", "Sylvain Côté", "Karine Bouchard", "Dave Morin", "Mélanie Nguyen", "Patrick Lavoie", "Isabelle Roy"],
  telephone: ["514-555-0132", "450-555-0188", "418-555-0147", "514-555-0166", "438-555-0102", "450-555-0124"],
  adresse: ["4520 rue Saint-Hubert à Montréal", "182 boulevard des Laurentides à Laval", "77 avenue Cartier à Québec", "960 rue King Ouest à Sherbrooke", "315 rue Notre-Dame à Repentigny", "28 rue des Érables à Boucherville"],
  courriel: ["m.gagnon@exemple.ca", "julie.t@exemple.ca", "scote@exemple.ca", "kbouchard@exemple.ca"],
  description: ["c'est pas mal ça le besoin", "comme je vous disais, c'est ce qu'il me faut"],
  moment: ["le plus tôt possible", "cette semaine idéalement", "la semaine prochaine, je suis flexible", "samedi matin si possible", "d'ici la fin du mois"],
  budget: ["autour de 5 000 $", "entre 2 000 et 3 000 $", "je ne sais pas trop, ça dépend du prix", "max 10 000 $"],
  vehicule: ["une Honda Civic 2019", "un Ford F-150 2021", "une Toyota RAV4 2017", "une Mazda 3 2020"],
  animal: ["mon chien Léo, un labrador", "ma chatte Mimi", "mon golden Charlie", "mon chat Caramel"],
  propriete: ["un condo dans Rosemont", "une maison à Terrebonne", "un duplex dans Hochelaga", "un bungalow à Sainte-Julie"],
};

export const PERSONAS: CallerPersona[] = [
  {
    id: "persona_urgence",
    label: "Urgence réelle (forte valeur, stress élevé)",
    archetype: "urgence",
    language: "fr",
    valueTier: "haut",
    cooperative: true,
    objectionChance: 0,
    openers: [
      "Oui bonjour, j'ai un problème là, c'est urgent : j'ai {service} !",
      "Allô ? J'espère que vous pouvez m'aider vite, j'ai {service} pis ça empire là.",
      "Bonjour, c'est vraiment pressant — {service}, il faut quelqu'un aujourd'hui.",
    ],
    fieldAnswers: {
      moment: ["là là, maintenant", "aujourd'hui sans faute", "dès que quelqu'un peut venir"],
    },
    names: ["Sylvain Côté", "Nathalie Bergeron", "Éric Fortin"],
    phones: ["514-555-0190", "450-555-0177"],
  },
  {
    id: "persona_magasineur",
    label: "Magasineur (compare 3 fournisseurs)",
    archetype: "magasineur",
    language: "fr",
    valueTier: "moyen",
    cooperative: true,
    objectionChance: 0.9,
    openers: [
      "Bonjour, je suis en train de comparer quelques compagnies pour {service}. Pouvez-vous m'en dire plus ?",
      "Oui allô, c'est combien chez vous pour {service} ?",
    ],
    fieldAnswers: {
      moment: ["pas pressé, je compare encore", "d'ici un mois peut-être"],
      budget: ["ça va dépendre des prix que je reçois"],
    },
    names: ["Julie Tremblay", "Martin Pelletier", "Annie Girard"],
    phones: ["438-555-0151", "514-555-0143"],
  },
  {
    id: "persona_regulier",
    label: "Client régulier (connu, fidèle)",
    archetype: "client_regulier",
    language: "fr",
    valueTier: "moyen",
    cooperative: true,
    objectionChance: 0.1,
    openers: [
      "Salut, c'est un client régulier ici — j'aurais besoin de {service} encore cette année.",
      "Bonjour ! Vous êtes déjà venus chez nous. Cette fois c'est pour {service}.",
    ],
    fieldAnswers: {},
    names: ["Patrick Lavoie", "Isabelle Roy", "Robert Lemieux"],
    phones: ["450-555-0124", "418-555-0139"],
  },
  {
    id: "persona_presse",
    label: "Pressé (répond court, raccroche vite)",
    archetype: "presse",
    language: "fr",
    valueTier: "moyen",
    cooperative: false,
    objectionChance: 0.3,
    openers: [
      "Oui bonjour, j'ai deux minutes — {service}, c'est possible ou pas ?",
      "Allô, vite vite : {service}. Vous faites ça ?",
    ],
    fieldAnswers: {
      description: ["c'est ça, exactement ce que j'ai dit"],
      moment: ["le plus vite possible, je n'ai pas le temps de niaiser"],
    },
    names: ["Dave Morin", "Caroline Houde"],
    phones: ["514-555-0166"],
  },
  {
    id: "persona_frustre",
    label: "Frustré / plainte (risque de churn)",
    archetype: "frustre",
    language: "fr",
    valueTier: "bas",
    cooperative: true,
    objectionChance: 0.6,
    openers: [
      "Bonjour. Écoutez, je ne suis vraiment pas content du service que j'ai reçu pour {service}.",
      "Oui, j'appelle parce que ça fait deux fois que je laisse un message à propos de {service} pis personne ne me rappelle.",
    ],
    fieldAnswers: {
      moment: ["j'attends déjà depuis trop longtemps"],
    },
    names: ["Mélanie Nguyen", "Stéphane Dubé"],
    phones: ["450-555-0118"],
  },
  {
    id: "persona_anglophone",
    label: "Anglophone (test de bascule FR→EN)",
    archetype: "anglophone",
    language: "en",
    valueTier: "haut",
    cooperative: true,
    objectionChance: 0.2,
    openers: [
      "Hi, sorry — do you speak English? I'm calling about {service}.",
      "Hello! I was referred to you for {service}. Hopefully you can help me in English?",
    ],
    fieldAnswers: {
      nom: ["Sarah Thompson", "Mike O'Brien", "Jennifer Walsh"],
      telephone: ["514-555-0171", "438-555-0195"],
      moment: ["as soon as possible", "sometime next week"],
      adresse: ["210 Lakeshore Drive in Pointe-Claire", "45 Westminster Avenue in Montreal West"],
      courriel: ["sarah.t@example.ca", "mike.ob@example.ca"],
      budget: ["around $8,000", "somewhere between $3,000 and $5,000"],
      vehicule: ["a 2020 Subaru Outback", "a 2018 Jeep Wrangler"],
      animal: ["my dog Max, a border collie", "my cat Whiskers"],
      propriete: ["a house in Beaconsfield", "a condo in Griffintown"],
    },
    names: ["Sarah Thompson", "Mike O'Brien"],
    phones: ["514-555-0171"],
  },
  {
    id: "persona_spam",
    label: "Spam / fournisseur (valeur nulle)",
    archetype: "spam_fournisseur",
    language: "fr",
    valueTier: "nul",
    cooperative: false,
    objectionChance: 0,
    openers: [
      "Bonjour, je vous appelle concernant le référencement Google de votre entreprise — une offre exclusive ce mois-ci.",
      "Oui bonjour, c'est pour parler au responsable des télécommunications de l'entreprise, on a une promotion.",
    ],
    fieldAnswers: {
      nom: ["Représentant SoluWeb", "Agence MaxiRank"],
      telephone: ["1-800-555-0100"],
    },
    names: ["Représentant SoluWeb"],
    phones: ["1-800-555-0100"],
  },
];

export function getPersonaById(id: string): CallerPersona | undefined {
  return PERSONAS.find((p) => p.id === id);
}
