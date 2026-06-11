/**
 * GET /api/export/calls — export CSV prêt CRM (Excel/HubSpot/Pipedrive).
 * Une ligne par appel analysé : qui, quoi, urgence, valeur, prochaine action.
 * BOM UTF-8 pour qu'Excel affiche correctement les accents.
 * ?status=rescue → seulement la file de sauvetage (manqués non récupérés).
 */
import { getStore } from "@/server/store";
import { DEFAULT_COMPANY_ID } from "@/data/companies";
import { computeRescueQueue } from "@/services/rescue";
import { INTENT_LABELS, NEXT_ACTION_LABELS } from "@/domain/call";
import { callStatusBadge, leadBadge, urgencyBadge } from "@/lib/labels";

export const dynamic = "force-dynamic";

function csvField(v: string | number | undefined | null): string {
  let s = String(v ?? "");
  // Anti-injection de formules Excel/Sheets : neutralise =, +, -, @ en tête de cellule.
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rescueOnly = url.searchParams.get("status") === "rescue";

  const store = getStore();
  const company = await store.getCompany(DEFAULT_COMPANY_ID);
  if (!company) return new Response("Compagnie introuvable", { status: 404 });
  const calls = await store.listCalls(company.id);
  const actions = await store.listActions(company.id);

  const rows = rescueOnly ? computeRescueQueue(company, calls, actions).map((e) => e.call) : calls;

  const header = [
    "Date", "Nom", "Téléphone", "Langue", "Statut", "Intention", "Urgence", "Lead",
    "Valeur estimée (CAD)", "Prochaine action", "Résumé", "Durée (s)", "Source",
  ];
  const lines = rows.map((c) => {
    const i = c.intelligence;
    return [
      c.startedAt, c.callerName ?? "", c.fromNumber, c.language.toUpperCase(),
      callStatusBadge(c.status).label,
      i ? INTENT_LABELS[i.intent] : "", i ? urgencyBadge(i.urgency).label : "", i ? leadBadge(i.leadQuality).label : "",
      i?.estimatedValueCad ?? "", i ? NEXT_ACTION_LABELS[i.nextAction] : "", i?.summary ?? "",
      c.durationSec, c.source,
    ].map(csvField).join(",");
  });

  const csv = "﻿" + [header.map(csvField).join(","), ...lines].join("\r\n");
  const date = new Date().toISOString().slice(0, 10);
  await store.recordAudit({ companyId: company.id, actor: "ui", event: "export_csv", detail: `${rows.length} appels${rescueOnly ? " (file de sauvetage)" : ""}` });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="scaly-appels-${date}${rescueOnly ? "-a-sauver" : ""}.csv"`,
    },
  });
}
