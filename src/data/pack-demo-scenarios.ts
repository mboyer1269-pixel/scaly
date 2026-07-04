/**
 * Scénarios de DÉMONSTRATION par pack d'industrie.
 * Chacun fait tourner LE VRAI cerveau vocal (voice-runtime, verrouillé en CI)
 * sur un appel réaliste — pas une maquette. C'est la preuve vivante, par
 * verticale, de « capacité + efficacité » qu'on met devant un prospect.
 *
 * HONNÊTETÉ : mêmes tours + même seed → même appel (déterministe). Les `expected`
 * sont verrouillés sur ce que le runtime produit RÉELLEMENT (tests/pack-demo.test.ts),
 * jamais sur un comportement souhaité mais absent.
 *
 * Réutilise `companyId`/`scriptId` des données seed : aucune nouvelle compagnie,
 * aucun script inventé. Le champ est piloté par le script existant.
 */
import type { VoiceScenario } from "@/domain/voice";

/**
 * Divulgation PUBLIQUE non négociable : on ne prétend JAMAIS que c'est un vrai
 * appel client. C'est une simulation contrôlée du traitement d'Allô Maude.
 * Testée en CI (tests/audio-proof.test.ts) — le wording ne peut pas dériver.
 */
export const PUBLIC_DISCLOSURE =
  "Simulation vocale basée sur un scénario représentatif. Ce n'est pas un appel client réel.";

/** Casting des voix TTS (noms de voix OpenAI) — Maude constante pour la marque. */
export interface PackDemoVoices {
  /** Voix de l'assistante (calme, professionnelle, rassurante). */
  maude: string;
  /** Voix de l'appelant (naturelle, pas caricaturale). */
  caller: string;
  /** Consigne de ton pour l'appelant (FR-CA naturel). */
  callerTone: string;
}

export interface PackDemoScenario extends VoiceScenario {
  /** Nom du pack tel qu'affiché au prospect. */
  packLabel: string;
  /** Le « moment argent » : ce que la démo doit faire ressentir. */
  hook: string;
  /** Ce qui aurait été perdu si l'appel avait été manqué (cadrage récupération). */
  missedCallCost: string;
  /** Divulgation affichée sous le lecteur audio (honnêteté). */
  disclosureLabel: string;
  /** Casting des voix pour le générateur TTS optionnel. */
  voices: PackDemoVoices;
  /**
   * Overrides VITRINE (« démonstrateur ») — appliqués À L'AFFICHAGE et à l'audio
   * SEULEMENT. Le moteur (voice-runtime) et le golden set restent intacts : on
   * ne renomme jamais le seed. Persona de marque, entreprise fictive, et ligne
   * d'accueil verrouillée (naming produit : Maude / AutoHorizon).
   */
  personaName?: string;
  brandCompanyName?: string;
  openingLine?: string;
}

/**
 * Ligne d'accueil VERROUILLÉE de la vitrine concessionnaire (démonstrateur).
 * Identique à VOICE_GATE_SCRIPT[0] (un test empêche la dérive). Naming produit :
 * persona = Maude, entreprise fictive = AutoHorizon. Jamais « assistante virtuelle ».
 */
export const HERO_OPENING_LINE =
  "Bonjour, merci d'appeler chez AutoHorizon, ici Maude. Comment puis-je vous aider aujourd'hui?";

const MAUDE_VOICE = "sage"; // voix constante d'Allô Maude (calme, pro)

export const PACK_DEMO_SCENARIOS: PackDemoScenario[] = [
  {
    id: "demo_concessionnaire",
    packLabel: "Concessionnaire auto",
    title: "Lead de vente chaud → transfert vendeur en direct",
    description:
      "Un acheteur prêt appelle pour un modèle vu en ligne et demande un essai routier. L'IA capte le lead, détecte l'intention chaude et transfère au vendeur sans le laisser refroidir.",
    proves:
      "Speed-to-lead : un acheteur prêt n'attend jamais. Fiche captée + transfert humain immédiat sur demande, avec raison d'escalade tracée.",
    hook: "Le lead le plus payant d'un concessionnaire, c'est celui qui appelle prêt à acheter. Rater cet appel, c'est le donner au concurrent.",
    missedCallCost: "Un acheteur prêt qui tombe sur une boîte vocale rappelle rarement — il appelle le concessionnaire suivant.",
    disclosureLabel: PUBLIC_DISCLOSURE,
    voices: { maude: MAUDE_VOICE, caller: "echo", callerTone: "Homme, la quarantaine, français québécois naturel, motivé et pressé mais poli." },
    personaName: "Maude",
    brandCompanyName: "AutoHorizon",
    openingLine: HERO_OPENING_LINE,
    companyId: "comp_horizon",
    scriptId: "script_concessionnaire",
    seed: 7001,
    callerTurns: [
      { text: "Bonjour, je m'appelle Éric Tremblay. J'appelle pour le RAV4 hybride 2024 que j'ai vu sur votre site, je suis prêt à l'acheter." },
      { text: "C'est le 819-555-0142." },
      { text: "Aujourd'hui si possible, je veux faire un essai routier. Transfère-moi à quelqu'un aux ventes, s'il vous plaît." },
    ],
    expected: { finalStatus: "completed", transferRequested: true, minFieldsConfirmed: 3, maxFieldsMissing: 2, dominantLanguage: "fr" },
  },
  {
    id: "demo_dentaire",
    packLabel: "Clinique dentaire",
    title: "Douleur active → rendez-vous en plage d'urgence",
    description:
      "Une patiente avec une douleur active appelle. L'IA qualifie le besoin, reconnaît l'urgence (sans faire de triage médical) et réserve la première disponibilité.",
    proves:
      "Qualification santé sûre : capte le besoin et la douleur, marque l'urgence, NE pose AUCUN diagnostic. Fiche prête pour la plage du jour.",
    hook: "Une clinique dentaire perd des patients dès la première sonnerie manquée. L'IA répond, rassure et réserve.",
    missedCallCost: "Un patient avec une douleur active ne laisse pas de message : il appelle la prochaine clinique qui décroche.",
    disclosureLabel: PUBLIC_DISCLOSURE,
    voices: { maude: MAUDE_VOICE, caller: "coral", callerTone: "Femme, français québécois naturel, inconfort réel, ton un peu inquiet mais posé." },
    companyId: "comp_sourire",
    scriptId: "script_dentiste",
    seed: 7002,
    callerTurns: [
      { text: "Bonjour, ici Sophie Gagnon. J'ai une dent sensible et une douleur depuis hier, j'aimerais voir quelqu'un rapidement." },
      { text: "Oui, mon numéro c'est le 514-555-0173." },
      { text: "J'ai besoin d'un rendez-vous pour une douleur à une molaire en bas à droite." },
      { text: "Le plus tôt possible, aujourd'hui ou demain matin." },
      { text: "Oui, parfait, merci beaucoup !" },
    ],
    expected: { finalStatus: "completed", transferRequested: false, minFieldsConfirmed: 3, maxFieldsMissing: 2, dominantLanguage: "fr" },
  },
  {
    id: "demo_pme",
    packLabel: "PME de services (Allô Maude)",
    title: "Appel complet → fiche prête, zéro appel manqué",
    description:
      "Une cliente appelle pour planifier une intervention. L'IA mène la qualification de bout en bout et remet une fiche complète prête pour le rappel et la confirmation SMS.",
    proves:
      "Le parcours nominal d'une réceptionniste IA : nom, adresse, téléphone, besoin et moment captés, récapitulés et confirmés — fiche complète en une minute.",
    hook: "Chaque appel manqué d'une PME de services est un client qui va ailleurs. Maude répond 24/7 et ne perd jamais une fiche.",
    missedCallCost: "Un client qui veut réserver et tombe sur un répondeur est un mandat perdu — souvent définitivement.",
    disclosureLabel: PUBLIC_DISCLOSURE,
    voices: { maude: MAUDE_VOICE, caller: "nova", callerTone: "Femme, français québécois naturel, chaleureuse et pratique." },
    companyId: "comp_maude",
    scriptId: "script_domicile",
    seed: 7003,
    callerTurns: [
      { text: "Bonjour ! Je m'appelle Julie Bouchard, j'appelle pour faire installer un chauffe-eau chez nous." },
      { text: "Mon numéro, c'est le 450-555-0188." },
      { text: "C'est au 1450 rue des Ormes à Laval." },
      { text: "Cette semaine, jeudi serait parfait." },
      { text: "Oui, c'est en plein ça, merci beaucoup !" },
    ],
    expected: { finalStatus: "completed", transferRequested: false, minFieldsConfirmed: 2, maxFieldsMissing: 1, dominantLanguage: "fr" },
  },
];

export function getPackDemoScenarioById(id: string): PackDemoScenario | undefined {
  return PACK_DEMO_SCENARIOS.find((s) => s.id === id);
}
