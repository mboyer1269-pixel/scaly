/**
 * GET/POST /api/cron/purge — purge Loi 25 des transcripts expirés.
 * Protégé par CRON_SECRET (en-tête `Authorization: Bearer <secret>`), le format
 * envoyé automatiquement par Vercel Cron quand la variable CRON_SECRET existe.
 * 503 honnête si le secret n'est pas configuré — jamais de purge anonyme.
 */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";

export const dynamic = "force-dynamic";

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET non configuré — purge refusée." }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const result = await getStore().purgeExpiredTranscripts();
  return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
}

export const GET = handle;
export const POST = handle;
