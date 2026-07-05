import type { ModelTokenUsage } from "@/domain/model-usage";

/**
 * Estimation interne prudente pour les appels texte. Les couts provider reels
 * doivent remplacer ces valeurs via ModelUsage/LiteLLM quand disponibles.
 */
export const EST_TEXT_INPUT_COST_PER_1K_TOKENS_CAD = 0.0002;
export const EST_TEXT_OUTPUT_COST_PER_1K_TOKENS_CAD = 0.0008;

function money(value: number): number {
  return Math.round(value * 100_000) / 100_000;
}

export function estimateTextModelCostCad(tokens: ModelTokenUsage): number {
  const input = tokens.inputTokens ?? 0;
  const output = tokens.outputTokens ?? Math.max(0, (tokens.totalTokens ?? 0) - input);
  return money((input / 1000) * EST_TEXT_INPUT_COST_PER_1K_TOKENS_CAD + (output / 1000) * EST_TEXT_OUTPUT_COST_PER_1K_TOKENS_CAD);
}
