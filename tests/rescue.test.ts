import { describe, expect, it } from "vitest";
import type { Call, CallIntelligence } from "@/domain/call";
import type { ScalyAction } from "@/domain/action";
import { SEED_COMPANIES } from "@/data/companies";
import { computeDashboard } from "@/services/analytics";
import { computeRescueQueue, computeRoiSnapshot, RESCUE_CRITICAL_WINDOW_MIN } from "@/services/rescue";

const company = SEED_COMPANIES[0]; // services_domicile — baseline 450 $

const NOW = new Date("2026-06-11T12:00:00Z");

function intel(over: Partial<CallIntelligence> = {}): CallIntelligence {
  return {
    engine: "rules-v1",
    summary: "fixture",
    intent: "demande_soumission",
    intentConfidence: 0.9,
    sentiment: "neutre",
    urgency: "normale",
    leadQuality: "tiede",
    estimatedValueCad: 0,
    valueBasis: "bareme_industrie",
    nextAction: "rappeler_immediatement",
    tags: [],
    commercialScore: 50,
    confidence: 0.9,
    finalStatus: "suivi_requis",
    collectedFields: {},
    ...over,
  };
}

function call(over: Partial<Call> & { minutesAgo: number }): Call {
  const { minutesAgo, ...rest } = over;
  return {
    id: rest.id ?? `call_${minutesAgo}`,
    companyId: company.id,
    direction: "inbound",
    status: "missed",
    source: "simulator",
    fromNumber: "514-555-0000",
    language: "fr",
    startedAt: new Date(NOW.getTime() - minutesAgo * 60_000).toISOString(),
    durationSec: 0,
    transcript: [],
    recordingUrl: null,
    ...rest,
  };
}

describe("computeRescueQueue", () => {
  it("classe par fenêtre (critique < 15 min, chaud < 2 h, refroidi après) puis par valeur", () => {
    const calls = [
      call({ id: "vieux", minutesAgo: 300 }),
      call({ id: "frais", minutesAgo: 5 }),
      call({ id: "tiede", minutesAgo: 60 }),
    ];
    const q = computeRescueQueue(company, calls, [], NOW);
    expect(q.map((e) => e.call.id)).toEqual(["frais", "tiede", "vieux"]);
    expect(q[0].window).toBe("fenetre_critique");
    expect(q[1].window).toBe("encore_chaud");
    expect(q[2].window).toBe("refroidi");
    expect(q[0].minutesSinceCall).toBeLessThanOrEqual(RESCUE_CRITICAL_WINDOW_MIN);
  });

  it("exclut les appels répondus et les appels déjà sauvés", () => {
    const saved = call({ id: "sauve", minutesAgo: 10 });
    saved.intelligence = intel({ saved: { reason: "hors_heures" } });
    const answered = call({ id: "repondu", minutesAgo: 10, status: "completed" });
    const q = computeRescueQueue(company, [saved, answered, call({ id: "perdu", minutesAgo: 10 })], [], NOW);
    expect(q.map((e) => e.call.id)).toEqual(["perdu"]);
  });

  it("la valeur à risque = intelligence si présente, sinon barème d'industrie", () => {
    const withIntel = call({ id: "estime", minutesAgo: 5 });
    withIntel.intelligence = intel({ estimatedValueCad: 1200 });
    const q = computeRescueQueue(company, [withIntel, call({ id: "bareme", minutesAgo: 5 })], [], NOW);
    expect(q[0].valueAtRiskCad).toBe(1200); // trié valeur décroissante dans la même fenêtre
    expect(q[1].valueAtRiskCad).toBe(450);
  });

  it("détecte le SMS auto déjà planifié et adapte la suggestion", () => {
    const c = call({ id: "avec_sms", minutesAgo: 5 });
    const sms = { id: "act_1", companyId: company.id, callId: "avec_sms", type: "send_sms", status: "pending" } as ScalyAction;
    const q = computeRescueQueue(company, [c], [sms], NOW);
    expect(q[0].smsPlanned).toBe(true);
    expect(q[0].suggested).toContain("SMS parti");
  });

  it("ne considère pas un SMS annulé, échoué ou non configuré comme déjà planifié", () => {
    const c = call({ id: "sans_sms_actif", minutesAgo: 5 });
    const actions = ["cancelled", "failed", "requires_config"].map(
      (status, index) =>
        ({
          id: `act_${index}`,
          companyId: company.id,
          callId: c.id,
          type: "send_sms",
          status,
        }) as ScalyAction,
    );
    const q = computeRescueQueue(company, [c], actions, NOW);
    expect(q[0].smsPlanned).toBe(false);
    expect(q[0].suggested).toContain("Rappeler maintenant");
  });

  it("une urgence détectée passe le message en rappel immédiat", () => {
    const c = call({ id: "urgent", minutesAgo: 90 });
    c.intelligence = intel({ urgency: "critique", estimatedValueCad: 800 });
    const q = computeRescueQueue(company, [c], [], NOW);
    expect(q[0].suggested).toContain("MAINTENANT");
  });
});

describe("computeRoiSnapshot", () => {
  it("calcule le multiplicateur protégé/prix du plan et la preuve bilingue", () => {
    const calls: Call[] = [
      // 2 appels sauvés de 600 $ chacun
      ...[1, 2].map((n) => {
        const c = call({ id: `s${n}`, minutesAgo: 60 * n, status: "completed" });
        c.intelligence = intel({
          saved: { reason: "hors_heures" },
          estimatedValueCad: n === 1 ? 700 : 500,
          valueBasis: n === 1 ? "montant_mentionne" : "bareme_industrie",
        });
        return c;
      }),
      // 1 manqué non récupéré
      call({ id: "m1", minutesAgo: 30 }),
      // 1 appel servi en anglais
      call({ id: "en1", minutesAgo: 45, status: "completed", language: "en" }),
    ];
    const d = computeDashboard(company, calls, [], 14, NOW);
    const roi = computeRoiSnapshot(company, d, calls, NOW);
    expect(roi.protectedCad).toBe(1200);
    expect(roi.protectedDeclaredCad).toBe(700);
    expect(roi.protectedEstimatedCad).toBe(500);
    expect(roi.wouldBeLostCount).toBe(2);
    expect(roi.atRiskCount).toBe(1);
    expect(roi.enCallsCount).toBe(1);
    expect(roi.planPriceCad).toBeGreaterThan(0);
    expect(roi.multiple).toBe(Math.round((1200 / roi.planPriceCad) * 10) / 10);
  });
});

describe("computeDashboard", () => {
  it("ignore les brouillons in_progress dans les agrégats métier", () => {
    const done = call({ id: "done", minutesAgo: 30, status: "completed", durationSec: 120 });
    const draft = call({
      id: "draft",
      minutesAgo: 5,
      status: "in_progress",
      durationSec: 300,
      provenance: { provider: "twilio", externalId: "CA_DRAFT", checkpointAt: NOW.toISOString() },
    });

    const d = computeDashboard(company, [done, draft], [], 14, NOW);

    expect(d.callsTotal).toBe(1);
    expect(d.answeredByAi).toBe(1);
    expect(d.avgDurationSec).toBe(120);
    expect(d.recentCalls.map((c) => c.id)).toEqual(["done"]);
    expect(d.byDay.reduce((sum, day) => sum + day.total, 0)).toBe(1);
  });
});
