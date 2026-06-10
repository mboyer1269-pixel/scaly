import { describe, expect, it } from "vitest";
import { executeAction, planActionsForCall, planDailyDigest } from "@/services/action-engine";
import { simulateCall } from "@/services/simulator";
import { SEED_AGENTS, SEED_COMPANIES } from "@/data/companies";
import { getPersonaById } from "@/data/personas";
import { getScriptByIndustry } from "@/data/industry-scripts";

const company = SEED_COMPANIES[0];
const agent = SEED_AGENTS[0];
const script = getScriptByIndustry(company.industry);
const at = new Date("2026-06-08T10:00:00");

describe("action engine", () => {
  it("exécute une action mock avec audit trail honnête", () => {
    const digest = planDailyDigest(company, 10, 5000);
    expect(digest.status).toBe("pending");
    const done = executeAction(digest);
    expect(done.status).toBe("succeeded");
    expect(done.audit.length).toBeGreaterThanOrEqual(3);
    expect(done.audit.some((e) => e.event.includes("mock"))).toBe(true);
    expect(done.executedAt).toBeDefined();
  });

  it("bloque honnêtement un exécuteur réel non configuré (requires_config)", () => {
    const action = planDailyDigest(company, 1, 0);
    action.type = "send_sms";
    action.executor = "real";
    const result = executeAction(action);
    expect(result.status).toBe("requires_config");
    expect(result.lastError).toBeTruthy();
  });

  it("ne replanifie pas une action déjà réussie", () => {
    const action = planDailyDigest(company, 1, 0);
    executeAction(action);
    const attempts = action.attempts;
    executeAction(action);
    expect(action.attempts).toBe(attempts);
  });

  it("planifie SMS de rappel pour un appel manqué", () => {
    const persona = getPersonaById("persona_regulier");
    if (!persona) throw new Error("persona manquant");
    const { call } = simulateCall({ company, script, persona, seed: 3, at, agent });
    // Transforme en appel manqué pour tester la règle.
    const missed = { ...call, status: "missed" as const };
    const actions = planActionsForCall(missed, company);
    expect(actions.some((a) => a.type === "send_sms")).toBe(true);
  });
});
