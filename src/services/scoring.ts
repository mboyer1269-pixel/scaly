/**
 * Service — Scoring commercial
 * Fonctions pures et testables : pondérations d'urgence, de qualité de lead,
 * estimation de valeur et score commercial 0-100.
 */
import type { LeadQuality, Sentiment, Urgency } from "@/domain/call";

export function urgencyWeight(u: Urgency): number {
  switch (u) {
    case "critique": return 1;
    case "haute": return 0.7;
    case "normale": return 0.4;
    case "basse": return 0.15;
  }
}

export function leadWeight(q: LeadQuality): number {
  switch (q) {
    case "chaud": return 1;
    case "tiede": return 0.6;
    case "froid": return 0.25;
    case "non_qualifie": return 0;
  }
}

export function sentimentWeight(s: Sentiment): number {
  switch (s) {
    case "positif": return 1;
    case "neutre": return 0.7;
    case "negatif": return 0.3;
  }
}

export type ValueTier = "haut" | "moyen" | "bas" | "nul";

const TIER_MULTIPLIER: Record<ValueTier, number> = { haut: 1.6, moyen: 1, bas: 0.4, nul: 0 };

/** Estime la valeur d'un appel à partir du barème d'industrie et du palier détecté. */
export function estimateValueCad(tier: ValueTier, baselineCad: number): number {
  return Math.round(baselineCad * TIER_MULTIPLIER[tier]);
}

/**
 * Cherche un montant mentionné explicitement dans un texte.
 * Gère "5 000 $", "3500 dollars" (FR) et "$3,500" (EN).
 */
export function extractMentionedAmountCad(text: string): number | null {
  const match = text.match(/\$\s*(\d[\d,\s  ]*)|(\d[\d,\s  ]*)\s*(?:\$|dollars)/i);
  const raw = (match?.[1] ?? match?.[2])?.replace(/[\s,  ]/g, "");
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 100 && n <= 10_000_000 ? n : null;
}

export interface CommercialScoreInput {
  urgency: Urgency;
  leadQuality: LeadQuality;
  sentiment: Sentiment;
  fieldsCollected: number;
  fieldsRequired: number;
  estimatedValueCad: number;
  valueBaselineCad: number;
}

/**
 * Score commercial 0-100.
 * Pondérations : qualité du lead 30 %, urgence 25 %, complétude des infos 20 %,
 * valeur normalisée 15 %, sentiment 10 %.
 */
export function computeCommercialScore(input: CommercialScoreInput): number {
  const completeness = input.fieldsRequired === 0 ? 1 : Math.min(1, input.fieldsCollected / input.fieldsRequired);
  const valueNorm = input.valueBaselineCad > 0
    ? Math.min(1.5, input.estimatedValueCad / input.valueBaselineCad) / 1.5
    : 0;
  const score =
    100 *
    (0.3 * leadWeight(input.leadQuality) +
      0.25 * urgencyWeight(input.urgency) +
      0.2 * completeness +
      0.15 * valueNorm +
      0.1 * sentimentWeight(input.sentiment));
  return Math.max(0, Math.min(100, Math.round(score)));
}
