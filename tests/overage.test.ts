import { describe, expect, it } from "vitest";
import type { Call } from "@/domain/call";
import { SEED_COMPANIES } from "@/data/companies";
import { PLANS } from "@/domain/billing";
import { alertAlreadySent, buildOverageAlert, overageAuditDetail, OVERAGE_AUDIT_EVENT } from "@/services/overage";
import { computeMonthUsage, estimateMonthInvoice, isBillableCall } from "@/services/usage";
import type { CallIntelligence } from "@/domain/call";
import { createRateLimiter } from "@/lib/rate-limit";

const company = SEED_COMPANIES[0]; // plan pro : 900 min incluses
const NOW = new Date("2026-06-11T16:00:00-04:00");

function call(startedAt: string, durationSec: number): Call {
  return {
    id: `call_${startedAt}_${durationSec}`, companyId: company.id, direction: "inbound",
    status: "completed", source: "simulator", fromNumber: "514-555-0000", language: "fr",
    startedAt, durationSec, transcript: [], recordingUrl: null,
  };
}

function callsTotalling(minutes: number): Call[] {
  return [call("2026-06-05T10:00:00-04:00", minutes * 60)];
}

function spamIntel(): CallIntelligence {
  return {
    engine: "rules-v1", summary: "spam", intent: "spam", intentConfidence: 0.9,
    sentiment: "neutre", urgency: "basse", leadQuality: "non_qualifie", estimatedValueCad: 0,
    valueBasis: "aucun", nextAction: "aucune", tags: [], commercialScore: 0,
    confidence: 0.9, finalStatus: "ignore_spam", collectedFields: {},
  };
}

describe("computeMonthUsage (la facture est vraie)", () => {
  it("ne compte que le mois civil courant, sans arrondi par appel", () => {
    const calls = [
      call("2026-06-01T08:00:00-04:00", 90), // 1,5 min
      call("2026-06-10T08:00:00-04:00", 30), // 0,5 min
      call("2026-05-31T08:00:00-04:00", 36_000), // mois précédent — ignoré
    ];
    expect(computeMonthUsage(calls, NOW).billableMinutes).toBe(2);
  });

  it("le spam détecté n'est JAMAIS facturé — il est compté à part, visible", () => {
    const calls = [
      call("2026-06-01T08:00:00-04:00", 120),
      { ...call("2026-06-02T08:00:00-04:00", 60), intelligence: spamIntel() },
    ];
    const usage = computeMonthUsage(calls, NOW);
    expect(usage.billableMinutes).toBe(2);
    expect(usage.spamMinutes).toBe(1);
    expect(usage.spamCalls).toBe(1);
    // La facture estimée repose sur les minutes facturables seulement.
    expect(estimateMonthInvoice("starter", usage).minutesUsed).toBe(2);
  });

  it("un appel sans analyse reste facturable — le spam doit être détecté pour être offert", () => {
    expect(isBillableCall(call("2026-06-01T08:00:00-04:00", 60))).toBe(true);
  });
});

describe("buildOverageAlert", () => {
  const included = PLANS[company.planId].includedMinutes;

  it("null sous 80 % des minutes incluses", () => {
    expect(buildOverageAlert(company, callsTotalling(included * 0.79), NOW)).toBeNull();
  });

  it("« approche » à 80 %, avec le tarif excédentaire publié dans le texte", () => {
    const alert = buildOverageAlert(company, callsTotalling(included * 0.8), NOW);
    expect(alert?.level).toBe("approche");
    expect(alert?.periodLabel).toBe("2026-06");
    expect(alert?.smsText).toContain("$/min");
    expect(alert?.smsText).toContain("aucune coupure");
  });

  it("« dépassé » à 100 %+, avec l'excédent estimé en dollars", () => {
    const alert = buildOverageAlert(company, callsTotalling(included + 100), NOW);
    expect(alert?.level).toBe("depasse");
    const expectedOverage = (100 * PLANS[company.planId].overagePerMinuteCad).toFixed(2).replace(".", ",");
    expect(alert?.smsText).toContain(expectedOverage);
  });
});

describe("alertAlreadySent", () => {
  const alert = buildOverageAlert(company, callsTotalling(PLANS[company.planId].includedMinutes), NOW)!;

  it("déduplique par mois + seuil quand l'envoi a réussi ou a été journalisé", () => {
    const audit = [{ at: "x", companyId: company.id, actor: "system", event: OVERAGE_AUDIT_EVENT, detail: overageAuditDetail(alert, "envoye") }];
    expect(alertAlreadySent(audit, company.id, alert)).toBe(true);
    expect(alertAlreadySent(audit, "autre_compagnie", alert)).toBe(false);
  });

  it("un ÉCHEC d'envoi ne déduplique pas — on retente au prochain cron", () => {
    const audit = [{ at: "x", companyId: company.id, actor: "system", event: OVERAGE_AUDIT_EVENT, detail: overageAuditDetail(alert, "echec") }];
    expect(alertAlreadySent(audit, company.id, alert)).toBe(false);
  });

  it("un autre seuil du même mois n'est pas dédupliqué", () => {
    const approche = { ...alert, level: "approche" as const };
    const audit = [{ at: "x", companyId: company.id, actor: "system", event: OVERAGE_AUDIT_EVENT, detail: overageAuditDetail(approche, "envoye") }];
    expect(alertAlreadySent(audit, company.id, alert)).toBe(false);
  });
});

describe("createRateLimiter", () => {
  it("bloque au-delà de la limite dans la fenêtre, par clé", () => {
    const rl = createRateLimiter(3, 60_000);
    const t0 = 1_000_000;
    expect(rl.check("a", t0).allowed).toBe(true);
    expect(rl.check("a", t0 + 1).allowed).toBe(true);
    expect(rl.check("a", t0 + 2).allowed).toBe(true);
    const blocked = rl.check("a", t0 + 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(rl.check("b", t0 + 3).allowed).toBe(true); // autre clé, pas affectée
  });

  it("libère quand la fenêtre glisse", () => {
    const rl = createRateLimiter(2, 60_000);
    const t0 = 1_000_000;
    rl.check("a", t0);
    rl.check("a", t0 + 10_000);
    expect(rl.check("a", t0 + 20_000).allowed).toBe(false);
    expect(rl.check("a", t0 + 61_000).allowed).toBe(true); // le premier hit est sorti de la fenêtre
  });
});
