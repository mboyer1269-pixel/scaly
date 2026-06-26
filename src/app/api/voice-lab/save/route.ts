/**
 * POST /api/voice-lab/save — la boucle de valeur complète.
 * Une session terminée du Voice Lab devient : (1) un VoiceSessionRecord
 * persistant (flight recorder consultable, purgeable Loi 25) et (2) un Call
 * de première classe analysé par le même IntelligenceEngine + ActionEngine
 * que tout le produit — visible immédiatement dans /calls.
 * Body : { session }
 */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { getSessionRole } from "@/server/auth";
import { resolveCompanyId } from "@/server/tenant";
import { getScriptById } from "@/data/industry-scripts";
import { voiceSessionToCall, voiceSessionToRecord } from "@/services/voice-convert";
import { canSaveVoiceLabSessionForTenant } from "@/services/voice-lab-security";
import type { VoiceSession } from "@/domain/voice";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let session: VoiceSession | undefined;
  try {
    session = ((await req.json()) as { session?: VoiceSession }).session;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  if (!session?.id || !Array.isArray(session.turns) || !Array.isArray(session.fields)) {
    return NextResponse.json({ error: "Session manquante ou malformée" }, { status: 400 });
  }
  if (!["completed", "failed"].includes(session.state)) {
    return NextResponse.json({ error: "Seule une session terminée (completed/failed) peut être sauvegardée" }, { status: 400 });
  }

  const store = getStore();
  const [currentCompanyId, role] = await Promise.all([resolveCompanyId(), getSessionRole()]);
  if (!canSaveVoiceLabSessionForTenant(session.companyId, currentCompanyId, role)) {
    return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  }

  const company = await store.getCompany(session.companyId);
  const script = getScriptById(session.scriptId);
  if (!company || !script) {
    return NextResponse.json({ error: "Compagnie ou script de la session introuvable" }, { status: 400 });
  }

  const existing = await store.getVoiceSession(session.id);
  if (existing) {
    return NextResponse.json({ error: "Session déjà sauvegardée", record: existing, callId: existing.callId }, { status: 409 });
  }

  const { call, actions } = voiceSessionToCall(session, company, script);
  await store.addCall(call, actions);
  const record = await store.saveVoiceSession(voiceSessionToRecord(session, call.id));

  return NextResponse.json({ record, callId: call.id, actionsPlanned: actions.length });
}
