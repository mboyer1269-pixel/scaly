import { describe, expect, it } from "vitest";
import { simulateCall } from "@/services/simulator";
import { SEED_AGENTS, SEED_COMPANIES } from "@/data/companies";
import { getPersonaById } from "@/data/personas";
import { getScriptByIndustry } from "@/data/industry-scripts";

const company = SEED_COMPANIES[0];
const agent = SEED_AGENTS[0];
const script = getScriptByIndustry(company.industry);
// Lundi 10 h — pendant les heures d'ouverture.
const at = new Date("2026-06-08T10:00:00");

function run(personaId: string, seed: number) {
  const persona = getPersonaById(personaId);
  if (!persona) throw new Error("persona manquant");
  return simulateCall({ company, script, persona, seed, at, agent });
}

describe("simulateur", () => {
  it("est déterministe : même seed → même conversation et même analyse", () => {
    const a = run("persona_magasineur", 42);
    const b = run("persona_magasineur", 42);
    expect(a.call.transcript.map((t) => t.text)).toEqual(b.call.transcript.map((t) => t.text));
    expect(a.call.intelligence?.commercialScore).toBe(b.call.intelligence?.commercialScore);
    expect(a.call.id).toBe(b.call.id);
  });

  it("varie avec le seed", () => {
    const a = run("persona_magasineur", 1);
    const b = run("persona_magasineur", 2);
    expect(a.call.transcript.map((t) => t.text).join()).not.toBe(b.call.transcript.map((t) => t.text).join());
  });

  it("classe une urgence en critique et avise le propriétaire", () => {
    const { call, actions } = run("persona_urgence", 7);
    expect(call.intelligence?.urgency).toBe("critique");
    expect(actions.some((a) => a.type === "notify_owner")).toBe(true);
    expect(actions.some((a) => a.type === "create_crm_lead")).toBe(true);
  });

  it("neutralise le spam : non qualifié, aucune action", () => {
    const { call, actions } = run("persona_spam", 11);
    expect(call.intelligence?.intent).toBe("spam");
    expect(call.intelligence?.leadQuality).toBe("non_qualifie");
    expect(call.intelligence?.estimatedValueCad).toBe(0);
    expect(actions).toHaveLength(0);
  });

  it("gère la bascule anglophone", () => {
    const { call } = run("persona_anglophone", 21);
    expect(call.language).toBe("en");
    expect(call.transcript.some((t) => t.lang === "en" && t.speaker === "agent")).toBe(true);
    expect(call.intelligence?.tags).toContain("anglais");
  });

  it("marque les appels hors heures comme sauvés", () => {
    const persona = getPersonaById("persona_regulier");
    if (!persona) throw new Error("persona manquant");
    const night = new Date("2026-06-08T22:30:00");
    const { call } = simulateCall({ company, script, persona, seed: 5, at: night, agent });
    expect(call.intelligence?.saved?.reason).toBe("hors_heures");
  });
});
