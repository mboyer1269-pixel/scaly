/**
 * Industry Packs — profils métiers : les 3 packs initiaux (concessionnaire,
 * dentaire, PME générale), repli sans crash, prudence, relance annulation,
 * injection dans le prompt temps réel SANS toucher aux industries sans pack.
 */
import { describe, expect, it } from "vitest";
import {
  GENERAL_PACK,
  INDUSTRY_PACKS,
  PACK_CONCESSIONNAIRE,
  PACK_DENTAIRE,
  PACK_PME,
  findIndustryPack,
  getIndustryPack,
} from "@/data/industry-packs";
import { getScriptById, getScriptByIndustry } from "@/data/industry-scripts";
import { SEED_AGENTS, SEED_COMPANIES } from "@/data/companies";
import { INDUSTRY_LABELS } from "@/domain/company";
import { buildRealtimePrompt } from "@/services/voice-prompt";

function promptFor(companyId: string): string {
  const company = SEED_COMPANIES.find((c) => c.id === companyId);
  const agent = SEED_AGENTS.find((a) => a.companyId === companyId);
  if (!company || !agent) throw new Error(`Seed manquant : ${companyId}`);
  const script = getScriptById(agent.qualificationScriptId);
  if (!script) throw new Error(`Script manquant : ${agent.qualificationScriptId}`);
  return buildRealtimePrompt({ company, agent, script });
}

describe("Industry Packs — structure", () => {
  it("expose les 3 packs initiaux : concessionnaire, dentaire, PME générale", () => {
    expect(INDUSTRY_PACKS.map((p) => p.id)).toEqual(["pack_concessionnaire", "pack_dentaire", "pack_pme"]);
    expect(PACK_CONCESSIONNAIRE.industry).toBe("concessionnaire_auto");
    expect(PACK_DENTAIRE.industry).toBe("dentiste");
    expect(PACK_PME.industry).toBe("services_professionnels");
  });

  it("chaque pack est complet : description, intentions, routage, prudence, exemples, add-ons, rôles", () => {
    for (const pack of INDUSTRY_PACKS) {
      expect(pack.shortDescription.length, pack.id).toBeGreaterThan(20);
      expect(pack.frequentIntents.length, pack.id).toBeGreaterThanOrEqual(3);
      expect(pack.transferRouting.length, pack.id).toBeGreaterThanOrEqual(1);
      expect(pack.cautionPhrases.length, pack.id).toBeGreaterThanOrEqual(2);
      expect(pack.sampleAnswers.length, pack.id).toBeGreaterThanOrEqual(1);
      expect(pack.addOns.length, pack.id).toBeGreaterThanOrEqual(1);
      expect(pack.teamRoles.length, pack.id).toBeGreaterThanOrEqual(2);
      for (const intent of pack.frequentIntents) {
        expect(intent.label, pack.id).toBeTruthy();
        expect(intent.example, pack.id).toBeTruthy();
      }
    }
  });

  it("le scriptId de chaque pack résout vers un IndustryScript existant", () => {
    for (const pack of INDUSTRY_PACKS) {
      expect(getScriptById(pack.scriptId), pack.id).toBeDefined();
    }
  });

  it("les add-ons annoncés « inclus » et « à venir » sont distingués honnêtement", () => {
    for (const pack of INDUSTRY_PACKS) {
      const statuses = new Set(pack.addOns.map((a) => a.status));
      expect(statuses.has("inclus"), pack.id).toBe(true); // le socle P3 est réellement livré
      for (const addOn of pack.addOns) expect(["inclus", "add_on", "a_venir"]).toContain(addOn.status);
    }
  });
});

describe("Industry Packs — repli et robustesse", () => {
  it("industrie inconnue → pack PME générale, jamais de crash", () => {
    expect(getIndustryPack("metier_inconnu")).toBe(GENERAL_PACK);
    expect(getIndustryPack("")).toBe(GENERAL_PACK);
  });

  it("findIndustryPack est STRICT : undefined pour une industrie sans pack dédié", () => {
    expect(findIndustryPack("restaurant")).toBeUndefined();
    expect(findIndustryPack("services_domicile")).toBeUndefined();
  });

  it("toutes les industries du produit résolvent un pack via le repli", () => {
    for (const industry of Object.keys(INDUSTRY_LABELS)) {
      expect(() => getIndustryPack(industry)).not.toThrow();
      expect(getIndustryPack(industry).id).toBeTruthy();
    }
  });
});

describe("Pack concessionnaire — le vertical auto", () => {
  it("couvre ventes, service (statut), pièces et financement", () => {
    const labels = PACK_CONCESSIONNAIRE.frequentIntents.map((i) => i.label.toLowerCase()).join(" | ");
    expect(labels).toMatch(/inventaire|véhicule/);
    expect(labels).toMatch(/service/);
    expect(labels).toMatch(/pièces/);
    expect(labels).toMatch(/financement/);
    const departments = PACK_CONCESSIONNAIRE.transferRouting.map((r) => r.department);
    expect(departments).toEqual(expect.arrayContaining(["Ventes", "Service", "Pièces", "Financement"]));
  });

  it("prudence : la disponibilité d'inventaire est toujours à faire confirmer", () => {
    expect(PACK_CONCESSIONNAIRE.cautionPhrases.join(" ")).toMatch(/selon les informations disponibles/i);
    expect(PACK_CONCESSIONNAIRE.cautionPhrases.join(" ")).toMatch(/disponibilité/i);
  });

  it("le script concessionnaire existe et interdit taux et garanties d'inventaire", () => {
    const script = getScriptByIndustry("concessionnaire_auto");
    expect(script.id).toBe("script_concessionnaire");
    expect(script.questions.some((q) => q.fieldKey === "vehicule")).toBe(true);
    expect(script.forbiddenPhrases.join(" ")).toMatch(/taux de financement/i);
    expect(script.forbiddenPhrases.join(" ")).toMatch(/disponibilité d'un véhicule/i);
  });
});

describe("Pack dentaire — relance annulation", () => {
  it("le mode relance est actif : replacer d'abord, liste de relance ensuite", () => {
    const c = PACK_DENTAIRE.cancellation;
    expect(c.enabled).toBe(true);
    expect(c.offerReschedule).toBe(true);
    expect(c.offerRecallList).toBe(true);
  });

  it("le consentement de relance est capté VERBATIM et le refus est final", () => {
    const rules = PACK_DENTAIRE.cancellation.promptRules.join(" ");
    expect(rules).toMatch(/réponse EXACTE/);
    expect(rules).toMatch(/refus.*FINAL/i);
  });

  it("le gabarit SMS de plage libérée offre le désabonnement STOP", () => {
    for (const pack of INDUSTRY_PACKS.filter((p) => p.cancellation.enabled)) {
      expect(pack.cancellation.freedSlotSmsTemplate, pack.id).toMatch(/STOP/);
    }
  });

  it("prudence : jamais de diagnostic ni d'avis médical", () => {
    expect(PACK_DENTAIRE.cautionPhrases.join(" ")).toMatch(/diagnostic|avis médical/i);
  });
});

describe("Prompt temps réel — injection du pack", () => {
  it("concessionnaire : départements + prudence métier injectés", () => {
    const prompt = promptFor("comp_horizon");
    expect(prompt).toContain("# Départements (routage métier)");
    expect(prompt).toContain("Financement");
    expect(prompt).toContain("# Prudence métier");
    expect(prompt).toMatch(/selon les informations disponibles/i);
  });

  it("dentaire : mode relance annulation injecté avec consentement verbatim", () => {
    const prompt = promptFor("comp_sourire");
    expect(prompt).toContain("# Annulation de rendez-vous — mode relance");
    expect(prompt).toMatch(/réponse EXACTE/);
    expect(prompt).toContain("liste de relance");
  });

  it("industrie SANS pack (plomberie) : prompt inchangé, aucune section pack", () => {
    const prompt = promptFor("comp_belair");
    expect(prompt).not.toContain("# Départements (routage métier)");
    expect(prompt).not.toContain("# Prudence métier");
    expect(prompt).not.toContain("mode relance");
  });

  it("pack: null désactive explicitement l'injection", () => {
    const company = SEED_COMPANIES.find((c) => c.id === "comp_sourire")!;
    const agent = SEED_AGENTS.find((a) => a.companyId === "comp_sourire")!;
    const script = getScriptById(agent.qualificationScriptId)!;
    const prompt = buildRealtimePrompt({ company, agent, script, pack: null });
    expect(prompt).not.toContain("mode relance");
  });
});
