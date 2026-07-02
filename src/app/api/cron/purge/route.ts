/**
 * GET/POST /api/cron/purge — purge Loi 25 des transcripts expirés.
 * Protégé par CRON_SECRET (en-tête `Authorization: Bearer <secret>`), le format
 * envoyé automatiquement par Vercel Cron quand la variable CRON_SECRET existe.
 * 503 honnête si le secret n'est pas configuré — jamais de purge anonyme.
 */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { checkpointStaleMinutesFromEnv, expireStaleCheckpoints } from "@/services/checkpoint-expiry";
import { purgeExpiredWaitlistNotes } from "@/services/gap-recovery";

export const dynamic = "force-dynamic";

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET non configuré — purge refusée." }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const store = getStore();
  const result = await store.purgeExpiredTranscripts();
  // Brouillons in_progress orphelins (double panne pont + callback) → abandoned.
  const stale = await expireStaleCheckpoints(store, { staleMinutes: checkpointStaleMinutesFromEnv() });
  // Notes d'intention de la liste d'attente (extraits de conversation) — même
  // rétention que les transcripts, même loi (25).
  let waitlistNotesPurged = 0;
  for (const company of await store.listCompanies()) {
    waitlistNotesPurged += await purgeExpiredWaitlistNotes(company);
  }
  return NextResponse.json({ ok: true, ...result, staleCheckpoints: stale.expired, waitlistNotesPurged, at: new Date().toISOString() });
}

export const GET = handle;
export const POST = handle;
