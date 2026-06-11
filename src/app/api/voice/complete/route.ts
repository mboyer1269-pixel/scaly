/**
 * POST /api/voice/complete — fin d'appel réel (appelé par scaly-realtime).
 * Le transcript du VRAI appel devient un Call source:"live" analysé par le
 * MÊME IntelligenceEngine + ActionEngine que le simulateur et le Voice Lab.
 * Protégé par REALTIME_SHARED_SECRET si défini.
 */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { getScriptById } from "@/data/industry-scripts";
import { intelligenceEngine } from "@/services/intelligence";
import { planActionsForCall } from "@/services/action-engine";
import { newId } from "@/lib/format";
import type { Call, TranscriptTurn } from "@/domain/call";
import type { LanguageCode } from "@/domain/company";
import type { VoiceTurnLatency } from "@/domain/voice";

export const dynamic = "force-dynamic";

interface CompleteBody {
  callSid?: string;
  from?: string;
  companyId?: string;
  startedAt?: string;
  turns?: { speaker: "agent" | "caller"; text: string; atMs: number; lang?: string; latency?: VoiceTurnLatency }[];
  transferred?: boolean;
  transferReason?: string;
}

export async function POST(req: Request) {
  const secret = process.env.REALTIME_SHARED_SECRET;
  if (secret && req.headers.get("x-scaly-secret") !== secret) {
    return NextResponse.json({ error: "Secret partagé invalide" }, { status: 401 });
  }

  let body: CompleteBody;
  try {
    body = (await req.json()) as CompleteBody;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  if (!body.companyId || !Array.isArray(body.turns) || body.turns.length === 0) {
    return NextResponse.json({ error: "companyId et turns requis" }, { status: 400 });
  }

  const store = getStore();
  const company = await store.getCompany(body.companyId);
  const agent = company ? await store.getAgentByCompany(company.id) : undefined;
  const script = agent ? getScriptById(agent.qualificationScriptId) : undefined;
  if (!company || !agent || !script) {
    return NextResponse.json({ error: `Contexte incomplet pour ${body.companyId}` }, { status: 404 });
  }

  const turns = body.turns;
  const langOf = (l?: string): LanguageCode => (l === "en" ? "en" : company.defaultLanguage);
  const transcript: TranscriptTurn[] = turns.map((t) => ({
    speaker: t.speaker,
    text: t.text,
    atMs: t.atMs,
    lang: langOf(t.lang),
  }));
  const lastMs = turns[turns.length - 1].atMs;
  const measured = turns.map((t) => t.latency).filter((l): l is VoiceTurnLatency => Boolean(l && !l.simulated));

  const call: Call = {
    id: newId("call"),
    companyId: company.id,
    direction: "inbound",
    status: body.transferred ? "transferred" : "completed",
    source: "live",
    fromNumber: body.from ?? "inconnu",
    language: company.defaultLanguage,
    startedAt: body.startedAt ?? new Date().toISOString(),
    durationSec: Math.max(1, Math.round(lastMs / 1000)),
    scriptId: script.id,
    transcript,
    recordingUrl: null,
  };
  call.intelligence = intelligenceEngine.analyze(call, script, {
    transferred: Boolean(body.transferred),
    transferReason: body.transferReason,
  });

  const actions = planActionsForCall(call, company);
  await store.addCall(call, actions);
  await store.recordAudit({
    companyId: company.id,
    actor: "scaly-realtime",
    event: "appel_live_persisté",
    detail: `${call.id} (Twilio ${body.callSid ?? "?"}) · ${turns.length} tours · ${measured.length} latence(s) réelle(s)${measured.length ? ` · p. ex. ${measured[0].perceivedMs} ms` : ""}`,
  });

  return NextResponse.json({ callId: call.id, actionsPlanned: actions.length, measuredLatencies: measured.length });
}
