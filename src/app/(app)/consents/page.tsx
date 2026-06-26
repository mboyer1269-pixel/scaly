/**
 * Registre des consentements (ADR-018) — la preuve, montrable telle quelle :
 * qui a consenti à quoi, verbatim, quand, par quel canal, et qui a révoqué.
 */
import Link from "next/link";
import { getStore } from "@/server/store";
import { resolveCompanyId } from "@/server/tenant";
import { Badge, Card, EmptyState, HonestyNote, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import type { ConsentStatus } from "@/domain/consent";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<ConsentStatus, { label: string; tone: "emerald" | "rose" | "slate" }> = {
  actif: { label: "Actif", tone: "emerald" },
  refuse: { label: "Refusé", tone: "slate" },
  revoque: { label: "Révoqué", tone: "rose" },
};

function formatPhone(p: string): string {
  return p.length === 10 ? `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}` : p;
}

export default async function ConsentsPage() {
  const store = getStore();
  const consents = await store.listConsents(await resolveCompanyId());
  const active = consents.filter((c) => c.status === "actif").length;
  const revoked = consents.filter((c) => c.status === "revoque").length;

  return (
    <>
      <PageHeader
        title="Registre des consentements"
        subtitle={`${active} actif(s) · ${revoked} révoqué(s) — chaque relance automatique passe par ce registre, sans exception`}
      />
      <Card>
        {consents.length === 0 ? (
          <EmptyState text="Aucun consentement capté encore — l'agente pose la question à chaque appel qualifié (ADR-015)." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs font-medium uppercase tracking-wide text-ink-500">
                  <th className="py-2 pr-3">Numéro</th>
                  <th className="py-2 pr-3">Statut</th>
                  <th className="py-2 pr-3">Réponse exacte (preuve)</th>
                  <th className="py-2 pr-3">Canal</th>
                  <th className="py-2 pr-3">Capté le</th>
                  <th className="py-2 pr-3">Révoqué</th>
                  <th className="py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {consents.map((c) => {
                  const badge = STATUS_BADGE[c.status];
                  return (
                    <tr key={c.id} className="border-b border-ink-50">
                      <td className="py-2.5 pr-3 font-medium text-ink-900">{formatPhone(c.phone)}</td>
                      <td className="py-2.5 pr-3"><Badge tone={badge.tone}>{badge.label}</Badge></td>
                      <td className="max-w-xs py-2.5 pr-3 text-ink-600">« {c.verbatim} »</td>
                      <td className="py-2.5 pr-3 text-ink-500">{c.channel}</td>
                      <td className="py-2.5 pr-3 text-ink-500">{formatDateTime(c.capturedAt)}</td>
                      <td className="py-2.5 pr-3 text-ink-500">
                        {c.revokedAt ? `${formatDateTime(c.revokedAt)} (${c.revokedVia ?? "?"})` : "—"}
                      </td>
                      <td className="py-2.5">
                        {c.sourceCallId ? (
                          <Link href={`/calls/${c.sourceCallId}`} className="text-xs text-scaly-700 underline">appel</Link>
                        ) : (
                          <span className="text-xs text-ink-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <div className="mt-4">
        <HonestyNote>
          Loi 25 / règles CRTC : le retrait est aussi simple que le consentement — un texto « STOP » ou « ARRÊT » au numéro
          de l'entreprise révoque tout, immédiatement, et c'est tracé ici. Une révocation n'est jamais ressuscitée par
          automatisme : seul un nouveau consentement capté par l'agente en appel peut rouvrir la relance.
        </HonestyNote>
      </div>
    </>
  );
}
