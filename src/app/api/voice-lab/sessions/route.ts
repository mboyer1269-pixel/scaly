/**
 * GET /api/voice-lab/sessions — historique des sessions persistées du Voice Lab.
 * Retourne des résumés (sans le verbatim des tours — il reste consultable via
 * le record complet, et il est purgeable Loi 25).
 */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { getSessionRole } from "@/server/auth";
import { requireTenant } from "@/server/tenant";
import { filterVoiceSessionsForTenant } from "@/services/voice-lab-security";

export const dynamic = "force-dynamic";

export async function GET() {
  const [tenant, role] = await Promise.all([requireTenant(), getSessionRole()]);
  if ("block" in tenant) return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  const records = filterVoiceSessionsForTenant(await getStore().listVoiceSessions(), tenant.companyId, role);
  return NextResponse.json({
    sessions: records.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      scenarioId: r.scenarioId,
      status: r.status,
      language: r.language,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      callId: r.callId,
      telemetry: r.telemetry,
      fieldsWithValue: r.fields.filter((f) => f.value).length,
      purged: r.turns.length === 0 && r.telemetry.turnCount > 0,
    })),
  });
}
