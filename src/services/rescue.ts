/**
 * Service — Missed-Call Rescue + ROI Snapshot (fonctions pures).
 *
 * Le wedge de Scaly n'est pas « répondre au téléphone », c'est RÉCUPÉRER les
 * appels que la PME perd. Deux vues le rendent tangible :
 *  - la file de sauvetage : chaque appel manqué non récupéré, avec le chrono
 *    qui tourne (fenêtre critique < 15 min, encore chaud < 2 h, refroidi après) ;
 *  - le ROI snapshot : « Scaly vous coûte X $, il a protégé Y $ ce mois = N× ».
 *
 * HONNÊTETÉ : les valeurs sont des estimations par barème d'industrie
 * (valueBaselineCad — hypothèse interne, recalibrée par client réel, ADR-010).
 */
import type { Call } from "@/domain/call";
import type { ScalyAction } from "@/domain/action";
import type { Company } from "@/domain/company";
import type { DashboardData, RescueEntry, RescueWindow, RoiSnapshot } from "@/domain/analytics";
import { PLANS } from "@/domain/billing";
import { getScriptByIndustry } from "@/data/industry-scripts";

/** Seuils « speed to lead » (minutes). La majorité des clients achètent du premier répondant. */
export const RESCUE_CRITICAL_WINDOW_MIN = 15;
export const RESCUE_WARM_WINDOW_MIN = 120;

/** Statuts d'appel qui constituent une perte potentielle à récupérer. */
const RESCUABLE_STATUSES = new Set<Call["status"]>(["missed", "voicemail", "abandoned"]);

function windowFor(minutes: number): RescueWindow {
  if (minutes <= RESCUE_CRITICAL_WINDOW_MIN) return "fenetre_critique";
  if (minutes <= RESCUE_WARM_WINDOW_MIN) return "encore_chaud";
  return "refroidi";
}

const WINDOW_RANK: Record<RescueWindow, number> = { fenetre_critique: 0, encore_chaud: 1, refroidi: 2 };

/** Au-delà de cette fenêtre, un manqué n'est plus « à sauver » — il est perdu (et compté comme tel ailleurs). */
export const RESCUE_MAX_AGE_DAYS = 7;

/**
 * File de sauvetage : appels manqués/abandonnés/boîte vocale NON récupérés
 * des 7 derniers jours, triés par fenêtre (critique d'abord) puis valeur
 * à risque décroissante.
 */
export function computeRescueQueue(company: Company, calls: Call[], actions: ScalyAction[], now = new Date()): RescueEntry[] {
  const baseline = getScriptByIndustry(company.industry).valueBaselineCad;
  const oldest = now.getTime() - RESCUE_MAX_AGE_DAYS * 24 * 3600 * 1000;
  const smsByCall = new Set(
    actions.filter((a) => a.type === "send_sms" && a.callId && a.status !== "failed").map((a) => a.callId as string),
  );

  return calls
    .filter((c) => RESCUABLE_STATUSES.has(c.status) && !c.intelligence?.saved && new Date(c.startedAt).getTime() >= oldest)
    .map((call): RescueEntry => {
      const minutesSinceCall = Math.max(0, Math.round((now.getTime() - new Date(call.startedAt).getTime()) / 60_000));
      const window = windowFor(minutesSinceCall);
      const smsPlanned = smsByCall.has(call.id);
      const urgent = ["critique", "haute"].includes(call.intelligence?.urgency ?? "");
      const suggested = urgent
        ? "Rappeler MAINTENANT — urgence détectée"
        : window === "fenetre_critique"
          ? smsPlanned
            ? "SMS parti — rappeler pendant que c'est chaud"
            : "Rappeler maintenant (fenêtre critique)"
          : window === "encore_chaud"
            ? "Rappeler aujourd'hui — le lead est encore chaud"
            : "Rappeler quand même — mentionner l'appel manqué";
      return {
        call,
        minutesSinceCall,
        window,
        valueAtRiskCad: call.intelligence?.estimatedValueCad || baseline,
        smsPlanned,
        suggested,
      };
    })
    .sort((a, b) => WINDOW_RANK[a.window] - WINDOW_RANK[b.window] || b.valueAtRiskCad - a.valueAtRiskCad);
}

/** Le ROI en une phrase, calculé des mêmes agrégats que le dashboard. */
export function computeRoiSnapshot(company: Company, d: DashboardData, calls: Call[], now = new Date()): RoiSnapshot {
  const planPriceCad = PLANS[company.planId].priceMonthlyCad;
  const since = now.getTime() - d.periodDays * 24 * 3600 * 1000;
  const inPeriod = calls.filter((c) => new Date(c.startedAt).getTime() >= since);
  const savedCalls = inPeriod.filter((c) => c.intelligence?.saved);
  const protectedDeclaredCad = savedCalls
    .filter((c) => c.intelligence?.valueBasis === "montant_mentionne")
    .reduce((sum, c) => sum + (c.intelligence?.estimatedValueCad ?? 0), 0);
  const enCallsCount = inPeriod.filter((c) => c.language === "en" && c.status !== "missed").length;
  const atRiskCount = inPeriod.filter((c) => RESCUABLE_STATUSES.has(c.status) && !c.intelligence?.saved).length;
  return {
    periodDays: d.periodDays,
    planPriceCad,
    protectedCad: d.savedValueCad,
    protectedDeclaredCad,
    protectedEstimatedCad: Math.max(0, d.savedValueCad - protectedDeclaredCad),
    wouldBeLostCount: d.savedCount,
    atRiskCad: d.missedValueAtRiskCad,
    atRiskCount,
    multiple: planPriceCad > 0 ? Math.round((d.savedValueCad / planPriceCad) * 10) / 10 : null,
    enCallsCount,
  };
}
