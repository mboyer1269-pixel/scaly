/**
 * Domaine — Agent vocal
 * Configuration de la personnalité et des garde-fous d'un agent vocal d'entreprise.
 */
import type { LanguageCode } from "./company";

export interface VoiceProfile {
  /** "mock" = voix simulée (texte). Providers réels branchés en P2 (voir docs/VOICE.md). */
  provider: "mock" | "elevenlabs" | "openai_realtime";
  voiceId?: string;
}

export interface VoiceAgentConfig {
  id: string;
  companyId: string;
  displayName: string; // ex. "Sophie"
  persona: string; // description de la personnalité
  style: string; // ex. "phrases courtes, ton chaleureux, vouvoiement"
  languages: LanguageCode[];
  greetingScript: string;
  closingScript: string;
  qualificationScriptId: string; // script d'industrie utilisé
  allowedPhrases: string[];
  forbiddenPhrases: string[];
  safetyRules: string[];
  answerLimits: string[];
  transferPolicy: string;
  voiceProfile: VoiceProfile;
}

/** Garde-fous par défaut, appliqués à tout nouvel agent. Non négociables côté produit. */
export const DEFAULT_SAFETY_RULES: string[] = [
  "Ne jamais demander ni accepter un numéro de carte de crédit ou un NAS.",
  "Ne jamais donner de diagnostic médical, d'avis juridique ou de conseil financier.",
  "Ne jamais promettre un prix ferme — toujours parler d'estimation à confirmer.",
  "Ne jamais divulguer d'information sur un autre client.",
  "S'annoncer comme assistant virtuel si l'entreprise l'exige (conformité).",
  "Transférer à un humain dès que l'appelant le demande explicitement.",
];
