/**
 * /opportunites — la Smart Recovery Queue : UNE file priorisée où chaque
 * dollar qui fuit demande une action. Le propriétaire ouvre cette page le
 * matin et sait exactement quoi faire, dans quel ordre, et pourquoi.
 */
import Link from "next/link";
import { getStore } from "@/server/store";
import { resolveCompany } from "@/server/tenant";
import { getGapRecoveryRepository } from "@/services/gap-recovery";
import { getOwnerNotificationRepository } from "@/services/owner-notifications";
import { OPPORTUNITY_KIND_LABELS, computeOpportunities, opportunitiesValueAtStake, type OpportunityKind } from "@/services/opportunities";
import { Badge, Card, EmptyState, HonestyNote, PageHeader, Stat } from "@/components/ui";
import { formatCad, formatDateTime } from "@/lib/format";
import type { Tone } from "@/lib/labels";

export const dynamic = "force-dynamic";

const KIND_TONE: Record<OpportunityKind, Tone> = {
  appel_a_sauver: "rose",
  annulation_a_remplir: "amber",
  a_rattraper: "rose",
  soumission_due: "sky",
  client_chaud: "emerald",
  decision_requise: "violet",
};

export default async function OpportunitesPage() {
  const store = getStore();
  const company = (await resolveCompany())!;
  const repo = getGapRecoveryRepository();
  const [calls, actions, gaps, offers, waitlist, notifications] = await Promise.all([
    store.listCalls(company.id),
    store.listActions(company.id),
    repo.listGaps(company.id),
    repo.listOffers(company.id),
    repo.listWaitlistEntries(company.id),
    getOwnerNotificationRepository().list(company.id),
  ]);

  const opportunities = computeOpportunities(company, { calls, actions, gaps, offers, waitlist, notifications });
  const atStake = opportunitiesValueAtStake(opportunities);
  const urgent = opportunities.filter((o) => o.urgency === "critique" || o.urgency === "haute").length;

  return (
    <>
      <PageHeader
        title="Opportunités"
        subtitle="Chaque appel devient une opportunité mesurée — la file est triée : le plus urgent et le plus payant d'abord."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="À traiter" value={String(opportunities.length)} sub="tout ce qui demande une action" />
        <Stat label="Urgent" value={String(urgent)} tone={urgent > 0 ? "rose" : "slate"} sub="à faire aujourd'hui" />
        <Stat label="Valeur en jeu (est.)" value={formatCad(atStake)} tone={atStake > 0 ? "amber" : "slate"} sub="montants mentionnés ou barème d'industrie" />
      </div>

      <Card>
        {opportunities.length === 0 ? (
          <EmptyState text="Rien à récupérer pour l'instant — Maude veille sur la ligne. Les nouvelles opportunités apparaissent ici dès qu'un appel en crée une." />
        ) : (
          <ul className="space-y-2">
            {opportunities.map((opp) => (
              <li key={opp.id}>
                <Link
                  href={opp.link}
                  className="flex flex-col gap-1 rounded-xl border border-ink-100 px-4 py-3 hover:border-scaly-300 hover:bg-scaly-50/40"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={KIND_TONE[opp.kind]}>{OPPORTUNITY_KIND_LABELS[opp.kind]}</Badge>
                    <span className="text-sm font-semibold text-ink-900">{opp.title}</span>
                    {opp.urgency === "haute" || opp.urgency === "critique" ? (
                      <Badge tone="rose">urgent</Badge>
                    ) : null}
                    <span className="ml-auto flex items-center gap-3">
                      {opp.valueCad !== null && <span className="text-sm font-bold text-amber-700">{formatCad(opp.valueCad)}</span>}
                      <span className="text-xs text-ink-400">{formatDateTime(opp.createdAt)}</span>
                    </span>
                  </div>
                  <p className="text-xs text-ink-500">{opp.reason}</p>
                  <p className="text-xs font-medium text-scaly-700">→ {opp.nextAction}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-4">
        <HonestyNote>
          Les montants sont des estimations — soit mentionnés en appel, soit un barème d'industrie à recalibrer
          avec vos chiffres. La file montre tout, elle ne cache jamais un blocage derrière un chiffre flatteur.
        </HonestyNote>
      </div>
    </>
  );
}
