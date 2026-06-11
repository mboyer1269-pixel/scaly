import { describe, expect, it } from "vitest";
import type { Call } from "@/domain/call";
import { SEED_COMPANIES } from "@/data/companies";
import { PLANS } from "@/domain/billing";
import { alertAlreadySent, buildOverageAlert, computeMonthMinutes, overageAuditDetail, OVERAGE_AUDIT_EVENT } from "@/services/overage";
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

describe("computeMonthMinutes", () => {
  it("ne compte que le mois civil courant, sans arrondi par appel", () => {
    const calls = [
      call("2026-06-01T08:00:00-04:00", 90), // 1,5 min
      call("2026-06-10T08:00:00-04:00", 30), // 0,5 min
      call("2026-05-31T08:00:00-04:00", 36_000), // mois précédent — ignoré
    ];
    expect(computeMonthMinutes(calls, NOW)).toBe(2);
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
