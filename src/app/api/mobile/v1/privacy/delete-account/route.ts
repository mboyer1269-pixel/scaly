import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { resolveCompanyId } from "@/server/tenant";
import { requireMobileBearer } from "@/server/mobile-auth";
import { deleteCompanyAccountData } from "@/services/privacy";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const authError = requireMobileBearer(req);
  if (authError) return authError;

  const body = (await req.json().catch(() => ({}))) as { confirmation?: unknown };
  if (body.confirmation !== "SUPPRIMER ALLO MAUDE") {
    return NextResponse.json({ error: "Confirmation requise : SUPPRIMER ALLO MAUDE" }, { status: 400 });
  }

  return NextResponse.json(await deleteCompanyAccountData(getStore(), await resolveCompanyId(), "owner-mobile"));
}
