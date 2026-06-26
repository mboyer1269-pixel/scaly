import type { ScalyRole } from "@/server/auth";

export function canSaveVoiceLabSessionForTenant(
  sessionCompanyId: string,
  currentCompanyId: string,
  role: ScalyRole,
): boolean {
  return sessionCompanyId === currentCompanyId || role === "founder";
}
