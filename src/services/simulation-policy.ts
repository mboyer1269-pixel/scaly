import type { VoiceAgentConfig } from "@/domain/agent";
import type { Company } from "@/domain/company";
import type { IndustryScript } from "@/domain/script";
import { getScriptById } from "@/data/industry-scripts";

/**
 * The integrated simulator proves the configured tenant, not an unrelated
 * industry. Cross-industry exploration belongs in an internal lab.
 */
export function resolveCompanySimulationScript(
  company: Company,
  agent: VoiceAgentConfig,
  requestedScriptId?: string,
): IndustryScript {
  if (agent.companyId !== company.id) {
    throw new Error("La configuration de Maude n'appartient pas à cette entreprise.");
  }
  if (requestedScriptId && requestedScriptId !== agent.qualificationScriptId) {
    throw new Error("Ce script n'est pas configuré pour cette entreprise.");
  }
  const script = getScriptById(agent.qualificationScriptId);
  if (!script || script.industry !== company.industry) {
    throw new Error("Le script configuré pour cette entreprise est invalide.");
  }
  return script;
}
