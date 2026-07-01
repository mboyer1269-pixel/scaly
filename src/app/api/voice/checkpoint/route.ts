/**
 * POST /api/voice/checkpoint — flush périodique du transcript PENDANT l'appel
 * (appelé par scaly-realtime et scaly-relay à chaque tour stable).
 * Si le pont crash avant /api/voice/complete, le backend garde un brouillon
 * de Call (statut "in_progress", provenance.checkpointAt) avec les vrais
 * tours — le repli humain l'upgrade en appel transféré analysé, et le final
 * le remplace en place. La mémoire ne disparaît JAMAIS avec le WebSocket.
 *
 * Le pont envoie ses tours CUMULÉS : chaque flush écrase le précédent
 * (last-write-wins) — un retry du même batch est idempotent par construction.
 * Aucune analyse ni action ici : le brouillon est invisible des moteurs métier.
 * Protégé par REALTIME_SHARED_SECRET si défini (obligatoire en production).
 */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { callIdFromTwilio, isCheckpointDraft } from "@/server/voice-fallback";
import type { Call, TranscriptTurn } from "@/domain/call";
import type { LanguageCode } from "@/domain/company";

export const dynamic = "force-dynamic";

interface CheckpointBody {
  callSid?: string;
  from?: string;
  companyId?: string;
  startedAt?: string;
  turns?: { speaker: "agent" | "caller"; text: string; atMs: number; lang?: string }[];
}

export async function POST(req: Request) {
  const secret = process.env.REALTIME_SHARED_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "REALTIME_SHARED_SECRET requis en production" }, { status: 503 });
  }
  if (secret && req.headers.get("x-scaly-secret") !== secret) {
    return NextResponse.json({ error: "Secret partagé invalide" }, { status: 401 });
  }

  let body: CheckpointBody;
  try {
    body = (await req.json()) as CheckpointBody;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  if (!body.companyId || !body.callSid || !Array.isArray(body.turns) || body.turns.length === 0) {
    return NextResponse.json({ error: "companyId, callSid et turns requis" }, { status: 400 });
  }

  const store = getStore();
  const company = await store.getCompany(body.companyId);
  if (!company) {
    return NextResponse.json({ error: `Entreprise inconnue ${body.companyId}` }, { status: 404 });
  }

  const existing = await store.findCallByExternalId(company.id, body.callSid);
  if (existing && !isCheckpointDraft(existing)) {
    // L'appel est déjà finalisé (complete ou repli) — un flush tardif d'un
    // pont zombie ne doit JAMAIS écraser le record final.
    return NextResponse.json({ callId: existing.id, ignored: true });
  }

  const turns = body.turns;
  const langOf = (l?: string): LanguageCode => (l === "en" ? "en" : company.defaultLanguage);
  const transcript: TranscriptTurn[] = turns.map((t) => ({
    speaker: t.speaker,
    text: t.text,
    atMs: t.atMs,
    lang: langOf(t.lang),
  }));
  const now = new Date().toISOString();
  const call: Call = {
    id: existing?.id ?? callIdFromTwilio(body.callSid),
    companyId: company.id,
    direction: "inbound",
    status: "in_progress",
    source: "live",
    fromNumber: body.from ?? "inconnu",
    language: company.defaultLanguage,
    startedAt: existing?.startedAt ?? body.startedAt ?? now,
    durationSec: Math.max(1, Math.round(turns[turns.length - 1].atMs / 1000)),
    transcript,
    recordingUrl: null,
    provenance: { provider: "twilio", externalId: body.callSid, checkpointAt: now },
  };
  // Write conditionnel : ferme la course read-then-write — si une finalisation
  // (/complete, repli, balayeur) atterrit entre le findCallByExternalId ci-dessus
  // et ce write, le flush s'efface au lieu d'écraser le record final.
  const written = await store.saveCallUnlessFinalized(call);
  if (!written) {
    return NextResponse.json({ callId: call.id, ignored: true });
  }

  // Audit une seule fois par appel (au premier flush) — pas de spam à chaque tour.
  if (!existing) {
    await store.recordAudit({
      companyId: company.id,
      actor: "scaly-realtime",
      event: "transcript_checkpoint_ouvert",
      detail: `${call.id} · Twilio ${body.callSid} · brouillon vivant, ${turns.length} tour(s)`,
    });
  }

  return NextResponse.json({ callId: call.id, turns: transcript.length, checkpoint: true });
}
