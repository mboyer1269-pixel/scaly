/**
 * /roi — pourquoi vous payez, en 10 secondes.
 *
 * Un seul écran : ce qui a été protégé, récupéré et évité, sur la période —
 * avec la distinction honnête entre montants DÉCLARÉS en appel et ESTIMÉS par
 * barème. Le multiple « Maude coûte X $, elle a protégé Y $ » est calculé des
 * mêmes agrégats que le dashboard : aucun chiffre inventé pour cette page.
 */
import { getStore } from "@/server/store";
import { resolveCompany } from "@/server/tenant";
import { computeDashboard } from "@/services/analytics";
import { computeRoiSnapshot } from "@/services/rescue";
import { getGapRecoveryRepository } from "@/services/gap-recovery";
import { getScriptByIndustry } from "@/data/industry-scripts";
import { Card, HonestyNote, PageHeader, Stat } from "@/components/ui";
import { formatCad } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RoiPage() {
  const store = getStore();
  const company = (await resolveCompany())!;
  const repo = getGapRecoveryRepository();
  const [calls, actions, consents, gaps] = await Promise.all([
    store.listCalls(company.id),
    store.listActions(company.id),
    store.listConsents(company.id),
    repo.listGaps(company.id),
  ]);

  const dashboard = computeDashboard(company, calls, actions);
  const roi = computeRoiSnapshot(company, dashboard, calls);
  const baseline = getScriptByIndustry(company.industry).valueBaselineCad;

  const handled = calls.filter((c) => c.status === "completed" || c.status === "transferred").length;
  const filledGaps = gaps.filter((g) => g.status === "filled").length;
  const gapRecoveredCad = filledGaps * baseline;
  const followUpsCreated = actions.filter((a) => a.type === "send_sms" || a.type === "create_task").length;
  const activeConsents = consents.filter((c) => c.status === "actif").length;
  const revokedConsents = consents.filter((c) => c.status === "revoque").length;
  const failedActions = actions.filter((a) => a.status === "failed" || a.status === "requires_config").length;
  // ~4 min de réception par appel traité (prise de message + qualification) — hypothèse affichée.
  const hoursSaved = Math.round((handled * 4) / 60);

  return (
    <>
      <PageHeader
        title="Retour sur investissement"
        subtitle={`Les ${roi.periodDays} derniers jours — votre forfait coûte ${formatCad(roi.planPriceCad)}/mois.`}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Valeur protégée"
          value={formatCad(roi.protectedCad)}
          tone={roi.protectedCad > 0 ? "emerald" : "slate"}
          sub={`${formatCad(roi.protectedDeclaredCad)} déclarés en appel · ${formatCad(roi.protectedEstimatedCad)} estimés`}
        />
        <Stat
          label="Multiple du forfait"
          value={roi.multiple !== null ? `${roi.multiple}×` : "—"}
          tone={roi.multiple !== null && roi.multiple >= 1 ? "emerald" : "slate"}
          sub="valeur protégée ÷ prix mensuel"
        />
        <Stat
          label="Annulations comblées"
          value={String(filledGaps)}
          tone={filledGaps > 0 ? "emerald" : "slate"}
          sub={filledGaps > 0 ? `≈ ${formatCad(gapRecoveredCad)} récupérés (est.)` : "la boucle attend sa première plage"}
        />
        <Stat
          label="Encore à risque"
          value={formatCad(roi.atRiskCad)}
          tone={roi.atRiskCad > 0 ? "rose" : "emerald"}
          sub={`${roi.atRiskCount} appel(s) non récupéré(s) — voir Opportunités`}
        />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Appels traités" value={String(handled)} sub="répondus ou transférés" />
        <Stat label="Heures de réception sauvées" value={`≈ ${hoursSaved} h`} sub="hypothèse : 4 min par appel traité" />
        <Stat label="Suivis créés" value={String(followUpsCreated)} sub="SMS et tâches planifiés" />
        <Stat
          label="Consentements"
          value={`${activeConsents} actifs`}
          tone={activeConsents > 0 ? "teal" : "slate"}
          sub={`${revokedConsents} révoqué(s) — STOP respecté`}
        />
      </div>

      {failedActions > 0 && (
        <Card title="Blocages à régler" subtitle="On les montre au lieu de les cacher." className="mb-4">
          <p className="text-sm text-ink-700">
            {failedActions} action(s) en échec ou en attente de configuration — voir la page « À suivre » pour les
            relancer ou compléter la configuration (ex. Twilio).
          </p>
        </Card>
      )}

      <HonestyNote>
        « Déclaré » = montant dit par l'appelant, verbatim. « Estimé » = barème d'industrie (hypothèse interne,
        recalibrée avec vos vrais chiffres). Les heures sauvées supposent 4 minutes de réception par appel traité.
        Aucun chiffre de cette page n'est une promesse de résultat.
      </HonestyNote>
    </>
  );
}
