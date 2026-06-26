import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Call } from "@/domain/call";
import { SEED_AGENTS, SEED_COMPANIES } from "@/data/companies";
import { getPersonaById } from "@/data/personas";
import { getScriptById, getScriptByIndustry } from "@/data/industry-scripts";
import { intelligenceEngine } from "@/services/intelligence";
import { simulateCall } from "@/services/simulator";
import { InMemoryStore } from "@/server/store";
import { isJsonObject } from "@/lib/request-body";
import { resolveCompanySimulationScript } from "@/services/simulation-policy";
import { actionBelongsToCompany, canExecuteLiveActions } from "@/services/action-execution-policy";
import { canSaveVoiceLabSessionForTenant } from "@/services/voice-lab-security";

const company = SEED_COMPANIES[0];
const agent = SEED_AGENTS[0];
const homeScript = getScriptByIndustry(company.industry);

describe("QA regressions — data integrity and safety", () => {
  it("rejects primitive and array request bodies before they can corrupt a record", () => {
    expect(isJsonObject("hello")).toBe(false);
    expect(isJsonObject(["hello"])).toBe(false);
    expect(isJsonObject(null)).toBe(false);
    expect(isJsonObject({ name: "Plomberie Bélair" })).toBe(true);
  });

  it("locks the simulator to the current company's configured script", () => {
    expect(resolveCompanySimulationScript(company, agent, undefined).id).toBe(agent.qualificationScriptId);
    expect(() => resolveCompanySimulationScript(company, agent, "script_garage")).toThrow(/configuré/i);
  });

  it("uses the saved agent greeting in deterministic simulations", () => {
    const persona = getPersonaById("persona_regulier");
    if (!persona) throw new Error("persona manquant");
    const customAgent = {
      ...agent,
      greetingScript: "TEST ACCUEIL {company} PAR {agent}",
    };
    const result = simulateCall({
      company,
      agent: customAgent,
      script: homeScript,
      persona,
      seed: 901001,
      at: new Date("2026-06-08T10:00:00"),
    });

    expect(result.call.transcript[0]?.text).toBe("TEST ACCUEIL Plomberie Bélair PAR Maude");
  });

  it("does not infer a critical emergency from a later pricing objection", () => {
    const garage = getScriptById("script_garage");
    if (!garage) throw new Error("script garage manquant");
    const call: Call = {
      id: "call_pricing_objection",
      companyId: company.id,
      direction: "inbound",
      status: "completed",
      source: "simulator",
      fromNumber: "514-555-0101",
      language: "fr",
      startedAt: "2026-06-25T12:00:00.000Z",
      durationSec: 60,
      scriptId: garage.id,
      transcript: [
        { speaker: "caller", text: "J'entends un bruit dans la suspension.", atMs: 0, lang: "fr" },
        { speaker: "caller", text: "C'est combien pour des freins ?", atMs: 1000, lang: "fr" },
      ],
      recordingUrl: null,
    };

    const result = intelligenceEngine.analyze(call, garage, {
      collectedFields: {
        description: "un bruit dans la suspension",
        nom: "Alex",
        telephone: "514-555-0101",
        vehicule: "Honda Civic 2020",
        moment: "la semaine prochaine",
      },
    });

    expect(result.urgency).toBe("normale");
    expect(result.intent).toBe("prise_rdv");
  });

  it("replaces linked actions when the same deterministic call is replayed", async () => {
    const persona = getPersonaById("persona_urgence");
    if (!persona) throw new Error("persona manquant");
    const store = new InMemoryStore();
    const input = {
      company,
      agent,
      script: homeScript,
      persona,
      seed: 901002,
      at: new Date("2026-06-08T10:00:00"),
    };
    const first = simulateCall(input);
    const second = simulateCall(input);

    await store.addCall(first.call, first.actions);
    await store.addCall(second.call, second.actions);

    expect(await store.listActions(company.id, first.call.id)).toHaveLength(second.actions.length);
  });

  it("fails closed for live external actions", () => {
    expect(canExecuteLiveActions({ provider: "memory", persistent: false, description: "demo" }, "true")).toBe(false);
    expect(canExecuteLiveActions({ provider: "prisma", persistent: true, description: "postgres" }, undefined)).toBe(false);
    expect(canExecuteLiveActions({ provider: "prisma", persistent: true, description: "postgres" }, "true")).toBe(true);
    expect(actionBelongsToCompany({ companyId: "comp_a" }, "comp_a")).toBe(true);
    expect(actionBelongsToCompany({ companyId: "comp_b" }, "comp_a")).toBe(false);
  });

  it("blocks forged Voice Lab sessions from being saved into another tenant", () => {
    expect(canSaveVoiceLabSessionForTenant("comp_a", "comp_a", "owner")).toBe(true);
    expect(canSaveVoiceLabSessionForTenant("comp_b", "comp_a", "owner")).toBe(false);
    expect(canSaveVoiceLabSessionForTenant("comp_b", "comp_a", "founder")).toBe(true);
  });
});

describe("QA regressions — customer surfaces", () => {
  it("keeps the Allô Maude marketing route public when Clerk is enabled", () => {
    const source = readFileSync(resolve(process.cwd(), "src/middleware.ts"), "utf8");
    expect(source).toContain('"/allo-maude(.*)"');
  });

  it("provides a dedicated mobile navigation instead of forcing the desktop sidebar", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/Sidebar.tsx"), "utf8");
    expect(source).toContain("md:hidden");
    expect(source).toContain("hidden");
    expect(source).toContain("md:flex");
  });
});
