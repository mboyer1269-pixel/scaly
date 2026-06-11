/**
 * Scénarios du Voice Runtime Lab — golden conversations.
 * Chaque scénario est un banc d'essai déterministe du runtime : mêmes tours,
 * même seed → même session. Les `expected` sont verrouillés en CI
 * (tests/voice-scenarios.test.ts) : toute régression conversationnelle casse le build.
 */
import type { VoiceScenario } from "@/domain/voice";
import { DEFAULT_COMPANY_ID } from "./companies";

export const VOICE_SCENARIOS: VoiceScenario[] = [
  {
    id: "vs_fr_simple",
    title: "FR — Demande claire et complète",
    description: "Un client francophone calme : robinet qui coule, toutes les informations données sans friction.",
    proves: "Le parcours nominal : qualification complète en 5 tours, fiche prête au rappel.",
    companyId: DEFAULT_COMPANY_ID,
    scriptId: "script_domicile",
    seed: 4001,
    callerTurns: [
      { text: "Bonjour ! J'appelle pour un robinet qui coule dans la cuisine. Je m'appelle Martin Leblanc." },
      { text: "C'est le 514-555-0182." },
      { text: "Au 88 rue Principale à Longueuil." },
      { text: "Cette semaine idéalement, mercredi matin si possible." },
      { text: "Oui, c'est parfait, merci !" },
    ],
    expected: { finalStatus: "completed", transferRequested: false, minFieldsConfirmed: 3, maxFieldsMissing: 1, dominantLanguage: "fr" },
  },
  {
    id: "vs_en_simple",
    title: "EN — Clear request",
    description: "Une cliente anglophone : chauffe-eau qui fuit, qualification entièrement en anglais.",
    proves: "L'agent détecte l'anglais au premier tour et mène toute la qualification en anglais.",
    companyId: DEFAULT_COMPANY_ID,
    scriptId: "script_domicile",
    seed: 4002,
    callerTurns: [
      { text: "Hi, sorry — do you speak English? My name is Sarah Thompson and my water heater is leaking." },
      { text: "It's 514-555-0171." },
      { text: "210 Lakeshore Drive in Pointe-Claire." },
      { text: "Tomorrow morning would be great, please." },
      { text: "Yes, that's right, thank you!" },
    ],
    expected: { finalStatus: "completed", transferRequested: false, minFieldsConfirmed: 3, maxFieldsMissing: 1, dominantLanguage: "en" },
  },
  {
    id: "vs_bilingue_gatineau",
    title: "Bilingue — Gatineau/Ottawa, switch FR → EN → FR",
    description: "Couple frontalier : madame commence en français, bascule en anglais pour les coordonnées de son mari, puis revient au français.",
    proves: "Le runtime suit chaque switch de langue, répond dans la langue du client et garde les champs normalisés.",
    companyId: DEFAULT_COMPANY_ID,
    scriptId: "script_domicile",
    seed: 4003,
    callerTurns: [
      { text: "Bonjour, j'appelle pour l'installation d'un chauffe-eau à notre duplex. Je m'appelle Karine Dupuis." },
      { text: "Sorry, can we continue in English? My husband handles this — you can reach him at 819-555-0167.", lang: "en" },
      { text: "It's 145 boulevard Saint-Joseph in Gatineau.", lang: "en" },
      { text: "On peut revenir en français ? La semaine prochaine, mardi si possible.", lang: "fr" },
      { text: "Oui c'est exact, merci beaucoup !" },
    ],
    expected: { finalStatus: "completed", transferRequested: false, minFieldsConfirmed: 3, maxFieldsMissing: 1, minLanguageSwitches: 2, dominantLanguage: "fr" },
  },
  {
    id: "vs_frustre_transfert",
    title: "Client frustré — transfert humain immédiat",
    description: "Un client en colère après trois appels sans rappel exige de parler à un humain.",
    proves: "La règle non négociable : demande d'humain = transfert immédiat, avec raison d'escalade tracée.",
    companyId: DEFAULT_COMPANY_ID,
    scriptId: "script_domicile",
    seed: 4004,
    callerTurns: [
      { text: "Écoutez, ça fait trois fois que j'appelle pour ma fournaise pis personne ne me rappelle. C'est inacceptable. Je veux parler à un humain, pas à un robot !" },
    ],
    expected: { finalStatus: "completed", transferRequested: true, minFieldsConfirmed: 0, maxFieldsMissing: 6, dominantLanguage: "fr" },
  },
  {
    id: "vs_bruite_incomplet",
    title: "Appel bruité — champs manquants + clarifications",
    description: "Appel depuis un chantier : coupures, répétitions demandées, l'appelant raccroche avant de donner son numéro.",
    proves: "Scaly sait dire « je ne sais pas encore » : clarifications, fiche incomplète assumée, échec propre.",
    companyId: DEFAULT_COMPANY_ID,
    scriptId: "script_domicile",
    seed: 4005,
    callerTurns: [
      { text: "Allô ? ... euh..." },
      { text: "Oui pardon, je vous appelle du chantier, ça coupe. C'est pour une prise électrique à changer chez nous." },
      { text: "C'est Stéphane Bergeron. Là je dois y aller bientôt, faites ça vite !" },
      { text: "..." },
      { text: "..." },
    ],
    expected: { finalStatus: "failed", transferRequested: false, minFieldsConfirmed: 1, maxFieldsMissing: 5, dominantLanguage: "fr" },
  },
  {
    id: "vs_barge_in_urgence",
    title: "Barge-in — urgence qui coupe l'agente",
    description: "L'appelant interrompt la question de l'agente : dégât d'eau actif. Fast-track adresse + téléphone, puis transfert à l'équipe de garde.",
    proves: "Le contrat d'interruption : réponse marquée coupée, état repris proprement, priorités recalculées.",
    companyId: DEFAULT_COMPANY_ID,
    scriptId: "script_domicile",
    seed: 4006,
    callerTurns: [
      { text: "Bonjour, j'ai besoin d'un plombier s'il vous plaît." },
      { text: "Attendez, c'est une urgence là ! J'ai un dégât d'eau, l'eau monte dans le sous-sol !", interrupt: true },
      { text: "Au 112 rue Lavigne à Brossard !" },
      { text: "Le 450-555-0123, faites vite !" },
    ],
    expected: { finalStatus: "completed", transferRequested: true, minFieldsConfirmed: 2, maxFieldsMissing: 4, minInterruptions: 1, dominantLanguage: "fr" },
  },
];

export function getVoiceScenarioById(id: string): VoiceScenario | undefined {
  return VOICE_SCENARIOS.find((s) => s.id === id);
}
