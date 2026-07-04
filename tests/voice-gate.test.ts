/**
 * Guardrails Voice Gate + naming vitrine (démonstrateur).
 * - La vitrine héro parle AU NOM DE MAUDE chez AutoHorizon, avec l'accueil
 *   verrouillé. Sophie, « assistante virtuelle », « AutoHorizon, bonjour » et
 *   « intelligence artificielle » ne doivent JAMAIS réapparaître dans ce qui est
 *   affiché/entendu par un prospect (le seed moteur, lui, reste Sophie — intact).
 * - Le Voice Gate compare des voix sur un script identique, honnêtement.
 * 100 % offline : données + lecture de fichiers locaux.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  VOICE_GATE_CANDIDATES,
  VOICE_GATE_DISCLOSURE,
  VOICE_GATE_SCRIPT,
} from "@/data/voice-gate";
import { HERO_OPENING_LINE, getPackDemoScenarioById } from "@/data/pack-demo-scenarios";
import { buildPackDemoReport } from "@/services/pack-demo";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const stripBlockComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "");

const BANNED_NAMING = ["sophie", "assistante virtuelle", "assistant virtuel", "intelligence artificielle", "auto horizon, bonjour", "autohorizon, bonjour"];

describe("naming vitrine — démonstrateur Maude / AutoHorizon", () => {
  it("l'accueil verrouillé est cohérent entre Voice Gate et vitrine (pas de dérive)", () => {
    expect(VOICE_GATE_SCRIPT[0].text).toBe(HERO_OPENING_LINE);
    expect(HERO_OPENING_LINE).toContain("AutoHorizon");
    expect(HERO_OPENING_LINE).toContain("Maude");
    const lower = HERO_OPENING_LINE.toLowerCase();
    for (const phrase of ["sophie", "assistante virtuelle", "intelligence artificielle"]) {
      expect(lower).not.toContain(phrase);
    }
  });

  it("le rapport héro (ce qui est affiché/entendu) porte Maude chez AutoHorizon", () => {
    const scenario = getPackDemoScenarioById("demo_concessionnaire")!;
    const r = buildPackDemoReport(scenario);
    expect(r.agentName).toBe("Maude");
    expect(r.companyName).toBe("AutoHorizon");
    // Le premier tour de Maude est exactement l'accueil verrouillé.
    const firstMaude = r.callScript.find((t) => t.speaker === "maude");
    expect(firstMaude?.text).toBe(HERO_OPENING_LINE);
    // Aucun tour affiché/entendu ne contient un terme banni.
    const spoken = r.callScript.map((t) => t.text).join(" ").toLowerCase();
    for (const phrase of BANNED_NAMING) {
      expect(spoken, `terme banni dans la vitrine : « ${phrase} »`).not.toContain(phrase);
    }
  });

  it("le seed moteur reste intact (Sophie) — on n'a pas renommé le golden set", async () => {
    const { SEED_AGENTS } = await import("@/data/companies");
    const horizon = SEED_AGENTS.find((a) => a.companyId === "comp_horizon");
    expect(horizon?.displayName).toBe("Sophie");
  });
});

describe("Voice Gate — honnêteté & structure", () => {
  it("le script comparé est identique pour toutes (on ne compare que la voix)", () => {
    expect(VOICE_GATE_SCRIPT).toHaveLength(3);
    expect(VOICE_GATE_SCRIPT[0].speaker).toBe("maude");
    expect(VOICE_GATE_SCRIPT[1].who).toContain("Éric");
  });

  it("les voix québécoises sont présentes ET générables (forfait payant actif)", () => {
    const qc = VOICE_GATE_CANDIDATES.filter((c) => c.accent.toLowerCase().includes("réel"));
    expect(qc.length).toBeGreaterThan(0);
    for (const c of qc) {
      expect(c.available).toBe(true);
      // Client Éric = voix masculine distincte de Maude (pas la même voix pour les deux).
      if (c.maude.provider === "eleven" && c.caller.provider === "eleven") {
        expect(c.caller.voiceId).not.toBe(c.maude.voiceId);
      }
    }
    // La candidate principale visée existe.
    expect(VOICE_GATE_CANDIDATES.some((c) => c.id === "amelie-qc-v2" && c.available)).toBe(true);
  });

  it("la divulgation Voice Gate nie explicitement un vrai appel (honnête, sans le prétendre)", () => {
    const lower = VOICE_GATE_DISCLOSURE.toLowerCase();
    expect(lower).toContain("ce n'est pas un appel");
    expect(lower).toContain("synthèse");
    // Aucune prétention POSITIVE d'un appel réel.
    for (const claim of ["c'est un vrai appel", "appel client en direct", "appel réel avec un client"]) {
      expect(lower).not.toContain(claim);
    }
  });

  it("la page Voice Gate rend la divulgation et aucun claim trompeur/jargon", () => {
    const visible = stripBlockComments(read("src/app/allo-maude/voice-gate/page.tsx")).toLowerCase();
    expect(visible).toContain("voice_gate_disclosure");
    const banned = ["vrai appel", "appel réel", "appel en direct", "zéro erreur", "garanti", "déterministe", "p95", "champs confirmés"];
    for (const phrase of banned) expect(visible, `interdit : « ${phrase} »`).not.toContain(phrase);
  });
});
