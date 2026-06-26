import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { resolveCompanyId } from "@/server/tenant";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const companyId = await resolveCompanyId();
  const store = getStore();
  const { id } = await params;
  const item = (await store.listReviewItems(companyId)).find((candidate) => candidate.id === id);
  if (!item) return NextResponse.json({ error: "Révision introuvable." }, { status: 404 });

  let body: { status?: string; resolution?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const status = body.status === "ignored" ? "ignored" : body.status === "resolved" ? "resolved" : null;
  const resolution = body.resolution?.trim();
  if (!status || !resolution) {
    return NextResponse.json({ error: "Statut et note de résolution requis." }, { status: 400 });
  }

  const updated = await store.resolveReviewItem(item.id, resolution, status);
  return NextResponse.json(updated);
}
