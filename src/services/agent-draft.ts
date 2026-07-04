/**
 * Service — Prompt → Agent Draft (Agent Operating Backend v1, ADR-021).
 *
 * draftAgentDefinitionFromPrompt(prompt) prouve le principe « prompt → app
 * agentique structurée » : une phrase de fondateur devient une AgentDefinition
 * validée, avec capabilities suggérées, risques, données requises, métriques
 * ROI et première démo possible.
 *
 * HONNÊTETÉ ARCHITECTURALE : c'est un mapper DÉTERMINISTE à mots-clés, pas un
 * LLM — trois verticales connues + un repli PME générique. Le jour où un LLM
 * remplace le matcher, il devra produire la MÊME structure et passer la MÊME
 * validation (validateAgentDefinition) : le contrat est la vraie valeur, pas
 * le générateur. Fonction pure : aucune IO, résultat identique à prompt égal.
 */
import type { AgentDefinition, AgentRoiMetric, AgentVertical } from "@/domain/agent-definition";
import { REQUIRED_BACKEND_BINDINGS } from "@/domain/agent-definition";
import type { CapabilityId } from "@/domain/capability";
import { DEFAULT_SAFETY_RULES } from "@/domain/agent";
import { validateAgentDefinition } from "@/data/agent-definitions";

export interface SuggestedCapability {
  capabilityId: CapabilityId;
  why: string;
}

export interface AgentDraftResult {
  /** Verticale reconnue par le matcher — `generic` si aucun mot-clé ne matche. */
  matchedVertical: AgentVertical | "generic";
  matchLabel: string;
  /** Définition draft VALIDÉE (mêmes invariants que Maude, status: draft). */
  definition: AgentDefinition;
  suggestedCapabilities: SuggestedCapability[];
  risks: string[];
  requiredData: string[];
  roiMetrics: AgentRoiMetric[];
  /** La première démo qu'on peut montrer avec le backend actuel, sans code neuf. */
  firstDemo: string;
  /** Rappel non négociable : draft déterministe, jamais présenté comme magie. */
  honesty: string;
}

/** Normalisation FR : minuscules + accents retirés, pour un matching robuste. */
function normalize(prompt: string): string {
  return prompt
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

interface VerticalBlueprint {
  keywords: string[];
  vertical: AgentVertical | "generic";
  matchLabel: string;
  idSlug: string;
  name: string;
  persona: string;
  capabilities: SuggestedCapability[];
  risks: string[];
  requiredData: string[];
  roiMetrics: AgentRoiMetric[];
  firstDemo: string;
}

const CAD_BASELINE_METRIC = (label: string, method: string): AgentRoiMetric => ({
  id: "protected_revenue_cad",
  label,
  unit: "cad",
  method,
  basis: "estimated_baseline",
});

const BLUEPRINTS: VerticalBlueprint[] = [
  {
    keywords: ["dentaire", "dentiste", "dental", "orthodont", "hygieniste"],
    vertical: "dentiste",
    matchLabel: "Clinique dentaire",
    idSlug: "draft-receptionniste-dentaire",
    name: "Réceptionniste IA — clinique dentaire",
    persona:
      "Réceptionniste calme et rassurante : accueille, qualifie la douleur sans jamais diagnostiquer, " +
      "protège l'horaire de la clinique en remplissant les annulations.",
    capabilities: [
      { capabilityId: "appointment_gap_recovery", why: "Une annulation de nettoyage ou de traitement est une perte sèche — la liste de relance la comble (cancellation recovery)." },
      { capabilityId: "consent_capture", why: "Relance et rappels exigent un consentement capté verbatim (Loi 25, ADR-018)." },
      { capabilityId: "human_handoff", why: "Douleur aiguë ou urgence dentaire → un humain, jamais l'IA seule." },
      { capabilityId: "owner_notification", why: "La dentiste veut savoir immédiatement quand un patient en douleur appelle." },
      { capabilityId: "roi_reporting", why: "Prouver en dollars ce que les plages comblées rapportent." },
    ],
    risks: [
      "Données de santé incidentes : le motif de rendez-vous peut révéler une condition — minimisation et rétention strictes obligatoires.",
      "Jamais de diagnostic ni de conseil médical — prudence scriptée, transfert au moindre doute.",
      "Le calendrier reste dans le PMS de la clinique : sans intégration, les plages sont décrites à la main.",
    ],
    requiredData: ["Numéro Twilio dédié", "transferPhone (urgences)", "Taxonomie des soins (nettoyage, examen, traitement)", "Barème de valeur par soin", "Heures d'ouverture"],
    roiMetrics: [
      CAD_BASELINE_METRIC("Valeur des plages comblées", "Plages comblées × valeur moyenne du soin (barème dentaire, à recalibrer avec la clinique)."),
      { id: "filled_gaps_count", label: "Annulations comblées", unit: "count", method: "AppointmentGap passées à filled sur la période.", basis: "measured" },
      { id: "consents_captured_count", label: "Consentements captés", unit: "count", method: "ConsentRecord actifs au coffre.", basis: "measured" },
    ],
    firstDemo:
      "Simuler dans /voice-lab un patient qui annule son nettoyage, ouvrir la plage dans /annulations, " +
      "et montrer l'offre SMS consentie qui part vers la liste d'attente — bout en bout, sans code neuf.",
  },
  {
    keywords: ["concessionnaire", "dealer", "vehicule", "voiture", "automobile", "essai routier", "vus"],
    vertical: "concessionnaire_auto",
    matchLabel: "Concessionnaire automobile",
    idSlug: "draft-agent-service-concessionnaire",
    name: "Agent de service — concessionnaire",
    persona:
      "Agent de service énergique et précis : répond au département de service, suit les rendez-vous " +
      "d'entretien, récupère les no-show et route vers ventes/service/pièces.",
    capabilities: [
      { capabilityId: "appointment_gap_recovery", why: "Un rendez-vous de service annulé = une baie vide — la relance le comble (appointment recovery)." },
      { capabilityId: "opportunity_detection", why: "Chaque appel de statut d'entretien est une occasion de vente additionnelle détectable (service status)." },
      { capabilityId: "missed_call_rescue", why: "Le département de service manque des appels aux heures de pointe — chaque appel perdu reçoit un SMS < 2 min." },
      { capabilityId: "human_handoff", why: "Question de prix ferme ou de financement → un conseiller humain, jamais l'IA." },
      { capabilityId: "consent_capture", why: "Rappels d'entretien saisonniers = sollicitation : opt-in exprès obligatoire (CRTC)." },
      { capabilityId: "roi_reporting", why: "Le directeur de service veut le chiffre : baies remplies, appels sauvés, valeur protégée." },
    ],
    risks: [
      "Le statut RÉEL d'un véhicule vit dans le DMS : sans intégration, l'agent ne peut que prendre le message et promettre un rappel — jamais inventer un statut.",
      "Jamais de prix ferme ni d'offre de financement — estimation à confirmer par un humain, toujours.",
      "Volume d'appels élevé : le routage ventes/service/pièces doit être configuré avant la mise en service.",
    ],
    requiredData: ["Numéro Twilio du département service", "transferPhone par département", "Intégration DMS (statut des véhicules) — À VENIR", "Barème de valeur par rendez-vous service", "Heures des départements"],
    roiMetrics: [
      CAD_BASELINE_METRIC("Valeur des baies protégées", "Rendez-vous service récupérés × valeur moyenne d'un passage au service (barème concessionnaire)."),
      { id: "rescued_calls_count", label: "Appels sauvés", unit: "count", method: "Appels manqués ayant reçu un SMS de sauvetage.", basis: "measured" },
      { id: "filled_gaps_count", label: "Rendez-vous comblés", unit: "count", method: "AppointmentGap passées à filled.", basis: "measured" },
    ],
    firstDemo:
      "Simuler un client qui annule son entretien de 14 h, montrer la relance des clients en attente " +
      "dans /annulations, puis la file d'opportunités (/opportunites) qui priorise le no-show à rattraper.",
  },
  {
    keywords: ["courtier", "immobilier", "maison", "propriete", "inscription", "visite libre", "real estate"],
    vertical: "courtier_immobilier",
    matchLabel: "Courtier immobilier",
    idSlug: "draft-assistant-relance-courtier",
    name: "Assistant de relance — courtier immobilier",
    persona:
      "Assistant discret et rapide : chaque appel manqué pendant une visite devient un SMS en moins de " +
      "deux minutes, chaque acheteur sérieux est suivi — le courtier ne perd plus de mandat faute de rappel.",
    capabilities: [
      { capabilityId: "missed_call_rescue", why: "Le courtier est en visite quand les acheteurs appellent — le SMS < 2 min sauve le lead (missed call rescue)." },
      { capabilityId: "quote_follow_up", why: "Un acheteur qui a consenti au rappel est relancé à J+2 — le suivi de lead conforme par conception (lead follow-up)." },
      { capabilityId: "opportunity_detection", why: "Prioriser les acheteurs chauds qui refroidissent avant qu'ils signent ailleurs." },
      { capabilityId: "consent_capture", why: "La relance sans consentement exprès est illégale (CRTC) — le coffre est la barrière." },
      { capabilityId: "human_handoff", why: "Négociation ou question juridique → le courtier, jamais l'IA." },
      { capabilityId: "roi_reporting", why: "Un seul mandat sauvé paie l'année — le chiffre doit être visible." },
    ],
    risks: [
      "Jamais d'avis juridique ni de promesse de prix — l'agent qualifie et route, il ne négocie pas.",
      "Le consentement de rappel doit être capté PENDANT l'appel entrant — sans lui, aucun suivi ne part (ADR-015).",
      "Les inscriptions vivent dans Centris/CRM : sans intégration, l'agent ne décrit que ce que le courtier a fourni.",
    ],
    requiredData: ["Numéro Twilio du courtier", "transferPhone (cellulaire du courtier)", "Liste des inscriptions actives (manuel ou CRM)", "Valeur moyenne d'une commission (barème)", "Plages de disponibilité"],
    roiMetrics: [
      CAD_BASELINE_METRIC("Valeur des leads protégés", "Leads sauvés × taux de conversion estimé × commission moyenne (barème courtier, hypothèse affichée)."),
      { id: "rescued_calls_count", label: "Appels sauvés", unit: "count", method: "Appels manqués ayant reçu un SMS de sauvetage.", basis: "measured" },
      { id: "follow_ups_sent_count", label: "Suivis J+2 livrés", unit: "count", method: "Relances envoyées avec consentement capté en appel.", basis: "measured" },
    ],
    firstDemo:
      "Simuler un appel manqué pendant une visite libre, montrer le SMS de sauvetage dans la file " +
      "(/follow-up), puis le suivi J+2 planifié UNIQUEMENT parce que le consentement a été capté.",
  },
];

/** Repli honnête : prompt inconnu → agent PME générique, jamais un crash ni une invention. */
const GENERIC_BLUEPRINT: VerticalBlueprint = {
  keywords: [],
  vertical: "generic",
  matchLabel: "PME générale (repli)",
  idSlug: "draft-receptionniste-pme",
  name: "Réceptionniste IA — PME",
  persona: "Réceptionniste polyvalente : répond, qualifie, prend le message, transfère quand il faut.",
  capabilities: [
    { capabilityId: "missed_call_rescue", why: "Le premier dollar récupéré de toute PME : l'appel manqué." },
    { capabilityId: "consent_capture", why: "Base légale de toute relance future." },
    { capabilityId: "human_handoff", why: "Le repli humain est non négociable, peu importe le métier." },
    { capabilityId: "roi_reporting", why: "Sans chiffre, pas de rétention client." },
  ],
  risks: [
    "Verticale non reconnue par le matcher déterministe — les capabilities proposées sont le socle générique, pas une recommandation métier.",
  ],
  requiredData: ["Numéro Twilio", "transferPhone", "Description du commerce", "Heures d'ouverture"],
  roiMetrics: [
    CAD_BASELINE_METRIC("Valeur protégée", "Appels sauvés × barème PME générale (ADR-010)."),
    { id: "rescued_calls_count", label: "Appels sauvés", unit: "count", method: "Appels manqués ayant reçu un SMS de sauvetage.", basis: "measured" },
  ],
  firstDemo: "Simuler un appel manqué dans /simulator et montrer le SMS de sauvetage et le ROI snapshot.",
};

const DRAFT_HONESTY =
  "Draft produit par un mapper déterministe (3 verticales + repli PME) — pas un LLM. " +
  "Rien n'est déployé : c'est une définition structurée à valider avec le client.";

/**
 * Transforme un prompt fondateur en AgentDefinition draft structurée.
 * Pur et total : tout prompt produit un draft validé (repli PME générique
 * si aucune verticale ne matche) — jamais d'exception, jamais d'invention.
 */
export function draftAgentDefinitionFromPrompt(prompt: string): AgentDraftResult {
  const normalized = normalize(prompt);
  const blueprint = BLUEPRINTS.find((b) => b.keywords.some((k) => normalized.includes(k))) ?? GENERIC_BLUEPRINT;

  const definition: AgentDefinition = validateAgentDefinition({
    id: blueprint.idSlug,
    name: blueprint.name,
    vertical: blueprint.vertical === "generic" ? "multi" : blueprint.vertical,
    persona: blueprint.persona,
    channels: ["voice", "sms"],
    capabilities: blueprint.capabilities.map((c) => c.capabilityId),
    contextNeeds: [
      { id: "caller_memory", description: "Historique d'appels de la personne chez ce tenant.", providedBy: "context_pack_provider", futureOwner: "memex" },
      { id: "industry_pack", description: "Contexte vertical : intentions, prudence, taxonomie.", providedBy: "industry_pack", futureOwner: "scaly" },
      { id: "consent_registry", description: "Coffre de consentements par personne (ADR-018).", providedBy: "local_store", futureOwner: "oria" },
      { id: "company_config", description: "Configuration tenant : heures, numéros, escalades.", providedBy: "local_store", futureOwner: "scaly" },
    ],
    actionTargets: [
      { id: "caller_sms", description: "SMS au client (sauvetage, offre, suivi consenti).", executedBy: "twilio_sms", tracedBy: ["recovery.offer_sent", "rescue.sms_sent"] },
      { id: "call_transfer", description: "Transfert vers l'humain.", executedBy: "twilio_voice", tracedBy: ["call.transferred"] },
    ],
    roiMetrics: blueprint.roiMetrics,
    safetyRules: [...DEFAULT_SAFETY_RULES],
    runtimeAdapters: ["twilio_voice_realtime", "twilio_voice_dial_fallback", "twilio_sms", "web_simulator"],
    backendBindings: REQUIRED_BACKEND_BINDINGS,
    status: "draft",
  });

  return {
    matchedVertical: blueprint.vertical,
    matchLabel: blueprint.matchLabel,
    definition,
    suggestedCapabilities: blueprint.capabilities,
    risks: blueprint.risks,
    requiredData: blueprint.requiredData,
    roiMetrics: blueprint.roiMetrics,
    firstDemo: blueprint.firstDemo,
    honesty: DRAFT_HONESTY,
  };
}

/** Les trois prompts de démonstration montrés dans /agent-os. */
export const DEMO_PROMPTS: string[] = [
  "Réceptionniste IA pour clinique dentaire",
  "Agent de service pour concessionnaire",
  "Assistant de relance pour courtier immobilier",
];
