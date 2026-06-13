import { describe, expect, it } from "vitest";
import { buildCallerMemory } from "@/services/caller-memory";
import type { Call } from "@/domain/call";

/** Fabrique un Call minimal pour les tests — seuls les champs pertinents sont renseignés. */
function makeCall(overrides: Partial<Call> & { startedAt: string }): Call {
  return {
    id: `call-${Math.random()}`,
    companyId: "test-co",
    direction: "inbound",
    status: "completed",
    source: "live",
    fromNumber: "+18194211269",
    language: "fr",
    durationSec: 60,
    transcript: [],
    recordingUrl: null,
    intelligence: undefined,
    ...overrides,
  };
}

describe("buildCallerMemory", () => {
  it("retourne undefined pour un tableau vide", () => {
    expect(buildCallerMemory([])).toBeUndefined();
  });

  it("construit un dossier minimal avec un seul appel sans intelligence", () => {
    const call = makeCall({ startedAt: "2026-06-10T14:00:00.000Z" });
    const mem = buildCallerMemory([call]);
    expect(mem).toBeDefined();
    expect(mem!.callCount).toBe(1);
    expect(mem!.firstCallAt).toBe("2026-06-10");
    expect(mem!.lastCallAt).toBe("2026-06-10");
    expect(mem!.phoneConfirmed).toBe(true);
    expect(mem!.name).toBeUndefined();
    expect(mem!.address).toBeUndefined();
    expect(mem!.hasPendingFollowUp).toBe(false);
    expect(mem!.confirmedFields).toEqual({});
    expect(mem!.recentCalls).toHaveLength(1);
    expect(mem!.recentCalls[0].intent).toBe("autre");
  });

  it("préfère callerName sur collectedFields.nom", () => {
    const call = makeCall({
      startedAt: "2026-06-10T14:00:00.000Z",
      callerName: "Jean Tremblay",
      intelligence: { engine: "llm", summary: "x", intent: "question_info", intentConfidence: 1, sentiment: "neutre", urgency: "normale", leadQuality: "tiede", estimatedValueCad: 0, valueBasis: "aucun", nextAction: "aucune", tags: [], commercialScore: 0, confidence: 1, finalStatus: "resolu_par_ia", collectedFields: { nom: "J. Tremblay" } },
    });
    const mem = buildCallerMemory([call]);
    expect(mem!.name).toBe("Jean Tremblay");
  });

  it("trie du plus récent au plus ancien — lastCallAt et firstCallAt corrects", () => {
    const calls = [
      makeCall({ startedAt: "2026-06-07T10:00:00.000Z" }),
      makeCall({ startedAt: "2026-06-10T14:00:00.000Z" }),
      makeCall({ startedAt: "2026-06-01T08:00:00.000Z" }),
    ];
    const mem = buildCallerMemory(calls);
    expect(mem!.callCount).toBe(3);
    expect(mem!.lastCallAt).toBe("2026-06-10");
    expect(mem!.firstCallAt).toBe("2026-06-01");
    expect(mem!.recentCalls[0].date).toBe("2026-06-10");
    expect(mem!.recentCalls[2].date).toBe("2026-06-01");
  });

  it("les confirmedFields les plus récents écrasent les anciens en cas de conflit", () => {
    const old = makeCall({
      startedAt: "2026-06-01T08:00:00.000Z",
      intelligence: { engine: "rules-v1", summary: "x", intent: "question_info", intentConfidence: 1, sentiment: "neutre", urgency: "normale", leadQuality: "tiede", estimatedValueCad: 0, valueBasis: "aucun", nextAction: "aucune", tags: [], commercialScore: 0, confidence: 1, finalStatus: "resolu_par_ia", collectedFields: { adresse: "123 vieille rue" } },
    });
    const recent = makeCall({
      startedAt: "2026-06-10T14:00:00.000Z",
      intelligence: { engine: "rules-v1", summary: "x", intent: "question_info", intentConfidence: 1, sentiment: "neutre", urgency: "normale", leadQuality: "tiede", estimatedValueCad: 0, valueBasis: "aucun", nextAction: "aucune", tags: [], commercialScore: 0, confidence: 1, finalStatus: "resolu_par_ia", collectedFields: { adresse: "456 nouvelle avenue" } },
    });
    const mem = buildCallerMemory([old, recent]);
    expect(mem!.confirmedFields.adresse).toBe("456 nouvelle avenue");
  });

  it("hasPendingFollowUp si au moins un appel a finalStatus suivi_requis", () => {
    const resolved = makeCall({
      startedAt: "2026-06-07T10:00:00.000Z",
      intelligence: { engine: "rules-v1", summary: "x", intent: "question_info", intentConfidence: 1, sentiment: "neutre", urgency: "normale", leadQuality: "tiede", estimatedValueCad: 0, valueBasis: "aucun", nextAction: "aucune", tags: [], commercialScore: 0, confidence: 1, finalStatus: "resolu_par_ia", collectedFields: {} },
    });
    const pending = makeCall({
      startedAt: "2026-06-10T14:00:00.000Z",
      intelligence: { engine: "rules-v1", summary: "Soumission toiture demandée.", intent: "demande_soumission", intentConfidence: 1, sentiment: "positif", urgency: "normale", leadQuality: "chaud", estimatedValueCad: 5000, valueBasis: "bareme_industrie", nextAction: "envoyer_soumission", tags: [], commercialScore: 80, confidence: 0.9, finalStatus: "suivi_requis", collectedFields: {} },
    });
    const mem = buildCallerMemory([resolved, pending]);
    expect(mem!.hasPendingFollowUp).toBe(true);
    expect(mem!.recentCalls[0].hasPendingFollowUp).toBe(true);
    expect(mem!.recentCalls[1].hasPendingFollowUp).toBe(false);
  });

  it("limite recentCalls à 5 même avec plus d'appels", () => {
    const calls = Array.from({ length: 8 }, (_, i) =>
      makeCall({ startedAt: `2026-06-${String(i + 1).padStart(2, "0")}T10:00:00.000Z` }),
    );
    const mem = buildCallerMemory(calls);
    expect(mem!.recentCalls).toHaveLength(5);
    expect(mem!.callCount).toBe(8);
  });

  it("tronque le summary à 150 chars", () => {
    const longSummary = "A".repeat(200);
    const call = makeCall({
      startedAt: "2026-06-10T14:00:00.000Z",
      intelligence: { engine: "rules-v1", summary: longSummary, intent: "question_info", intentConfidence: 1, sentiment: "neutre", urgency: "normale", leadQuality: "tiede", estimatedValueCad: 0, valueBasis: "aucun", nextAction: "aucune", tags: [], commercialScore: 0, confidence: 1, finalStatus: "resolu_par_ia", collectedFields: {} },
    });
    const mem = buildCallerMemory([call]);
    expect(mem!.recentCalls[0].summary).toHaveLength(151); // 150 + "…"
    expect(mem!.recentCalls[0].summary?.endsWith("…")).toBe(true);
  });

  it("ignore les valeurs vides dans confirmedFields", () => {
    const call = makeCall({
      startedAt: "2026-06-10T14:00:00.000Z",
      intelligence: { engine: "rules-v1", summary: "x", intent: "question_info", intentConfidence: 1, sentiment: "neutre", urgency: "normale", leadQuality: "tiede", estimatedValueCad: 0, valueBasis: "aucun", nextAction: "aucune", tags: [], commercialScore: 0, confidence: 1, finalStatus: "resolu_par_ia", collectedFields: { nom: "Jean Tremblay", adresse: "", description: "   " } },
    });
    const mem = buildCallerMemory([call]);
    expect(mem!.confirmedFields.nom).toBe("Jean Tremblay");
    expect(mem!.confirmedFields.adresse).toBeUndefined();
    expect(mem!.confirmedFields.description).toBeUndefined();
  });
});
