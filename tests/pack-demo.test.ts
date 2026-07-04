/**
 * Démos par pack — verrouillées en CI.
 * Chaque démo fait tourner le VRAI cerveau vocal (voice-runtime). Toute
 * régression conversationnelle (fiche perdue, transfert manqué, langue mal
 * suivie, budget latence explosé) casse le build — comme les 6 scénarios golden
 * du Voice Lab. C'est la garantie « ne rien briser » de la démo commerciale.
 */
import { describe, expect, it } from "vitest";
import { PACK_DEMO_SCENARIOS, PUBLIC_DISCLOSURE } from "@/data/pack-demo-scenarios";
import { buildAllPackDemoReports, buildPackDemoReport } from "@/services/pack-demo";
import { resolveAudioDemo } from "@/services/pack-demo-audio";
import { checkScenarioExpectations, runVoiceScenario } from "@/services/voice-lab";
import { LATENCY_TARGET_P50_MS, LATENCY_TARGET_P95_MS } from "@/domain/voice";

describe("démos par pack — golden verrouillé", () => {
  for (const scenario of PACK_DEMO_SCENARIOS) {
    it(`${scenario.id} — ${scenario.packLabel} : attentes verrouillées`, () => {
      const check = checkScenarioExpectations(scenario, runVoiceScenario(scenario));
      expect(check.failures, check.failures.join(" ; ")).toEqual([]);
      expect(check.pass).toBe(true);
    });
  }

  it("chaque rapport de démo est présentable et cohérent", () => {
    const reports = buildAllPackDemoReports();
    expect(reports).toHaveLength(PACK_DEMO_SCENARIOS.length);
    for (const r of reports) {
      // Un transcript à deux voix, du contenu.
      expect(r.transcript.length).toBeGreaterThan(2);
      expect(r.transcript.some((t) => t.speaker === "agent")).toBe(true);
      expect(r.transcript.some((t) => t.speaker === "caller")).toBe(true);
      // Une fiche captée avec au moins nom + téléphone.
      expect(r.capturedFields.length).toBeGreaterThanOrEqual(2);
      // Un cadrage revenu réel (hypothèse interne > 0).
      expect(r.revenue.leadValueCad).toBeGreaterThan(0);
      // Efficacité : budget latence respecté, latences déclarées simulées (honnêteté P2A).
      expect(r.efficiency.latencyBudgetMet).toBe(true);
      expect(r.efficiency.perceivedP50Ms).toBeLessThan(LATENCY_TARGET_P50_MS);
      expect(r.efficiency.perceivedP95Ms).toBeLessThan(LATENCY_TARGET_P95_MS);
      expect(r.efficiency.latenciesSimulated).toBe(true);
      // L'appel se termine proprement (jamais bloqué en cours d'état).
      expect(["completed", "failed"]).toContain(r.outcome.status);
      // Chaque démo raconte pourquoi elle compte.
      expect(r.proves.length).toBeGreaterThan(10);
      expect(r.hook.length).toBeGreaterThan(10);
    }
  });

  it("le concessionnaire transfère un lead chaud à un humain, avec raison tracée", () => {
    const r = buildPackDemoReport(PACK_DEMO_SCENARIOS.find((s) => s.id === "demo_concessionnaire")!);
    expect(r.outcome.transferred).toBe(true);
    expect(r.outcome.transferTo).toBeTruthy();
    expect(r.outcome.transferReason && r.outcome.transferReason.length).toBeGreaterThan(0);
  });

  it("le dentaire détecte l'urgence sans jamais transférer ni diagnostiquer", () => {
    const r = buildPackDemoReport(PACK_DEMO_SCENARIOS.find((s) => s.id === "demo_dentaire")!);
    expect(r.urgencyLabel).toBe("Haute");
    expect(r.outcome.transferred).toBe(false);
    expect(r.outcome.status).toBe("completed");
  });

  it("la PME remet une fiche complète : nom, téléphone, adresse, besoin, moment", () => {
    const r = buildPackDemoReport(PACK_DEMO_SCENARIOS.find((s) => s.id === "demo_pme")!);
    const labels = r.capturedFields.map((f) => f.label);
    expect(labels).toContain("Nom de l'appelant");
    expect(labels).toContain("Téléphone");
    expect(labels).toContain("Adresse");
    expect(labels).toContain("Service demandé");
    expect(labels).toContain("Moment souhaité");
  });

  it("les 3 verticales clés sont présentes", () => {
    const ids = PACK_DEMO_SCENARIOS.map((s) => s.id);
    expect(ids).toContain("demo_concessionnaire");
    expect(ids).toContain("demo_dentaire");
    expect(ids).toContain("demo_pme");
  });
});

describe("preuve audio — callScript & manifest (Audio Proof v1)", () => {
  it("chaque scénario expose un callScript exploitable, dérivé du transcript", () => {
    for (const r of buildAllPackDemoReports()) {
      // Un tour audio par tour de transcript — ce qu'on entend = ce que le cerveau fait.
      expect(r.callScript.length).toBe(r.transcript.length);
      r.callScript.forEach((turn, i) => {
        expect(["maude", "caller"]).toContain(turn.speaker);
        expect(turn.text.trim().length).toBeGreaterThan(0);
        expect(turn.voiceHint.length).toBeGreaterThan(0);
        expect(turn.tone.length).toBeGreaterThan(0);
        // Chemin d'asset stable et prévisible : /demo-audio/<scenarioId>/NN-<speaker>.mp3
        expect(turn.audioPath).toBe(`/demo-audio/${r.scenarioId}/${String(i + 1).padStart(2, "0")}-${turn.speaker}.mp3`);
      });
    }
  });

  it("chaque scénario porte la divulgation « simulation » (jamais un vrai appel)", () => {
    for (const s of PACK_DEMO_SCENARIOS) {
      expect(s.disclosureLabel).toBe(PUBLIC_DISCLOSURE);
    }
    expect(PUBLIC_DISCLOSURE.toLowerCase()).toContain("simulation");
    expect(PUBLIC_DISCLOSURE.toLowerCase()).not.toContain("appel réel");
  });

  it("la structure audioDemo se résout proprement, même sans fichiers (fallback sûr, CI offline)", () => {
    for (const r of buildAllPackDemoReports()) {
      const audio = resolveAudioDemo(r);
      expect(["available", "missing", "generated-later"]).toContain(audio.status);
      expect(audio.disclosureLabel).toBe(PUBLIC_DISCLOSURE);
      expect(audio.durationEstimateSec).toBeGreaterThan(0);
      // Jamais de bouton brisé : sans clips disponibles, la liste est vide (état « à générer »).
      if (audio.status !== "available") expect(audio.clips).toEqual([]);
      else expect(audio.clips.length).toBe(r.callScript.length);
    }
  });

  it("aucune promesse marketing non vérifiable dans les données de scénario", () => {
    const banned = ["100 %", "100%", "zéro erreur", "aucune erreur", "vrai appel", "appel client réel", "garanti"];
    for (const s of PACK_DEMO_SCENARIOS) {
      const blob = [s.title, s.hook, s.proves, s.missedCallCost, s.description].join(" ").toLowerCase();
      for (const phrase of banned) expect(blob).not.toContain(phrase.toLowerCase());
    }
  });
});
