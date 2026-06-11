import { afterEach, describe, expect, it } from "vitest";
import type { Call, CallIntelligence } from "@/domain/call";
import type { ScalyAction } from "@/domain/action";
import { SEED_COMPANIES } from "@/data/companies";
import { answerOwnerKeyword, buildDailyDigest, parseOwnerKeyword } from "@/services/digest";
import { hasCallbackConsent, planQuoteFollowUps, FOLLOW_UP_AFTER_DAYS } from "@/services/follow-up";
import { isWithinContactHours } from "@/lib/contact-hours";
import { executeActionLive } from "@/services/action-engine";

const company = SEED_COMPANIES[0];
const NOW = new Date("2026-06-11T16:00:00-04:00"); // jeudi 16 h, heure du Québec

function intel(over: Partial<CallIntelligence> = {}): CallIntelligence {
  return {
    engine: "rules-v1", summary: "fixture", intent: "demande_soumission", intentConfidence: 0.9,
    sentiment: "neutre", urgency: "normale", leadQuality: "tiede", estimatedValueCad: 0,
    valueBasis: "bareme_industrie", nextAction: "rappeler_immediatement", tags: [],
    commercialScore: 50, confidence: 0.9, finalStatus: "suivi_requis", collectedFields: {},
    ...over,
  };
}

function call(over: Partial<Call> & { hoursAgo: number }): Call {
  const { hoursAgo, ...rest } = over;
  return {
    id: rest.id ?? `call_${hoursAgo}`, companyId: company.id, direction: "inbound",
    status: "completed", source: "simulator", fromNumber: "514-555-0000", language: "fr",
    startedAt: new Date(NOW.getTime() - hoursAgo * 3600_000).toISOString(),
    durationSec: 60, transcript: [], recordingUrl: null,
    ...rest,
  };
}

describe("buildDailyDigest", () => {
  it("compte chauds, mécontents, sauvés et à-sauver du JOUR avec les montants", () => {
    const calls: Call[] = [
      call({ id: "chaud", hoursAgo: 2, intelligence: intel({ leadQuality: "chaud", estimatedValueCad: 900 }) }),
      call({ id: "fache", hoursAgo: 3, intelligence: intel({ intent: "plainte", finalStatus: "suivi_requis" }) }),
      call({ id: "sauve", hoursAgo: 4, intelligence: intel({ saved: { reason: "hors_heures" }, estimatedValueCad: 450 }) }),
      call({ id: "manque", hoursAgo: 1, status: "missed", intelligence: undefined }),
      call({ id: "hier", hoursAgo: 30, intelligence: intel({ leadQuality: "chaud", estimatedValueCad: 5000 }) }), // PAS aujourd'hui
    ];
    const d = buildDailyDigest(company, calls, [], NOW);
    expect(d.hotCount).toBe(1);
    expect(d.hotValueCad).toBe(900);
    expect(d.unhappyCount).toBe(1);
    expect(d.savedCount).toBe(1);
    expect(d.rescueCount).toBe(1);
    expect(d.smsText).toContain("1 client chaud");
    expect(d.smsText).toContain("900");
    expect(d.smsText).toContain("Répondez CHAUDS");
    // 3 segments SMS max — un pouls reste un pouls.
    expect(d.smsText.length).toBeLessThan(480);
  });
});

describe("parseOwnerKeyword — tolérant aux accents et variantes", () => {
  it.each([
    ["chauds", "CHAUDS"], ["CHAUD", "CHAUDS"], ["Mécontents", "MECONTENTS"], ["mecontent", "MECONTENTS"],
    ["à sauver", "A_SAUVER"], ["A SAUVER", "A_SAUVER"], ["sauver", "A_SAUVER"],
    ["résumé", "RESUME"], ["resume", "RESUME"], ["pouls", "RESUME"],
    ["aide", "AIDE"], ["n'importe quoi", "AIDE"], ["", "AIDE"],
  ])("« %s » → %s", (input, expected) => {
    expect(parseOwnerKeyword(input)).toBe(expected);
  });
});

describe("answerOwnerKeyword", () => {
  const calls = [
    call({ id: "c1", hoursAgo: 2, callerName: "Martin Leblanc", intelligence: intel({ leadQuality: "chaud", estimatedValueCad: 900, summary: "Robinet qui coule" }) }),
  ];

  it("CHAUDS liste les leads avec valeur et numéro de rappel", () => {
    const a = answerOwnerKeyword("CHAUDS", company, calls, [], NOW);
    expect(a).toContain("Martin Leblanc");
    expect(a).toContain("900");
    expect(a).toContain("514-555-0000");
  });

  it("MECONTENTS vide → réponse rassurante, jamais de silence", () => {
    expect(answerOwnerKeyword("MECONTENTS", company, calls, [], NOW)).toContain("Aucun");
  });

  it("AIDE explique les mots-clés", () => {
    expect(answerOwnerKeyword("AIDE", company, [], [], NOW)).toContain("CHAUDS");
  });
});

describe("suivi de soumission J+2 (ADR-015 — consentement obligatoire)", () => {
  const consented = call({
    id: "ok", hoursAgo: (FOLLOW_UP_AFTER_DAYS + 1) * 24, callerName: "Luc",
    intelligence: intel({ collectedFields: { consentement_rappel: "Oui, pas de problème" } }),
  });

  it("détecte le consentement capté en appel", () => {
    expect(hasCallbackConsent(consented)).toBe(true);
    expect(hasCallbackConsent(call({ id: "x", hoursAgo: 1, intelligence: intel() }))).toBe(false);
    const refused = call({ id: "r", hoursAgo: 1, intelligence: intel({ collectedFields: { consentement_rappel: "Non merci" } }) });
    expect(hasCallbackConsent(refused)).toBe(false);
  });

  it("SANS consentement : aucune relance, même si tout le reste est dû", () => {
    const due = call({ id: "due", hoursAgo: (FOLLOW_UP_AFTER_DAYS + 1) * 24, intelligence: intel() });
    expect(planQuoteFollowUps(company, [due], [], NOW)).toHaveLength(0);
  });

  it("AVEC consentement : un suivi SMS planifié, heures CRTC respectées, jamais en double", () => {
    const planned = planQuoteFollowUps(company, [consented], [], NOW);
    expect(planned).toHaveLength(1);
    expect(planned[0].type).toBe("send_sms");
    expect(planned[0].payload.respectContactHours).toBe(true);
    expect(String(planned[0].payload.body)).toContain("Vous aviez accepté");
    // Re-passage du cron : le suivi existant bloque le doublon.
    expect(planQuoteFollowUps(company, [consented], planned, NOW)).toHaveLength(0);
  });

  it("trop récent (< J+2) : pas encore de relance", () => {
    const fresh = call({ id: "f", hoursAgo: 12, intelligence: intel({ collectedFields: { consentement_rappel: "oui" } }) });
    expect(planQuoteFollowUps(company, [fresh], [], NOW)).toHaveLength(0);
  });
});

describe("heures de contact CRTC (America/Toronto)", () => {
  it.each([
    ["2026-06-11T14:00:00-04:00", true],  // jeudi 14 h
    ["2026-06-11T08:30:00-04:00", false], // jeudi 8 h 30 — trop tôt
    ["2026-06-11T21:45:00-04:00", false], // jeudi 21 h 45 — trop tard
    ["2026-06-13T11:00:00-04:00", true],  // samedi 11 h
    ["2026-06-13T18:30:00-04:00", false], // samedi 18 h 30 — trop tard
  ])("%s → %s", (iso, expected) => {
    expect(isWithinContactHours(new Date(iso))).toBe(expected);
  });
});

describe("executeActionLive sans Twilio configuré", () => {
  const saved: Record<string, string | undefined> = {};
  const VARS = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"];

  afterEach(() => {
    for (const v of VARS) {
      if (saved[v] === undefined) delete process.env[v];
      else process.env[v] = saved[v];
    }
  });

  it("retombe sur le mock honnête (jamais de faux « SMS réel »)", async () => {
    for (const v of VARS) {
      saved[v] = process.env[v];
      delete process.env[v];
    }
    const action: ScalyAction = {
      id: "act_t", companyId: company.id, type: "send_sms", title: "Test",
      payload: { to: "514-555-0000", body: "test" }, status: "pending", attempts: 0,
      executor: "mock", createdAt: NOW.toISOString(), audit: [],
    };
    const result = await executeActionLive(action);
    expect(result.status).toBe("succeeded");
    expect(result.audit.some((e) => e.event === "exécutée (mock)")).toBe(true);
    expect(result.audit.some((e) => e.event.includes("RÉELLE"))).toBe(false);
  });
});
