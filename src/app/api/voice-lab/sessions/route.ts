/**
 * GET /api/voice-lab/sessions — historique des sessions persistées du Voice Lab.
 * Retourne des résumés (sans le verbatim des tours — il reste consultable via
 * le record complet, et il est purgeable Loi 25).
 */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const records = await getStore().listVoiceSessions();
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
