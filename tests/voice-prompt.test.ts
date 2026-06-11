/**
 * Le prompt système de l'agente temps réel est un GARDE-FOU, pas de la prose :
 * chaque règle produit (divulgation IA, interdits, transfert, consentement de
 * rappel ADR-015) doit être présente et vérifiable.
 */
import { describe, expect, it } from "vitest";
import { buildRealtimePrompt, speakablePhone } from "@/services/voice-prompt";
import { SEED_AGENTS, SEED_COMPANIES } from "@/data/companies";
import { getScriptById } from "@/data/industry-scripts";

const company = SEED_COMPANIES[0];
const agent = SEED_AGENTS.find((a) => a.companyId === company.id)!;
const script = getScriptById(agent.qualificationScriptId)!;
const prompt = buildRealtimePrompt({ company, agent, script });

describe("speakablePhone", () => {
  it("formate un numéro nord-américain pour la voix, refuse le reste", () => {
    expect(speakablePhone("+18194211269")).toBe("819 421-1269");
    expect(speakablePhone("819-421-1269")).toBe("819 421-1269");
    expect(speakablePhone("anonymous")).toBeNull();
    expect(speakablePhone("inconnu")).toBeNull();
    expect(speakablePhone(undefined)).toBeNull();
  });
});

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

  it("personnalité : empathie avant procédure, répondre aux questions, présence vocale QC", () => {
    expect(prompt).toContain("L'ÉMOTION AVANT LA PROCÉDURE");
    expect(prompt).toContain("RÉPONDS AUX QUESTIONS");
    expect(prompt).toContain("sourire dans la voix");
  });

  it("avec le numéro de l'afficheur : CONFIRMER le numéro, jamais le faire dicter", () => {
    const withCaller = buildRealtimePrompt({ company, agent, script, callerNumber: "+18194211269" });
    expect(withCaller).toContain("819 421-1269");
    expect(withCaller).toContain("NE lui demande JAMAIS de dicter son numéro");
    // Sans afficheur exploitable : pas de section, on fait dicter normalement.
    expect(buildRealtimePrompt({ company, agent, script, callerNumber: "anonymous" })).not.toContain("afficheur");
    expect(prompt).not.toContain("afficheur");
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
