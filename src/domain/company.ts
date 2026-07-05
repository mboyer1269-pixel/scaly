/**
 * Domaine — Entreprise (tenant)
 * Chaque PME cliente est un tenant isolé : configuration, heures, règles d'escalade, conformité.
 */
import type { PlanId } from "./billing";

export type LanguageCode = "fr" | "en";

export type Industry =
  | "construction_renovation"
  | "garage_auto"
  | "concessionnaire_auto"
  | "clinique_privee"
  | "dentiste"
  | "salon_beaute"
  | "veterinaire"
  | "courtier_immobilier"
  | "courtier_hypothecaire"
  | "services_professionnels"
  | "services_domicile"
  | "restaurant"
  | "maintenance"
  | "nettoyage"
  | "consultant"
  | "agence";

export const INDUSTRY_LABELS: Record<Industry, string> = {
  construction_renovation: "Construction / Rénovation",
  garage_auto: "Garage automobile",
  concessionnaire_auto: "Concessionnaire automobile",
  clinique_privee: "Clinique privée",
  dentiste: "Clinique dentaire",
  salon_beaute: "Salon de beauté",
  veterinaire: "Clinique vétérinaire",
  courtier_immobilier: "Courtier immobilier",
  courtier_hypothecaire: "Courtier hypothécaire",
  services_professionnels: "Services professionnels",
  services_domicile: "Services à domicile",
  restaurant: "Restaurant",
  maintenance: "Entreprise de maintenance",
  nettoyage: "Compagnie de nettoyage",
  consultant: "Consultant",
  agence: "Agence",
};

/** Heures d'ouverture simples (extension multi-plages prévue en P1). days: 0=dimanche … 6=samedi */
export interface BusinessHours {
  open: string; // "08:00"
  close: string; // "17:00"
  days: number[];
}

export interface EscalationRule {
  id: string;
  description: string;
  trigger: { type: "urgency" | "intent" | "keyword" | "caller_request"; value: string };
  action: "transfer_human" | "notify_owner" | "create_urgent_task";
  target?: string; // numéro ou courriel cible
}

export interface CompliancePolicy {
  aiDisclosure: boolean; // l'agent annonce qu'il est un assistant IA
  recordingEnabled: boolean;
  recordingDisclosure: boolean; // mention d'enregistrement en début d'appel
  retentionDays: number; // suppression des transcriptions après N jours
  piiMinimization: boolean; // collecter le minimum d'infos personnelles
}

export interface FollowUpPreferences {
  smsConfirmation: boolean;
  emailSummary: boolean;
  missedCallAutoSms: boolean; // rappel automatique des appels manqués
  dailyDigestHour: number; // heure locale d'envoi du résumé quotidien
}

export type CoverageMode = "after_hours" | "overflow" | "primary";

export interface CoveragePolicy {
  modes: CoverageMode[];
  overflowDelaySec: number;
}

/** État d'abonnement Stripe — écrit UNIQUEMENT par le webhook Stripe, jamais par l'UI. */
export interface CompanyBilling {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: string; // active | past_due | canceled | …
  currentPeriodEnd?: string; // ISO
}

export interface Company {
  id: string;
  name: string;
  /** Description approuvée du commerce, utilisée comme contexte par Maude. */
  businessDescription?: string;
  /** Lien d'avis approuvé (Google, etc.). Source UNIQUE des demandes d'avis — jamais inventé. */
  reviewUrl?: string;
  industry: Industry;
  sectorLabel: string;
  ownerName: string;
  ownerEmail: string;
  mainPhone: string;
  /** Numéro Twilio entrant assigné à ce tenant. Sert au routage voix/SMS multi-tenant. */
  twilioPhoneNumber?: string;
  transferPhone: string;
  city: string;
  languages: LanguageCode[];
  defaultLanguage: LanguageCode;
  tone: "professionnel" | "chaleureux" | "energique" | "calme";
  hours: BusinessHours;
  escalationRules: EscalationRule[];
  essentialQuestions: string[];
  services: string[];
  serviceAreas: string[];
  policies: string[];
  followUp: FollowUpPreferences;
  /** Politique de prise d'appels. Optionnelle pendant la migration des tenants existants. */
  coverage?: CoveragePolicy;
  compliance: CompliancePolicy;
  planId: PlanId;
  billing?: CompanyBilling;
  createdAt: string;
}

/** Vrai si l'instant donné est en dehors des heures d'ouverture de l'entreprise. */
export function isOutsideBusinessHours(company: Company, at: Date): boolean {
  const day = at.getDay();
  if (!company.hours.days.includes(day)) return true;
  const [oh, om] = company.hours.open.split(":").map(Number);
  const [ch, cm] = company.hours.close.split(":").map(Number);
  const minutes = at.getHours() * 60 + at.getMinutes();
  return minutes < oh * 60 + om || minutes >= ch * 60 + cm;
}
