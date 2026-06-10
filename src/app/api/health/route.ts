/** GET /api/health — état honnête du système (providers, store, version). */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { getVoiceStackHealth } from "@/adapters/voice/health";
import { DEFAULT_COMPANY_ID } from "@/data/companies";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = getStore();
  return NextResponse.json({
    status: "ok",
    mode: "demo-mock",
    persistence: "in-memory (régénéré à chaque redémarrage — Prisma/Postgres prévu en P1)",
    providers: getVoiceStackHealth(),
    counts: {
      companies: store.listCompanies().length,
      calls: store.listCalls().length,
      actions: store.listActions().length,
    },
    defaultCompanyId: DEFAULT_COMPANY_ID,
  });
}
