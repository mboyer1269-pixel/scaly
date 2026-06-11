/** GET /api/health — état honnête du système (providers, store, version). ?live=1 vérifie la base. */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { getVoiceStackHealth } from "@/adapters/voice/health";
import { DEFAULT_COMPANY_ID } from "@/data/companies";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const store = getStore();
  const info = store.info();
  const live = new URL(req.url).searchParams.get("live") === "1" ? await store.verifyLive() : undefined;
  const [companies, calls, actions] = await Promise.all([
    store.listCompanies(),
    store.listCalls(),
    store.listActions(),
  ]);
  return NextResponse.json({
    status: "ok",
    mode: info.provider === "prisma" ? "persistant" : "demo-mock",
    persistence: info.description,
    store: info,
    ...(live ? { live } : {}),
    providers: getVoiceStackHealth(),
    counts: {
      companies: companies.length,
      calls: calls.length,
      actions: actions.length,
    },
    defaultCompanyId: DEFAULT_COMPANY_ID,
  });
}
