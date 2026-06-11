/**
 * Le prompt système de l'agente temps réel est un GARDE-FOU, pas de la prose :
 * chaque règle produit (divulgation IA, interdits, transfert, consentement de
 * rappel ADR-015) doit être présente et vérifiable.
 */
import { describe, expect, it } from "vitest";
import { buildRealtimePrompt } from "@/services/voice-prompt";
import { SEED_AGENTS, SEED_COMPANIES } from "@/data/companies";
import { getScriptById } from "@/data/industry-scripts";

const company = SEED_COMPANIES[0];
const agent = SEED_AGENTS.find((a) => a.companyId === company.id)!;
const script = getScriptById(agent.qualificationScriptId)!;
const prompt = buildRealtimePrompt({ company, agent, script });

describe("buildRealtimePrompt", () => {
  it("est déterministe", () => {
    expect(buildRealtimePrompt({ company, agent, script })).toBe(prompt);
  });

  it("divulgue que l'agente est une IA (non négociable)", () => {
    expect(prompt).toContain("assistante virtuelle (IA)");
    expect(prompt).toContain("jamais te faire passer pour un humain");
  });

  it("porte l'identité réelle : agente, entreprise, ville, numéro de transfert", () => {
    expect(prompt).toContain(agent.displayName);
    expect(prompt).toContain(company.name);
    expect(prompt).toContain(company.city);
    expect(prompt).toContain(company.transferPhone);
  });

  it("contient les accueils FR et EN du script et le bilinguisme", () => {
    expect(prompt).toContain("français québécois");
    expect(prompt).toContain("bascule IMMÉDIATEMENT en anglais");
    expect(prompt).toContain(script.greetingEn.replace(/\{company\}/g, company.name).replace(/\{agent\}/g, agent.displayName));
  });

  it("liste chaque question de qualification avec son statut requis/optionnel", () => {
    for (const q of script.questions) {
      expect(prompt).toContain(q.question);
    }
    expect(prompt).toContain("(requis)");
  });

  it("inclut les critères d'urgence et le fast-track critique", () => {
    expect(prompt).toContain("dégât d'eau");
    expect(prompt).toContain("fast-track");
  });

  it("rend le transfert humain non négociable", () => {
    expect(prompt).toContain("transfert IMMÉDIAT");
  });

  it("liste les phrases interdites et les règles de sécurité", () => {
    for (const f of script.forbiddenPhrases.slice(0, 3)) {
      expect(prompt).toContain(f);
    }
    expect(prompt).toContain("carte de crédit");
  });

  it("exige le consentement de rappel avec réponse verbatim (ADR-015)", () => {
    expect(prompt).toContain("Consentement de rappel");
    expect(prompt).toContain("êtes-vous d'accord qu'on vous rappelle");
    expect(prompt).toContain("réponse EXACTE");
  });

  it("bascule la consigne de consentement en anglais pour une entreprise anglophone", () => {
    const en = buildRealtimePrompt({ company: { ...company, defaultLanguage: "en" }, agent, script });
    expect(en).toContain("are you okay with us calling or texting you back");
  });
});
