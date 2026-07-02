/**
 * Smart Recovery Queue — la file unifiée : chaque source (rescue, annulations,
 * plaintes, soumissions, chauds, décisions) devient une Opportunity avec
 * raison, valeur, urgence et prochaine action ; tri urgence puis valeur ;
 * un appel n'apparaît qu'une fois, sous son angle le plus urgent.
 */
import { describe, expect, it } from "vitest";
import type { Call, CallIntelligence } from "@/domain/call";
import type { OwnerNotification } from "@/domain/owner-notification";
import type { AppointmentGap } from "@/domain/gap-recovery";
import { SEED_COMPANIES } from "@/data/companies";
import { computeOpportunities, opportunitiesValueAtStake, type OpportunityInputs } from "@/services/opportunities";

const COMPANY = SEED_COMPANIES.find((c) => c.id === "comp_sourire")!;
const NOW = new Date("2026-07-02T12:00:00-04:00");

function call(id: string, over: Partial<Call> = {}, intel: Partial<CallIntelligence> = {}): Call {
  const intelligence: CallIntelligence = {
    engine: "rules-v1", summary: "x", intent: "prise_rdv", intentConfidence: 0.9,
    sentiment: "neutre", urgency: "normale", leadQuality: "tiede", estimatedValueCad: 300,
    valueBasis: "bareme_industrie", nextAction: "creer_suivi", tags: [],
    commercialScore: 60, confidence: 0.9, finalStatus: "resolu_par_ia", collectedFields: {}, ...intel,
  };
  return {
    id, companyId: COMPANY.id, direction: "inbound", status: "completed", source: "live",
    fromNumber: "819-555-1000", language: "fr", startedAt: "2026-07-02T10:00:00-04:00",
    durationSec: 60, transcript: [], recordingUrl: null, intelligence, ...over,
  };
}

function gap(id: string, over: Partial<AppointmentGap> = {}): AppointmentGap {
  return {
    id, companyId: COMPANY.id, capabilityId: "appointment_gap_recovery", humanLabel: "jeudi 14 h",
    source: "manual", status: "open", createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(), ...over,
  };
}

function inputs(over: Partial<OpportunityInputs> = {}): OpportunityInputs {
  return { calls: [], actions: [], gaps: [], offers: [], waitlist: [], notifications: [], ...over };
}

describe("computeOpportunities", () => {
  it("un appel manqué récent devient « appel à sauver » avec valeur à risque et action suggérée", () => {
    const missed = call("c_missed", { status: "missed", startedAt: new Date(NOW.getTime() - 10 * 60_000).toISOString() });
    const opps = computeOpportunities(COMPANY, inputs({ calls: [missed] }), NOW);
    expect(opps).toHaveLength(1);
    expect(opps[0].kind).toBe("appel_a_sauver");
    expect(opps[0].urgency).toBe("haute"); // fenêtre critique
    expect(opps[0].valueCad).toBeGreaterThan(0);
    expect(opps[0].nextAction).toBeTruthy();
    expect(opps[0].link).toBe("/calls/c_missed");
  });

  it("une plage ouverte devient « annulation à remplir » ; comblée ou annulée, elle disparaît", () => {
    const opps = computeOpportunities(
      COMPANY,
      inputs({ gaps: [gap("g_open"), gap("g_filled", { status: "filled" }), gap("g_cancelled", { status: "cancelled" })] }),
      NOW,
    );
    expect(opps.map((o) => o.id)).toEqual(["opp_gap_g_open"]);
    expect(opps[0].urgency).toBe("haute");
  });

  it("plainte, soumission due et lead chaud sont détectés — un appel n'apparaît qu'UNE fois", () => {
    const upset = call("c_upset", {}, { intent: "plainte", sentiment: "negatif", finalStatus: "suivi_requis" });
    const quote = call("c_quote", {}, { intent: "demande_soumission", finalStatus: "suivi_requis", estimatedValueCad: 900 });
    const hot = call("c_hot", {}, { leadQuality: "chaud", finalStatus: "suivi_requis" });
    const opps = computeOpportunities(COMPANY, inputs({ calls: [upset, quote, hot] }), NOW);
    expect(opps.map((o) => o.kind).sort()).toEqual(["a_rattraper", "client_chaud", "soumission_due"]);
    // c_upset est plainte ET suivi_requis → seulement « à rattraper », jamais deux entrées.
    expect(opps.filter((o) => o.sourceCallId === "c_upset")).toHaveLength(1);
  });

  it("une notification propriétaire pending devient « décision requise » avec son action recommandée", () => {
    const note: OwnerNotification = {
      id: "n1", companyId: COMPANY.id, type: "unknown_answer", status: "pending",
      title: "Maude a besoin d'une décision", summary: "Aucune source pour « garantie »",
      recommendedAction: "Ajouter l'information au Cerveau d'entreprise.", urgency: "haute",
      createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
    };
    const sent: OwnerNotification = { ...note, id: "n2", status: "sent" };
    const opps = computeOpportunities(COMPANY, inputs({ notifications: [note, sent] }), NOW);
    expect(opps).toHaveLength(1);
    expect(opps[0].kind).toBe("decision_requise");
    expect(opps[0].nextAction).toBe("Ajouter l'information au Cerveau d'entreprise.");
  });

  it("tri : urgence d'abord, puis valeur décroissante ; le total en jeu est la somme des valeurs", () => {
    const cheap = call("c_cheap", {}, { leadQuality: "chaud", finalStatus: "suivi_requis", estimatedValueCad: 100 });
    const rich = call("c_rich", { fromNumber: "819-555-2000" }, { intent: "demande_soumission", finalStatus: "suivi_requis", estimatedValueCad: 5000 });
    const upset = call("c_upset2", { fromNumber: "819-555-3000" }, { intent: "plainte", finalStatus: "suivi_requis" });
    const opps = computeOpportunities(COMPANY, inputs({ calls: [cheap, rich, upset] }), NOW);
    expect(opps[0].kind).toBe("a_rattraper"); // urgence haute avant tout
    expect(opps[1].id).toBe("opp_quote_c_rich"); // puis la plus grosse valeur
    expect(opportunitiesValueAtStake(opps)).toBe(5000 + 100); // la plainte ne porte pas de prix
  });

  it("les vieux appels (> 7 jours) et le spam ne polluent pas la file", () => {
    const old = call("c_old", { startedAt: "2026-06-20T10:00:00-04:00" }, { leadQuality: "chaud", finalStatus: "suivi_requis" });
    const spam = call("c_spam", {}, { intent: "spam" });
    expect(computeOpportunities(COMPANY, inputs({ calls: [old, spam] }), NOW)).toHaveLength(0);
  });
});
