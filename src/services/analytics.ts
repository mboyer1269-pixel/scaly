/**
 * Service — Analytics & intelligence stratégique
 * Agrégats du dashboard PME (valeur sauvée, pipeline, urgences, tendances)
 * et du cockpit admin (MRR, minutes, coûts IA estimés, marges).
 * Fonctions pures : elles reçoivent les données, ne touchent pas au store.
 */
import type { Call, Intent } from "@/domain/call";
import type { ScalyAction } from "@/domain/action";
import type { Company } from "@/domain/company";
import type {
  AdminCompanyRow,
  AdminIncident,
  AdminOverview,
  DashboardData,
  DayBucket,
  StrategicInsight,
} from "@/domain/analytics";
import { computeInvoice, EST_AI_COST_PER_MINUTE_CAD, PLANS } from "@/domain/billing";
import { getScriptByIndustry } from "@/data/industry-scripts";
import { getVoiceStackHealth } from "@/adapters/voice/health";
import { formatCad } from "@/lib/format";

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export function computeDashboard(
  company: Company,
  calls: Call[],
  actions: ScalyAction[],
  periodDays = 14,
  now = new Date(),
): DashboardData {
  const since = now.getTime() - periodDays * 24 * 3600 * 1000;
  const inPeriod = calls.filter((c) => new Date(c.startedAt).getTime() >= since);
  const baseline = getScriptByIndustry(company.industry).valueBaselineCad;

  const missedCalls = inPeriod.filter((c) => c.status === "missed");
  const answered = inPeriod.filter((c) => c.status === "completed" || c.status === "transferred");
  const transferred = inPeriod.filter((c) => c.status === "transferred");

  const savedCalls = inPeriod.filter((c) => c.intelligence?.saved);
  const savedValueCad = savedCalls.reduce((sum, c) => sum + (c.intelligence?.estimatedValueCad ?? 0), 0);
  const missedNotRecovered = missedCalls.filter((c) => !c.intelligence?.saved);
  const missedValueAtRiskCad = missedNotRecovered.length * baseline;

  const open = inPeriod.filter((c) => c.intelligence?.finalStatus === "suivi_requis");
  const pipelineValueCad = open
    .filter((c) => ["chaud", "tiede"].includes(c.intelligence?.leadQuality ?? ""))
    .reduce((sum, c) => sum + (c.intelligence?.estimatedValueCad ?? 0), 0);

  const urgentOpen = open.filter((c) => ["critique", "haute"].includes(c.intelligence?.urgency ?? "")).length;

  const byDay: DayBucket[] = [];
  for (let i = periodDays - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
    const key = d.toISOString().slice(0, 10);
    const dayCalls = inPeriod.filter((c) => dayKey(c.startedAt) === key);
    byDay.push({ date: key, total: dayCalls.length, missed: dayCalls.filter((c) => c.status === "missed").length });
  }

  const intentCounts = new Map<Intent, number>();
  for (const c of inPeriod) {
    const intent = c.intelligence?.intent;
    if (intent) intentCounts.set(intent, (intentCounts.get(intent) ?? 0) + 1);
  }
  const byIntent = [...intentCounts.entries()]
    .map(([intent, count]) => ({ intent, count }))
    .sort((a, b) => b.count - a.count);

  const hotOpportunities = inPeriod
    .filter((c) => c.intelligence?.leadQuality === "chaud" && c.intelligence.finalStatus === "suivi_requis")
    .sort((a, b) => (b.intelligence?.estimatedValueCad ?? 0) - (a.intelligence?.estimatedValueCad ?? 0))
    .slice(0, 6);

  const atRiskCalls = inPeriod
    .filter((c) => c.intelligence?.sentiment === "negatif" || c.intelligence?.intent === "plainte")
    .slice(0, 6);

  const recentCalls = [...inPeriod]
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, 9);

  const pendingActions = actions
    .filter((a) => a.status === "pending" || a.status === "requires_config")
    .slice(0, 8);

  const avgDurationSec = answered.length
    ? Math.round(answered.reduce((s, c) => s + c.durationSec, 0) / answered.length)
    : 0;

  return {
    periodDays,
    callsTotal: inPeriod.length,
    answeredByAi: answered.length,
    missed: missedCalls.length,
    transferred: transferred.length,
    urgentOpen,
    savedCount: savedCalls.length,
    savedValueCad,
    missedValueAtRiskCad,
    pipelineValueCad,
    avgDurationSec,
    byDay,
    byIntent,
    hotOpportunities,
    atRiskCalls,
    recentCalls,
    pendingActions,
    insights: buildInsights(company, inPeriod, baseline),
  };
}

/** Intelligence stratégique — recommandations générées par règles (déterministes). */
export function buildInsights(company: Company, calls: Call[], baselineCad: number): StrategicInsight[] {
  const insights: StrategicInsight[] = [];

  const hot = calls.filter((c) => c.intelligence?.leadQuality === "chaud" && c.intelligence.finalStatus === "suivi_requis");
  if (hot.length > 0) {
    const total = hot.reduce((s, c) => s + (c.intelligence?.estimatedValueCad ?? 0), 0);
    insights.push({
      id: "ins_opportunites",
      kind: "opportunite",
      title: `${hot.length} opportunité${hot.length > 1 ? "s" : ""} chaude${hot.length > 1 ? "s" : ""} à rappeler`,
      detail: `Valeur potentielle combinée de ${formatCad(total)}. Rappeler en priorité dans l'ordre de valeur.`,
      impactCad: total,
      callIds: hot.map((c) => c.id),
    });
  }

  const saved = calls.filter((c) => c.intelligence?.saved);
  if (saved.length > 0) {
    const total = saved.reduce((s, c) => s + (c.intelligence?.estimatedValueCad ?? 0), 0);
    insights.push({
      id: "ins_sauves",
      kind: "tendance",
      title: `${saved.length} appel${saved.length > 1 ? "s" : ""} sauvé${saved.length > 1 ? "s" : ""} (hors heures ou rappel auto)`,
      detail: `Sans Scaly, ces appels seraient probablement perdus. Valeur estimée protégée : ${formatCad(total)}.`,
      impactCad: total,
      callIds: saved.map((c) => c.id),
    });
  }

  const missedNotRecovered = calls.filter((c) => c.status === "missed" && !c.intelligence?.saved);
  if (missedNotRecovered.length > 0) {
    insights.push({
      id: "ins_pertes",
      kind: "risque",
      title: `${missedNotRecovered.length} appel${missedNotRecovered.length > 1 ? "s" : ""} manqué${missedNotRecovered.length > 1 ? "s" : ""} sans récupération`,
      detail: `Perte potentielle d'environ ${formatCad(missedNotRecovered.length * baselineCad)} (barème interne). Activer/verifier le SMS de rappel automatique.`,
      impactCad: missedNotRecovered.length * baselineCad,
      callIds: missedNotRecovered.map((c) => c.id),
    });
  }

  const complaints = calls.filter((c) => c.intelligence?.intent === "plainte");
  if (complaints.length > 0) {
    insights.push({
      id: "ins_risque",
      kind: "risque",
      title: `${complaints.length} conversation${complaints.length > 1 ? "s" : ""} à risque (plainte)`,
      detail: "Un rappel du propriétaire dans la journée réduit fortement le risque de perte du client.",
      callIds: complaints.map((c) => c.id),
    });
  }

  const priceMentions = calls.filter((c) =>
    c.transcript.some((t) => t.speaker === "caller" && /combien|prix|tarif|how much/i.test(t.text)),
  );
  if (priceMentions.length >= 2) {
    insights.push({
      id: "ins_objection_prix",
      kind: "objection",
      title: `Le prix revient dans ${priceMentions.length} appels`,
      detail: "Objection dominante : le prix. Préparer une grille tarifaire claire ou une fourchette à donner dès l'appel pourrait accélérer la conversion.",
      callIds: priceMentions.map((c) => c.id),
    });
  }

  const intents = new Map<string, number>();
  for (const c of calls) {
    const i = c.intelligence?.intent;
    if (i && i !== "spam") intents.set(i, (intents.get(i) ?? 0) + 1);
  }
  const top = [...intents.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top && calls.length > 0) {
    insights.push({
      id: "ins_tendance",
      kind: "recommandation",
      title: `Demande dominante : ${top[0]} (${Math.round((top[1] / calls.length) * 100)} % du volume)`,
      detail: "Ajuster le script d'accueil pour qualifier cette demande encore plus vite (moins de friction, plus de conversion).",
      callIds: [],
    });
  }

  return insights;
}

/** Score de performance téléphonique 0-100 (réponse, récupération, suivi). */
export function computePhonePerformanceScore(d: DashboardData): number {
  if (d.callsTotal === 0) return 0;
  const answerRate = d.answeredByAi / d.callsTotal;
  const recoveryRate = d.missed === 0 ? 1 : d.savedCount / Math.max(1, d.missed + d.savedCount);
  const followUpRate = d.pendingActions.length === 0 ? 1 : 0.7;
  return Math.round(100 * (0.5 * answerRate + 0.3 * recoveryRate + 0.2 * followUpRate));
}

/** Incidents mock pour la démo du cockpit — clairement étiquetés. */
const MOCK_INCIDENTS: AdminIncident[] = [
  {
    id: "inc_1",
    at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    severity: "mineur",
    title: "[DÉMO] Latence élevée simulée sur le moteur d'analyse (résolu)",
    status: "resolu",
  },
  {
    id: "inc_2",
    at: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
    severity: "mineur",
    title: "[DÉMO] Échec d'une action mock send_webhook (URL non configurée)",
    status: "ouvert",
  },
];

export function computeAdminOverview(rows: { company: Company; calls: Call[] }[]): AdminOverview {
  const companyRows: AdminCompanyRow[] = rows.map(({ company, calls }) => {
    const since = Date.now() - 14 * 24 * 3600 * 1000;
    const recent = calls.filter((c) => new Date(c.startedAt).getTime() >= since);
    const minutes = Math.round(recent.reduce((s, c) => s + c.durationSec, 0) / 60);
    const estAiCostCad = Math.round(minutes * EST_AI_COST_PER_MINUTE_CAD * 100) / 100;
    const plan = PLANS[company.planId];
    return {
      company,
      calls14d: recent.length,
      minutes,
      estAiCostCad,
      planPriceCad: plan.priceMonthlyCad,
      estMarginCad: Math.round((plan.priceMonthlyCad - estAiCostCad) * 100) / 100,
      invoice: computeInvoice(company.planId, minutes),
    };
  });

  const mrrCad = companyRows.reduce((s, r) => s + r.planPriceCad, 0);
  const totalMinutes = companyRows.reduce((s, r) => s + r.minutes, 0);
  const totalAiCostCad = Math.round(companyRows.reduce((s, r) => s + r.estAiCostCad, 0) * 100) / 100;

  return {
    mrrCad,
    totalMinutes,
    totalAiCostCad,
    grossMarginCad: Math.round((mrrCad - totalAiCostCad) * 100) / 100,
    rows: companyRows,
    providerHealth: getVoiceStackHealth(),
    incidents: MOCK_INCIDENTS,
  };
}
