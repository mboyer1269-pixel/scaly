import { describe, expect, it } from "vitest";
import { buildCallerMemory, selectCallerHistory } from "@/services/caller-memory";
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

describe("selectCallerHistory — les deux gardes contre la fuite de mémoire", () => {
  const history = [
    makeCall({ id: "a", companyId: "comp_a", fromNumber: "+18194211269", startedAt: "2026-06-10T14:00:00.000Z" }),
    makeCall({ id: "b", companyId: "comp_a", fromNumber: "819-421-1269", startedAt: "2026-06-08T14:00:00.000Z" }),
    makeCall({ id: "c", companyId: "comp_b", fromNumber: "+18194211269", startedAt: "2026-06-09T14:00:00.000Z" }),
    makeCall({ id: "d", companyId: "comp_a", fromNumber: "+15145550000", startedAt: "2026-06-07T14:00:00.000Z" }),
  ];

  it("numéro inconnu (jamais vu) → aucun historique → aucune mémoire", () => {
    expect(selectCallerHistory(history, "comp_a", "+14180000000")).toEqual([]);
    expect(buildCallerMemory(selectCallerHistory(history, "comp_a", "+14180000000"))).toBeUndefined();
  });

  it("numéro masqué / anonyme / non canonique → AUCUNE mémoire injectée", () => {
    for (const masked of ["anonymous", "inconnu", "", "+1819", "Restricted"]) {
      expect(selectCallerHistory(history, "comp_a", masked)).toEqual([]);
      expect(buildCallerMemory(selectCallerHistory(history, "comp_a", masked))).toBeUndefined();
    }
  });

  it("numéro connu → seulement les appels de CE numéro, toutes notations confondues", () => {
    const got = selectCallerHistory(history, "comp_a", "+18194211269");
    expect(got.map((c) => c.id).sort()).toEqual(["a", "b"]); // pas "d" (autre numéro)
  });

  it("ANTI-CROISEMENT TENANT : un appel du même numéro chez comp_b n'entre jamais chez comp_a", () => {
    const got = selectCallerHistory(history, "comp_a", "+18194211269");
    expect(got.some((c) => c.id === "c")).toBe(false);
    // Le dossier de comp_a ne compte que ses 2 appels — jamais celui de comp_b.
    expect(buildCallerMemory(got)!.callCount).toBe(2);
  });
});
