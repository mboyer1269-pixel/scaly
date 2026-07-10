/**
 * GET /api/calls/:id/evidence — exporte le Dossier d'appel vérifiable (JSON).
 * Même garde anti-IDOR que /api/calls/:id : un appel d'un autre tenant est
 * « introuvable », sauf pour le fondateur. Jamais d'export public.
 * L'export est tracé dans l'audit (empreinte tronquée — JAMAIS le transcript) :
 * un dossier présenté plus tard est confrontable à l'empreinte émise ici.
 */
import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { getSessionRole } from "@/server/auth";
import { requireTenant } from "@/server/tenant";
import { buildEvidencePackage } from "@/services/evidence";
import { canonicalPhone } from "@/domain/consent";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const store = getStore();
  const { id } = await params;
  const [tenant, role] = await Promise.all([requireTenant(), getSessionRole()]);
  if ("block" in tenant) return NextResponse.json({ error: "Appel introuvable" }, { status: 404 });
  const call = await store.getCall(id);
  if (!call || (call.companyId !== tenant.companyId && role !== "founder")) {
    return NextResponse.json({ error: "Appel introuvable" }, { status: 404 });
  }
  if (call.status === "in_progress") {
    return NextResponse.json({ error: "Appel encore en cours — le dossier sera disponible après finalisation." }, { status: 409 });
  }
  const company = await store.getCompany(call.companyId);
  if (!company) return NextResponse.json({ error: "Appel introuvable" }, { status: 404 });

  const consents = canonicalPhone(call.fromNumber).length === 10 ? await store.listConsents(call.companyId, call.fromNumber) : [];
  const externalId = call.provenance?.externalId;
  const auditTrail = (await store.getAuditLog(500)).filter(
    (a) => a.companyId === call.companyId && Boolean(a.detail) && (a.detail!.includes(call.id) || (externalId ? a.detail!.includes(externalId) : false)),
  );
  const provenanceEvidence = (await store.listReadinessEvidence(call.companyId, "live_call")).filter((e) => e.callId === call.id);

  const pkg = buildEvidencePackage({ company, call, consents, auditTrail, provenanceEvidence });
  await store.recordAudit({
    companyId: call.companyId,
    actor: "owner",
    event: "dossier_appel_exporté",
    detail: `${call.id} · empreinte ${pkg.evidenceHash.slice(0, 16)}… · ${call.transcript.length} tour(s) · ${consents.length} consentement(s)`,
  });
  return NextResponse.json(pkg, {
    headers: { "content-disposition": `attachment; filename="dossier-appel-${call.id}.json"` },
  });
}
