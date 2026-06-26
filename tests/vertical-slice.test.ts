import { describe, expect, it } from "vitest";
import { SEED_AGENTS, SEED_COMPANIES } from "@/data/companies";
import { getPersonaById } from "@/data/personas";
import { getScriptByIndustry } from "@/data/industry-scripts";
import { InMemoryStore } from "@/server/store";
import { runSimulationWorkflow } from "@/services/simulation-workflow";

describe("Allô Maude critical water damage vertical slice", () => {
  it("persiste l'appel, les actions, l'audit, la révision et la provenance dans le repository partagé", async () => {
    const store = new InMemoryStore();
    const company = SEED_COMPANIES[0];
    const agent = SEED_AGENTS[0];
    const persona = getPersonaById("persona_urgence");
    if (!persona) throw new Error("persona urgence absente");
    const script = getScriptByIndustry(company.industry);

    const result = await runSimulationWorkflow(store, {
      company,
      agent,
      persona,
      script,
      seed: 0,
      at: new Date("2026-06-25T12:00:00-04:00"),
    });

    expect(result.call.source).toBe("simulator");
    expect(result.call.language).toBe("fr");
    expect(result.call.intelligence?.urgency).toBe("critique");
    expect(result.call.intelligence?.collectedFields.telephone).toBeTruthy();
    expect(result.call.intelligence?.collectedFields.adresse).toBeTruthy();
    expect(result.call.status).toBe("transferred");
    expect(result.actions.some((action) => action.type === "notify_owner")).toBe(true);
    expect(result.actions.some((action) => action.type === "transfer_call")).toBe(true);
    expect(result.reviewItems).toContainEqual(expect.objectContaining({
      callId: result.call.id,
      reason: "low_confidence",
    }));
    expect(result.reality.state).toBe("simulated");
    expect(result.auditRecorded).toBe(true);

    expect(await store.getCall(result.call.id)).toEqual(result.call);
    expect(await store.listActions(company.id, result.call.id)).toHaveLength(result.actions.length);
    expect(await store.listReviewItems(company.id)).toEqual(expect.arrayContaining(result.reviewItems));
    expect((await store.getAuditLog()).some((entry) => entry.detail?.includes(result.call.id))).toBe(true);
  });
});
