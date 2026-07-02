/**
 * /annulations — Remplissage intelligent des annulations, côté propriétaire.
 *
 * La promesse en une phrase : « Quand une plage se libère, Maude relance les
 * bonnes personnes au lieu de laisser le trou coûter de l'argent. »
 * Une plage se décrit en mots simples (pas de calendrier à configurer), la
 * liste d'attente vient des appels réels, et chaque offre est consentie,
 * auditée et réversible.
 */
import { getStore } from "@/server/store";
import { resolveCompanyId } from "@/server/tenant";
import { getIndustryPack } from "@/data/industry-packs";
import { expireStaleGapRecovery, getGapRecoveryRepository } from "@/services/gap-recovery";
import { Badge, Card, EmptyState, HonestyNote, PageHeader, Stat } from "@/components/ui";
import { OfferActions, OpenGapForm } from "@/components/GapRecoveryClient";
import { formatDateTime } from "@/lib/format";
import type { AppointmentGapStatus, RecoveryOfferStatus, SmsConsentState, WaitlistEntryStatus } from "@/domain/gap-recovery";
import type { Tone } from "@/lib/labels";

export const dynamic = "force-dynamic";

const GAP_BADGE: Record<AppointmentGapStatus, { label: string; tone: Tone }> = {
  open: { label: "Ouverte", tone: "amber" },
  offered: { label: "Offerte", tone: "sky" },
  filled: { label: "Comblée ✓", tone: "emerald" },
  cancelled: { label: "Annulée", tone: "rose" },
  expired: { label: "Expirée", tone: "slate" },
};

const OFFER_BADGE: Record<RecoveryOfferStatus, { label: string; tone: Tone }> = {
  prepared: { label: "Préparée", tone: "amber" },
  sent: { label: "Envoyée", tone: "sky" },
  confirmed: { label: "A dit oui", tone: "emerald" },
  declined: { label: "A dit non", tone: "slate" },
  cancelled: { label: "Retirée", tone: "rose" },
  expired: { label: "Expirée", tone: "slate" },
  failed: { label: "Échec d'envoi", tone: "rose" },
};

const ENTRY_BADGE: Record<WaitlistEntryStatus, { label: string; tone: Tone }> = {
  active: { label: "En attente", tone: "teal" },
  contacted: { label: "Relancée", tone: "sky" },
  confirmed: { label: "Placée ✓", tone: "emerald" },
  cancelled: { label: "Retirée", tone: "rose" },
  expired: { label: "Expirée", tone: "slate" },
};

const CONSENT_BADGE: Record<SmsConsentState, { label: string; tone: Tone }> = {
  yes: { label: "SMS ok", tone: "emerald" },
  no: { label: "SMS refusé", tone: "rose" },
  unknown: { label: "À confirmer", tone: "amber" },
};

function formatPhone(p: string): string {
  const digits = p.replace(/\D/g, "").replace(/^1/, "");
  return digits.length === 10 ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}` : p;
}

export default async function AnnulationsPage() {
  const companyId = await resolveCompanyId();
  const store = getStore();
  const company = await store.getCompany(companyId);
  const repo = getGapRecoveryRepository();

  // Expiration paresseuse : la page montre TOUJOURS l'état vrai (le cron
  // quotidien fait la même chose — deux filets, zéro mensonge).
  if (company) await expireStaleGapRecovery(company);

  const [gaps, waitlist, offers] = await Promise.all([
    repo.listGaps(companyId),
    repo.listWaitlistEntries(companyId),
    repo.listOffers(companyId),
  ]);
  const pack = company ? getIndustryPack(company.industry) : undefined;
  const entryById = new Map(waitlist.map((entry) => [entry.id, entry]));

  const waiting = waitlist.filter((entry) => entry.status === "active").length;
  const filled = gaps.filter((gap) => gap.status === "filled").length;
  const sentCount = offers.filter((offer) => offer.status === "sent" || offer.status === "confirmed").length;

  return (
    <>
      <PageHeader
        title="Remplissage des annulations"
        subtitle="Quand une plage se libère, Maude relance les bonnes personnes — consentement d'abord, première réponse OUI remporte la plage."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="En attente d'une place" value={String(waiting)} sub="captés pendant les appels" tone="teal" />
        <Stat label="Relances parties" value={String(sentCount)} sub="toujours consenties" tone="sky" />
        <Stat label="Plages comblées" value={String(filled)} tone="emerald" sub="au lieu de rester vides" />
        <Stat label="Plages suivies" value={String(gaps.length)} sub="sans calendrier à gérer" />
      </div>

      <Card
        title="Une plage vient de se libérer ?"
        subtitle="Décrivez-la comme vous le diriez au téléphone — Maude s'occupe de relancer, dans l'ordre juste."
        className="mb-4"
      >
        <OpenGapForm serviceCategories={pack?.serviceCategories ?? []} />
      </Card>

      <Card title="Plages et relances" subtitle="Chaque offre est traçable : préparée → envoyée → oui/non. Jamais deux fois la même personne pour la même plage." className="mb-4">
        {gaps.length === 0 ? (
          <EmptyState text="Aucune plage suivie encore. Dès qu'un rendez-vous s'annule, notez la plage ci-dessus — ou laissez Maude la capter en appel." />
        ) : (
          <div className="space-y-4">
            {gaps.map((gap) => {
              const gapBadge = GAP_BADGE[gap.status];
              const gapOffers = offers.filter((offer) => offer.gapId === gap.id);
              return (
                <div key={gap.id} className="rounded-xl border border-ink-100 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink-900">{gap.humanLabel}</span>
                    {gap.serviceLabel || gap.serviceCategory ? (
                      <span className="text-xs text-ink-500">· {gap.serviceLabel ?? pack?.serviceCategories.find((c) => c.id === gap.serviceCategory)?.label ?? gap.serviceCategory}</span>
                    ) : null}
                    <Badge tone={gapBadge.tone}>{gapBadge.label}</Badge>
                    <span className="ml-auto text-xs text-ink-400">{formatDateTime(gap.createdAt)}</span>
                  </div>
                  {gapOffers.length === 0 ? (
                    <p className="mt-2 text-xs text-ink-500">Personne sur la liste ne correspondait au moment de l'ouverture.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {gapOffers.map((offer) => {
                        const entry = entryById.get(offer.waitlistEntryId);
                        const offerBadge = OFFER_BADGE[offer.status];
                        return (
                          <li key={offer.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-ink-50/60 px-3 py-2">
                            <span className="text-sm font-medium text-ink-800">
                              {entry?.callerName ?? (entry ? formatPhone(entry.phone) : "—")}
                            </span>
                            {entry?.callerName && entry?.phone && (
                              <span className="text-xs text-ink-500">{formatPhone(entry.phone)}</span>
                            )}
                            <Badge tone={offerBadge.tone}>{offerBadge.label}</Badge>
                            {offer.channel === "action_only" && (
                              <span className="text-xs text-amber-700">consentement SMS à confirmer — relance manuelle</span>
                            )}
                            <div className="ml-auto">
                              <OfferActions offerId={offer.id} status={offer.status} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="Liste d'attente" subtitle="Ces personnes ont demandé en appel qu'on les rappelle si une place se libère — leur réponse exacte est conservée." className="mb-4">
        {waitlist.length === 0 ? (
          <EmptyState text="Personne en attente pour l'instant. Quand un appelant dit « appelez-moi si une place se libère », Maude l'inscrit ici automatiquement." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs font-medium uppercase tracking-wide text-ink-500">
                  <th className="py-2 pr-3">Personne</th>
                  <th className="py-2 pr-3">Souhaite</th>
                  <th className="py-2 pr-3">Quand</th>
                  <th className="py-2 pr-3">SMS</th>
                  <th className="py-2 pr-3">Statut</th>
                  <th className="py-2">Inscrite le</th>
                </tr>
              </thead>
              <tbody>
                {waitlist.map((entry) => {
                  const entryBadge = ENTRY_BADGE[entry.status];
                  const consentBadge = CONSENT_BADGE[entry.consentToSms];
                  return (
                    <tr key={entry.id} className="border-b border-ink-50">
                      <td className="py-2.5 pr-3">
                        <span className="font-medium text-ink-900">{entry.callerName ?? formatPhone(entry.phone)}</span>
                        {entry.callerName && <span className="ml-2 text-xs text-ink-500">{formatPhone(entry.phone)}</span>}
                      </td>
                      <td className="py-2.5 pr-3 text-ink-600">
                        {entry.desiredServiceLabel ?? pack?.serviceCategories.find((c) => c.id === entry.desiredServiceCategory)?.label ?? "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-ink-500">{entry.preferredTimeWindow ?? "—"}</td>
                      <td className="py-2.5 pr-3"><Badge tone={consentBadge.tone}>{consentBadge.label}</Badge></td>
                      <td className="py-2.5 pr-3"><Badge tone={entryBadge.tone}>{entryBadge.label}</Badge></td>
                      <td className="py-2.5 text-ink-500">{formatDateTime(entry.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <HonestyNote>
        Aucun texto ne part sans consentement actif au registre — STOP arrête tout, immédiatement. Le message
        n'affirme jamais que la plage est réservée : c'est vous (ou une réponse OUI) qui confirmez. Les offres
        sans réponse expirent après 48 h.
      </HonestyNote>
    </>
  );
}
