/**
 * Domaine — Voice Runtime (P2A)
 * Le cerveau conversationnel tour par tour de Scaly, AVANT le transport audio.
 * Contrat conçu pour le temps réel : chaque structure ici doit pouvoir être
 * alimentée par Twilio/OpenAI Realtime (P2B) sans changement de forme —
 * latences réelles à la place des simulées, transcripts STT à la place des
 * scénarios. Le transport est un détail ; le cerveau est ici.
 */
import type { LanguageCode } from "./company";
import type { Intent, Urgency } from "./call";

// ---------------------------------------------------------------------------
// Machine à états conversationnelle
// ---------------------------------------------------------------------------

export type VoiceRuntimeState =
  | "greeting"
  | "language_detection"
  | "intent_discovery"
  | "caller_identification"
  | "field_collection"
  | "clarification"
  | "urgency_assessment"
  | "escalation_needed"
  | "closing"
  | "completed"
  | "failed"
  | "interrupted";

export const VOICE_STATE_LABELS: Record<VoiceRuntimeState, string> = {
  greeting: "Accueil",
  language_detection: "Détection de langue",
  intent_discovery: "Découverte de l'intention",
  caller_identification: "Identification de l'appelant",
  field_collection: "Collecte des informations",
  clarification: "Clarification",
  urgency_assessment: "Évaluation de l'urgence",
  escalation_needed: "Escalade requise",
  closing: "Conclusion",
  completed: "Complétée",
  failed: "Échouée",
  interrupted: "Interrompue",
};

// ---------------------------------------------------------------------------
// Champs à extraction progressive
// ---------------------------------------------------------------------------

export type VoiceFieldStatus = "missing" | "inferred" | "confirmed" | "conflicted";

export type VoiceFieldKey =
  | "callerName"
  | "phone"
  | "email"
  | "address"
  | "requestedService"
  | "preferredTime"
  | "urgencyLevel"
  | "primaryIntent"
  | "summary"
  | "escalationReason";

export interface VoiceFieldState {
  key: VoiceFieldKey;
  label: string;
  value?: string;
  status: VoiceFieldStatus;
  confidence: number; // 0..1
  sourceTurnId?: string;
  /** Extrait verbatim qui justifie la valeur (traçabilité). */
  evidence?: string;
  /** Valeur concurrente détectée quand status === "conflicted". */
  conflictingValue?: string;
}

export const VOICE_FIELD_LABELS: Record<VoiceFieldKey, string> = {
  callerName: "Nom de l'appelant",
  phone: "Téléphone",
  email: "Courriel",
  address: "Adresse",
  requestedService: "Service demandé",
  preferredTime: "Moment souhaité",
  urgencyLevel: "Niveau d'urgence",
  primaryIntent: "Intention principale",
  summary: "Résumé",
  escalationReason: "Raison d'escalade",
};

/** Champs demandés à l'appelant (les 4 derniers sont dérivés par le runtime). */
export const ASKABLE_FIELDS: VoiceFieldKey[] = ["callerName", "phone", "email", "address", "requestedService", "preferredTime"];
export const DERIVED_FIELDS: VoiceFieldKey[] = ["urgencyLevel", "primaryIntent", "summary", "escalationReason"];

// ---------------------------------------------------------------------------
// Tours, décisions, événements
// ---------------------------------------------------------------------------

export interface VoiceTurn {
  id: string;
  speaker: "agent" | "caller";
  text: string;
  lang: LanguageCode;
  atMs: number; // horloge de session
  /** Vrai si ce tour AGENT a été coupé par l'appelant (barge-in). */
  interrupted?: boolean;
  /** Latences de la chaîne pour ce tour (simulées en P2A, réelles en P2B). */
  latency?: VoiceTurnLatency;
}

export interface VoiceTurnLatency {
  sttMs: number;
  brainMs: number;
  ttsMs: number;
  /** Latence perçue par l'appelant = stt + brain + tts. */
  perceivedMs: number;
  simulated: boolean;
}

export type VoiceDecisionAction =
  | "ask_field"
  | "confirm_field"
  | "clarify_conflict"
  | "answer_objection"
  | "assess_urgency"
  | "escalate_transfer"
  | "refuse_spam"
  | "recap_and_close"
  | "complete"
  | "fail";

export interface VoiceRuntimeDecision {
  action: VoiceDecisionAction;
  targetField?: VoiceFieldKey;
  /** Raison lisible de la décision (affichée dans le flight recorder). */
  reason: string;
  confidence: number; // 0..1
  stateBefore: VoiceRuntimeState;
  stateAfter: VoiceRuntimeState;
}

export type VoiceRuntimeEvent =
  | { type: "session_started"; at: number; scenarioId?: string }
  | { type: "state_transition"; at: number; from: VoiceRuntimeState; to: VoiceRuntimeState; reason: string }
  | { type: "language_detected"; at: number; turnId: string; lang: LanguageCode }
  | { type: "language_switch"; at: number; turnId: string; from: LanguageCode; to: LanguageCode }
  | { type: "field_update"; at: number; key: VoiceFieldKey; status: VoiceFieldStatus; value?: string; confidence: number; turnId: string }
  | { type: "field_conflict"; at: number; key: VoiceFieldKey; previous: string; incoming: string; turnId: string }
  | { type: "decision"; at: number; decision: VoiceRuntimeDecision }
  | { type: "urgency_detected"; at: number; level: Urgency; matched: string }
  | { type: "interruption"; at: number; interruptedTurnId: string; callerTurnId: string }
  | { type: "transfer_requested"; at: number; to: string; reason: string }
  | { type: "session_ended"; at: number; status: VoiceRuntimeState; reason: string };

// ---------------------------------------------------------------------------
// Télémétrie
// ---------------------------------------------------------------------------

export interface VoiceRuntimeTelemetry {
  totalDurationMs: number;
  turnCount: number;
  callerTurnCount: number;
  agentTurnCount: number;
  /** Latences perçues par tour agent (stt+brain+tts). */
  perceivedLatenciesMs: number[];
  perceivedP50Ms: number;
  perceivedP95Ms: number;
  /** Cibles roadmap P2 : p50 < 800 ms, p95 < 1200 ms. */
  latencyBudgetMet: boolean;
  sttTotalMs: number;
  brainTotalMs: number;
  ttsTotalMs: number;
  fieldsConfirmed: number;
  fieldsInferred: number;
  fieldsMissing: number;
  fieldsConflicted: number;
  avgFieldConfidence: number;
  languageSwitches: number;
  interruptions: number;
  transferRequested: boolean;
  finalStatus: VoiceRuntimeState;
  failureReason?: string;
  latenciesSimulated: boolean;
}

export const LATENCY_TARGET_P50_MS = 800;
export const LATENCY_TARGET_P95_MS = 1200;

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export interface VoiceSession {
  id: string;
  companyId: string;
  scriptId: string;
  scenarioId?: string;
  seed: number;
  state: VoiceRuntimeState;
  /** Langue dominante de l'appelant (majorité des tours). */
  dominantLanguage: LanguageCode;
  /** Langue du dernier tour appelant — l'agent répond dans cette langue. */
  activeLanguage: LanguageCode;
  turns: VoiceTurn[];
  fields: VoiceFieldState[];
  events: VoiceRuntimeEvent[];
  /** Dernière décision prise (la « prochaine question » de l'UI en découle). */
  lastDecision?: VoiceRuntimeDecision;
  /** Champ en attente de confirmation/clarification, le cas échéant. */
  pendingField?: VoiceFieldKey;
  detectedUrgency: Urgency;
  detectedIntent: Intent;
  transfer?: { to: string; reason: string };
  startedAtIso: string;
  endedAtIso?: string;
  clockMs: number;
  /** Tours appelant vides/incompréhensibles consécutifs (2 → failed). */
  unintelligibleStreak: number;
  telemetry: VoiceRuntimeTelemetry;
}

// ---------------------------------------------------------------------------
// Scénarios (banc d'essai déterministe du runtime)
// ---------------------------------------------------------------------------

export interface VoiceScenarioTurn {
  text: string;
  /** Force la langue du tour (sinon détection automatique). */
  lang?: LanguageCode;
  /** Barge-in : l'appelant coupe la réponse agent en cours. */
  interrupt?: boolean;
}

export interface VoiceScenarioExpectation {
  finalStatus: VoiceRuntimeState;
  transferRequested: boolean;
  minFieldsConfirmed: number;
  maxFieldsMissing: number;
  minLanguageSwitches?: number;
  minInterruptions?: number;
  dominantLanguage: LanguageCode;
}

export interface VoiceScenario {
  id: string;
  title: string;
  description: string;
  /** Ce que ce scénario prouve (affiché dans l'UI). */
  proves: string;
  companyId: string;
  scriptId: string;
  seed: number;
  callerTurns: VoiceScenarioTurn[];
  /** Attentes verrouillées en CI (golden conversations). */
  expected: VoiceScenarioExpectation;
}

// ---------------------------------------------------------------------------
// Enregistrement persistable (flight recorder consultable)
// ---------------------------------------------------------------------------

/**
 * Rétention Loi 25 : `turns` et `events` contiennent du verbatim → PURGEABLES
 * après `retentionDays` (mêmes règles que Call.transcript). `telemetry` et
 * `fields` sont des données structurées agrégées → CONSERVABLES.
 */
export interface VoiceSessionRecord {
  id: string;
  companyId: string;
  scenarioId?: string;
  status: VoiceRuntimeState;
  language: LanguageCode;
  startedAt: string;
  endedAt?: string;
  turns: VoiceTurn[];
  events: VoiceRuntimeEvent[];
  fields: VoiceFieldState[];
  telemetry: VoiceRuntimeTelemetry;
  /** Call créé lors de la sauvegarde (boucle complète vers /calls). */
  callId?: string;
}
