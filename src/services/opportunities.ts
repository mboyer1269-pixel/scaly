/**
 * Service — Smart Recovery Queue (fonctions PURES).
 *
 * UNE seule file priorisée où le propriétaire agit : chaque dollar qui fuit
 * (appel manqué, annulation, client chaud qui refroidit, mécontent, soumission
 * oubliée, décision en attente) devient une Opportunity avec raison, valeur,
 * urgence et prochaine action. C'est la réponse PME-Québec aux Smart Inbox du
 * marché — sans PMS ni DMS : tout vient des appels et des boucles déjà en place.
 *
 * HONNÊTETÉ : les valeurs sont des estimations (montant mentionné en appel ou
 * barème d'industrie, ADR-010) — affichées comme telles, jamais promises.
 */
import type { Call, Urgency } from "@/domain/call";
import type { Company } from "@/domain/company";
import type { ScalyAction } from "@/domain/action";
import type { OwnerNotification } from "@/domain/owner-notification";
import type { AppointmentGap, RecoveryOffer, WaitlistEntry } from "@/domain/gap-recovery";
import { computeRescueQueue } from "@/services/rescue";
import { getScriptByIndustry } from "@/data/industry-scripts";

export type OpportunityKind =
  | "appel_a_sauver"
  | "annulation_a_remplir"
  | "a_rattraper"
  | "soumission_due"
  | "client_chaud"
  | "decision_requise";

export const OPPORTUNITY_KIND_LABELS: Record<OpportunityKind, string> = {
  appel_a_sauver: "Appel à sauver",
  annulation_a_remplir: "Annulation à remplir",
  a_rattraper: "Client à rattraper",
  soumission_due: "Soumission due",
  client_chaud: "Client chaud",
  decision_requise: "Décision requise",
};

export interface Opportunity {
  id: string;
  kind: OpportunityKind;
  /** Qui / quoi — court, humain. */
  title: string;
  /** Pourquoi c'est dans la file — dérivé des données, jamais inventé. */
  reason: string;
  /** Valeur estimée en jeu (CAD) — null quand on refuse d'inventer un chiffre. */
  valueCad: number | null;
  urgency: Urgency;
  /** La prochaine action concrète, en une phrase. */
  nextAction: string;
  sourceCallId?: string;
  /** Page où agir. */
  link: string;
  createdAt: string;
}

const URGENCY_RANK: Record<Urgency, number> = { critique: 0, haute: 1, normale: 2, basse: 3 };

/** Fenêtre de fraîcheur : au-delà, un signal d'appel n'est plus une opportunité chaude. */
const CALL_WINDOW_DAYS = 7;

/**
 * Prédicat PARTAGÉ : cet appel crée-t-il une opportunité ? Utilisé par la file
 * (section 3 ci-dessous) ET par l'Event Boundary (`opportunity.detected` émis
 * au moment où l'appel est persisté) — une seule définition, jamais de dérive.
 */
export function callOpportunitySignal(
  intel: Call["intelligence"],
): { kind: "a_rattraper" | "soumission_due" | "client_chaud"; reason: string } | null {
  if (!intel || intel.intent === "spam") return null;
  if (intel.intent === "plainte" || intel.sentiment === "negatif") {
    return {
      kind: "a_rattraper",
      reason: intel.intent === "plainte" ? "Plainte exprimée en appel" : "Ton négatif détecté en appel",
    };
  }
  if (intel.intent === "demande_soumission" && intel.finalStatus === "suivi_requis") {
    return { kind: "soumission_due", reason: "Soumission demandée en appel, pas encore envoyée" };
  }
  if (intel.leadQuality === "chaud" && intel.finalStatus === "suivi_requis") {
    return { kind: "client_chaud", reason: "Lead chaud en attente d'un suivi humain" };
  }
  return null;
}

export interface OpportunityInputs {
  calls: Call[];
  actions: ScalyAction[];
  gaps: AppointmentGap[];
  offers: RecoveryOffer[];
  waitlist: WaitlistEntry[];
  notifications: OwnerNotification[];
}

/**
 * Construit la file unifiée. Un même appel n'apparaît qu'UNE fois, sous son
 * angle le plus urgent (à sauver > à rattraper > soumission > chaud).
 */
export function computeOpportunities(company: Company, inputs: OpportunityInputs, now = new Date()): Opportunity[] {
  const baseline = getScriptByIndustry(company.industry).valueBaselineCad;
  const oldest = now.getTime() - CALL_WINDOW_DAYS * 24 * 3600 * 1000;
  const recent = (c: Call) => new Date(c.startedAt).getTime() >= oldest;
  const usedCalls = new Set<string>();
  const list: Opportunity[] = [];

  // 1) Appels manqués à sauver — la file rescue existante, requalifiée.
  for (const entry of computeRescueQueue(company, inputs.calls, inputs.actions, now)) {
    usedCalls.add(entry.call.id);
    list.push({
      id: `opp_rescue_${entry.call.id}`,
      kind: "appel_a_sauver",
      title: entry.call.callerName ?? entry.call.fromNumber,
      reason:
        entry.window === "fenetre_critique"
          ? `Appel manqué il y a ${entry.minutesSinceCall} min — fenêtre critique`
          : entry.window === "encore_chaud"
            ? `Appel manqué il y a ${Math.round(entry.minutesSinceCall / 60)} h — encore chaud`
            : "Appel manqué non récupéré cette semaine",
      valueCad: entry.valueAtRiskCad,
      urgency: entry.window === "fenetre_critique" ? "haute" : "normale",
      nextAction: entry.suggested,
      sourceCallId: entry.call.id,
      link: `/calls/${entry.call.id}`,
      createdAt: entry.call.startedAt,
    });
  }

  // 2) Annulations à remplir — plages encore ouvertes/offertes.
  for (const gap of inputs.gaps) {
    if (gap.status !== "open" && gap.status !== "offered") continue;
    const sent = inputs.offers.filter((o) => o.gapId === gap.id && o.status === "sent").length;
    const waiting = inputs.waitlist.filter((w) => w.status === "active").length;
    list.push({
      id: `opp_gap_${gap.id}`,
      kind: "annulation_a_remplir",
      title: `Plage ${gap.humanLabel}`,
      reason:
        sent > 0
          ? `${sent} relance(s) partie(s) — en attente d'un OUI`
          : waiting > 0
            ? `${waiting} personne(s) en attente — aucune relance encore partie`
            : "Aucun candidat en liste d'attente pour l'instant",
      valueCad: baseline,
      urgency: "haute",
      nextAction: sent > 0 ? "Surveiller les réponses, confirmer le premier OUI" : "Relancer la liste d'attente",
      link: "/annulations",
      createdAt: gap.createdAt,
    });
  }

  // 3) Signaux d'appels récents — un angle par appel, le plus urgent d'abord.
  for (const call of inputs.calls) {
    const intel = call.intelligence;
    if (!intel || usedCalls.has(call.id) || !recent(call) || intel.intent === "spam") continue;
    const who = call.callerName ?? call.fromNumber;

    const signal = callOpportunitySignal(intel);
    if (!signal) continue;
    usedCalls.add(call.id);
    if (signal.kind === "a_rattraper") {
      list.push({
        id: `opp_upset_${call.id}`,
        kind: signal.kind,
        title: who,
        reason: signal.reason,
        valueCad: null, // on ne met pas un prix sur une relation à sauver
        urgency: "haute",
        nextAction: "Rappeler aujourd'hui — un client rattrapé reste un client",
        sourceCallId: call.id,
        link: `/calls/${call.id}`,
        createdAt: call.startedAt,
      });
    } else if (signal.kind === "soumission_due") {
      list.push({
        id: `opp_quote_${call.id}`,
        kind: signal.kind,
        title: who,
        reason: signal.reason,
        valueCad: intel.estimatedValueCad || baseline,
        urgency: "normale",
        nextAction: "Envoyer la soumission — le suivi J+2 consenti prendra le relais",
        sourceCallId: call.id,
        link: `/calls/${call.id}`,
        createdAt: call.startedAt,
      });
    } else {
      list.push({
        id: `opp_hot_${call.id}`,
        kind: signal.kind,
        title: who,
        reason: signal.reason,
        valueCad: intel.estimatedValueCad || baseline,
        urgency: intel.urgency === "critique" || intel.urgency === "haute" ? "haute" : "normale",
        nextAction: "Rappeler pendant que c'est chaud — la majorité achète du premier répondant",
        sourceCallId: call.id,
        link: `/calls/${call.id}`,
        createdAt: call.startedAt,
      });
    }
  }

  // 4) Décisions propriétaire en attente (notifications pending).
  for (const note of inputs.notifications) {
    if (note.status !== "pending") continue;
    list.push({
      id: `opp_note_${note.id}`,
      kind: "decision_requise",
      title: note.title,
      reason: note.summary,
      valueCad: null,
      urgency: note.urgency,
      nextAction: note.recommendedAction,
      sourceCallId: note.sourceCallId,
      link: note.sourceCallId ? `/calls/${note.sourceCallId}` : "/follow-up",
      createdAt: note.createdAt,
    });
  }

  return list.sort(
    (a, b) =>
      URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] ||
      (b.valueCad ?? 0) - (a.valueCad ?? 0) ||
      b.createdAt.localeCompare(a.createdAt),
  );
}

/** Total estimé en jeu dans la file — le chiffre qui ouvre la page. */
export function opportunitiesValueAtStake(opportunities: Opportunity[]): number {
  return opportunities.reduce((sum, o) => sum + (o.valueCad ?? 0), 0);
}
