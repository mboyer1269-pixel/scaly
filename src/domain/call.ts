/**
 * Domaine — Appel + Call Intelligence
 * Chaque appel produit une structure d'intelligence complète : résumé, intention,
 * urgence, valeur, action recommandée, scores. C'est l'unité de valeur centrale de Scaly.
 */
import type { LanguageCode } from "./company";

export type CallDirection = "inbound" | "outbound";
export type CallStatus = "completed" | "missed" | "transferred" | "voicemail" | "abandoned";
/** Provenance honnête de l'appel : aucun appel "live" n'existe encore (P2). */
export type CallSource = "simulator" | "seed_curated" | "live";

export interface TranscriptTurn {
  speaker: "agent" | "caller";
  text: string;
  atMs: number; // offset depuis le début de l'appel
  lang: LanguageCode;
}

export type Intent =
  | "urgence"
  | "prise_rdv"
  | "demande_soumission"
  | "question_info"
  | "plainte"
  | "suivi_dossier"
  | "annulation"
  | "fournisseur"
  | "spam"
  | "autre";

export const INTENT_LABELS: Record<Intent, string> = {
  urgence: "Urgence",
  prise_rdv: "Prise de rendez-vous",
  demande_soumission: "Demande de soumission",
  question_info: "Question / information",
  plainte: "Plainte",
  suivi_dossier: "Suivi de dossier",
  annulation: "Annulation",
  fournisseur: "Fournisseur",
  spam: "Spam / sollicitation",
  autre: "Autre",
};

export type Sentiment = "positif" | "neutre" | "negatif";
export type Urgency = "critique" | "haute" | "normale" | "basse";
export type LeadQuality = "chaud" | "tiede" | "froid" | "non_qualifie";

export type NextAction =
  | "rappeler_immediatement"
  | "confirmer_rdv"
  | "envoyer_soumission"
  | "transferer_humain"
  | "creer_suivi"
  | "aucune";

export const NEXT_ACTION_LABELS: Record<NextAction, string> = {
  rappeler_immediatement: "Rappeler immédiatement",
  confirmer_rdv: "Confirmer le rendez-vous",
  envoyer_soumission: "Envoyer une soumission",
  transferer_humain: "Transférer à un humain",
  creer_suivi: "Créer un suivi",
  aucune: "Aucune action requise",
};

export type FinalStatus = "resolu_par_ia" | "transfere" | "suivi_requis" | "perdu" | "ignore_spam";

export interface CallIntelligence {
  /** Moteur ayant produit l'analyse. "rules-v1" = heuristiques déterministes (démo honnête). */
  engine: "rules-v1" | "llm";
  summary: string;
  intent: Intent;
  intentConfidence: number; // 0..1
  sentiment: Sentiment;
  urgency: Urgency;
  leadQuality: LeadQuality;
  estimatedValueCad: number;
  valueBasis: "bareme_industrie" | "montant_mentionne" | "aucun";
  nextAction: NextAction;
  transferReason?: string;
  tags: string[];
  commercialScore: number; // 0..100
  confidence: number; // 0..1 — confiance globale de l'analyse
  finalStatus: FinalStatus;
  collectedFields: Record<string, string>;
  /** Présent si Scaly a "sauvé" cet appel (hors heures ou rappel d'appel manqué). */
  saved?: { reason: "hors_heures" | "rappel_sms" };
}

export interface Call {
  id: string;
  companyId: string;
  direction: CallDirection;
  status: CallStatus;
  source: CallSource;
  fromNumber: string;
  callerName?: string;
  language: LanguageCode;
  startedAt: string; // ISO
  durationSec: number;
  scriptId?: string;
  personaId?: string;
  seed?: number; // seed du simulateur (reproductibilité)
  transcript: TranscriptTurn[];
  intelligence?: CallIntelligence;
  provenance?: {
    provider?: string;
    externalId?: string;
    verifiedAt?: string;
  };
  /** HONNÊTETÉ : null tant que l'enregistrement réel (Twilio) n'est pas branché. */
  recordingUrl: null;
}
