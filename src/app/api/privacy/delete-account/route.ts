import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { resolveCompanyId } from "@/server/tenant";
import { deleteCompanyAccountData } from "@/services/privacy";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { confirmation?: unknown };
  if (body.confirmation !== "SUPPRIMER ALLO MAUDE") {
    return NextResponse.json({
      error: "Confirmation requise : SUPPRIMER ALLO MAUDE",
    }, { status: 400 });
  }

  const companyId = await resolveCompanyId();
  const result = await deleteCompanyAccountData(getStore(), companyId, "owner-in-app");
  return NextResponse.json(result);
}
