import type { Intent, FinalStatus } from "./call";

/** Résumé compact d'un appel précédent tel qu'injecté dans le dossier client. */
export interface CallerCallSummary {
  date: string; // YYYY-MM-DD
  intent: Intent;
  /** intelligence.summary tronqué à 150 chars — jamais inventé. */
  summary?: string;
  finalStatus: FinalStatus;
  hasPendingFollowUp: boolean;
}

/**
 * Dossier synthétisé d'un appelant connu.
 * Construit par buildCallerMemory() à partir de l'historique réel des Call du
 * même numéro canonisé. Chaque champ est ABSENT si non confirmé dans au moins
 * un appel — jamais inventé, jamais imputé.
 */
export interface CallerMemory {
  callCount: number;
  firstCallAt: string; // YYYY-MM-DD
  lastCallAt: string; // YYYY-MM-DD

  /** callerName ou collectedFields.nom du premier appel qui l'a, le plus récent d'abord. */
  name?: string;
  /** collectedFields.adresse du premier appel qui l'a, le plus récent d'abord. */
  address?: string;
  /** Toujours true si CallerMemory existe : ce numéro a déjà composé. */
  phoneConfirmed: true;

  /** Max 5 appels, du plus récent au plus ancien. */
  recentCalls: CallerCallSummary[];

  /**
   * Union de tous les champs collectés ; le plus récent écrase l'ancien en cas de conflit.
   * Clés = FieldKey du script de l'industrie — passées telles quelles, zéro hardcode.
   */
  confirmedFields: Record<string, string>;

  /** true si au moins un des recentCalls a finalStatus === "suivi_requis". */
  hasPendingFollowUp: boolean;
}
