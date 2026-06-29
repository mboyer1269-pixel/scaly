import type { ScalyRole } from "@/server/auth";
import type { VoiceSessionRecord } from "@/domain/voice";

export function canSaveVoiceLabSessionForTenant(
  sessionCompanyId: string,
  currentCompanyId: string,
  role: ScalyRole,
): boolean {
  return sessionCompanyId === currentCompanyId || role === "founder";
}

export function filterVoiceSessionsForTenant(
  records: VoiceSessionRecord[],
  currentCompanyId: string,
  role: ScalyRole,
): VoiceSessionRecord[] {
  if (role === "founder") return records;
  return records.filter((record) => record.companyId === currentCompanyId);
}
