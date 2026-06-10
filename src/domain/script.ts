/**
 * Domaine — Scripts par industrie
 * Un script définit le comportement de qualification d'un agent vocal pour une industrie :
 * intention principale, informations à collecter, critères d'urgence/transfert, objections,
 * action finale, résumé attendu et tags CRM.
 */
import type { Industry, LanguageCode } from "./company";
import type { Intent, NextAction, Urgency } from "./call";

export type FieldKey =
  | "nom"
  | "telephone"
  | "adresse"
  | "courriel"
  | "description"
  | "moment"
  | "budget"
  | "vehicule"
  | "animal"
  | "propriete";

export const FIELD_LABELS: Record<FieldKey, string> = {
  nom: "Nom",
  telephone: "Téléphone",
  adresse: "Adresse",
  courriel: "Courriel",
  description: "Description du besoin",
  moment: "Moment souhaité",
  budget: "Budget",
  vehicule: "Véhicule",
  animal: "Animal",
  propriete: "Propriété",
};

export interface QualificationQuestion {
  fieldKey: FieldKey;
  question: string; // FR
  questionEn?: string; // variante EN (greeting/questions clés seulement — scripts EN complets en P1)
  required: boolean;
}

export interface UrgencyCriterion {
  keywords: string[];
  level: Urgency;
  note: string;
}

export interface TransferCriterion {
  condition: string;
  keywords?: string[];
}

export interface Objection {
  objection: string;
  response: string;
}

export interface IndustryScript {
  id: string;
  industry: Industry;
  name: string;
  language: LanguageCode;
  primaryIntent: Intent;
  greeting: string; // {company} et {agent} interpolés
  greetingEn: string;
  questions: QualificationQuestion[];
  urgencyCriteria: UrgencyCriterion[];
  transferCriteria: TransferCriterion[];
  commonObjections: Objection[];
  finalAction: NextAction;
  expectedSummary: string; // gabarit du résumé attendu
  crmTags: string[];
  forbiddenPhrases: string[];
  /** Hypothèse interne de valeur moyenne d'un mandat (CAD) — à recalibrer par client. */
  valueBaselineCad: number;
  /** Besoins typiques exprimés par les appelants (utilisés par le simulateur). */
  sampleNeeds: string[];
  /** Besoins urgents typiques (déclenchent les critères d'urgence du script). */
  urgentNeeds: string[];
}
