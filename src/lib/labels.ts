/** Helpers UI — libellés et tonalités de badges (cohérents partout). */
import type { ActionStatus, CallStatus, LeadQuality, Sentiment, Urgency } from "@/domain";

export type Tone = "slate" | "teal" | "amber" | "rose" | "emerald" | "violet" | "sky";

export function urgencyBadge(u?: Urgency): { label: string; tone: Tone } {
  switch (u) {
    case "critique": return { label: "Critique", tone: "rose" };
    case "haute": return { label: "Haute", tone: "amber" };
    case "normale": return { label: "Normale", tone: "sky" };
    case "basse": return { label: "Basse", tone: "slate" };
    default: return { label: "—", tone: "slate" };
  }
}

export function leadBadge(l?: LeadQuality): { label: string; tone: Tone } {
  switch (l) {
    case "chaud": return { label: "Chaud", tone: "emerald" };
    case "tiede": return { label: "Tiède", tone: "amber" };
    case "froid": return { label: "Froid", tone: "sky" };
    case "non_qualifie": return { label: "Non qualifié", tone: "slate" };
    default: return { label: "—", tone: "slate" };
  }
}

export function callStatusBadge(s: CallStatus): { label: string; tone: Tone } {
  switch (s) {
    case "completed": return { label: "Complété", tone: "emerald" };
    case "missed": return { label: "Manqué", tone: "rose" };
    case "transferred": return { label: "Transféré", tone: "violet" };
    case "voicemail": return { label: "Boîte vocale", tone: "slate" };
    case "abandoned": return { label: "Abandonné", tone: "amber" };
    case "in_progress": return { label: "En cours", tone: "sky" };
  }
}

export function actionStatusBadge(s: ActionStatus): { label: string; tone: Tone } {
  switch (s) {
    case "pending": return { label: "En attente", tone: "amber" };
    case "executing": return { label: "En cours", tone: "sky" };
    case "succeeded": return { label: "Réussie (mock)", tone: "emerald" };
    case "failed": return { label: "Échouée", tone: "rose" };
    case "requires_config": return { label: "Config. requise", tone: "violet" };
    case "cancelled": return { label: "Annulée", tone: "slate" };
  }
}

export function sentimentLabel(s?: Sentiment): string {
  switch (s) {
    case "positif": return "Positif";
    case "negatif": return "Négatif";
    case "neutre": return "Neutre";
    default: return "—";
  }
}
