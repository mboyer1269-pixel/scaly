/**
 * Agent Operating Backend v1 (ADR-021) — tests utiles, pas tests théâtre.
 *
 * Les 7 garanties du contrat :
 *  1. Allô Maude résout vers un runtime plan complet.
 *  2. Un agent dentaire drafté propose cancellation recovery.
 *  3. Un agent concessionnaire drafté propose service/appointment recovery.
 *  4. Un agent courtier propose lead follow-up + missed call rescue.
 *  5. Le readiness score baisse si Twilio ou transferPhone manquent.
 *  6. Aucun agent ne peut déclarer une capability inconnue.
 *  7. Les métriques ROI sont toujours explicites, jamais magiques.
 */
import { describe, expect, it } from "vitest";
import type { Company } from "@/domain/company";
import type { AgentDefinition } from "@/domain/agent-definition";
import { AgentDefinitionError, REQUIRED_BACKEND_BINDINGS } from "@/domain/agent-definition";
import { CapabilityUnknownError, type CapabilityId } from "@/domain/capability";
import { RUNTIME_EVENT_TYPES } from "@/domain/runtime-event";
import { CAPABILITY_REGISTRY } from "@/data/capabilities";
import { SEED_COMPANIES } from "@/data/companies";
import { AGENT_DEFINITIONS, ALLO_MAUDE_AGENT, validateAgentDefinition } from "@/data/agent-definitions";
import { resolveAgentRuntimePlan } from "@/services/agent-runtime-plan";
import { DEMO_PROMPTS, draftAgentDefinitionFromPrompt } from "@/services/agent-draft";

const COMPANY: Company = SEED_COMPANIES[0]; // Plomberie Bélair — Twilio + transferPhone présents

const FULL_ENV = { twilioCredentialsConfigured: true, openaiConfigured: true, realtimeBridgeConfigured: true };

describe("1. Allô Maude résout vers un runtime plan complet", () => {
  const plan = resolveAgentRuntimePlan(ALLO_MAUDE_AGENT, COMPANY, FULL_ENV);

  it("active toutes les capabilities sur le tenant seed correctement configuré", () => {
    expect(plan.enabledCapabilities).toEqual(ALLO_MAUDE_AGENT.capabilities);
    expect(plan.verdict).toBe("operational");
    expect(plan.readinessScore).toBe(100);
    expect(plan.missingConfiguration).toEqual([]);
  });

  it("expose le contexte requis et des événements émis valides", () => {
    expect(plan.requiredContext).toEqual(ALLO_MAUDE_AGENT.contextNeeds.map((n) => n.id));
    expect(plan.emittedEvents.length).toBeGreaterThan(0);
    for (const event of plan.emittedEvents) expect(RUNTIME_EVENT_TYPES).toContain(event);
  });

  it("chaque capability du plan porte une raison dicible au client", () => {
    for (const item of plan.capabilities) expect(item.reason.trim().length).toBeGreaterThan(10);
  });
});

describe("2-4. Prompt → agent draft par verticale", () => {
  it("dentaire propose cancellation recovery (appointment_gap_recovery)", () => {
    const draft = draftAgentDefinitionFromPrompt("Réceptionniste IA pour clinique dentaire");
    expect(draft.matchedVertical).toBe("dentiste");
    expect(draft.definition.capabilities).toContain("appointment_gap_recovery");
    expect(draft.definition.status).toBe("draft");
  });

  it("concessionnaire propose service status / appointment recovery", () => {
    const draft = draftAgentDefinitionFromPrompt("Agent de service pour concessionnaire");
    expect(draft.matchedVertical).toBe("concessionnaire_auto");
    expect(draft.definition.capabilities).toContain("appointment_gap_recovery");
    expect(draft.definition.capabilities).toContain("opportunity_detection");
    // Le statut RÉEL des véhicules vit dans le DMS — le risque doit être déclaré.
    expect(draft.risks.join(" ")).toMatch(/DMS/);
  });

  it("courtier propose lead follow-up + missed call rescue", () => {
    const draft = draftAgentDefinitionFromPrompt("Assistant de relance pour courtier immobilier");
    expect(draft.matchedVertical).toBe("courtier_immobilier");
    expect(draft.definition.capabilities).toContain("quote_follow_up");
    expect(draft.definition.capabilities).toContain("missed_call_rescue");
  });

  it("chaque draft de démo est complet : risques, données, ROI, première démo, honnêteté", () => {
    for (const prompt of DEMO_PROMPTS) {
      const draft = draftAgentDefinitionFromPrompt(prompt);
      expect(draft.risks.length).toBeGreaterThan(0);
      expect(draft.requiredData.length).toBeGreaterThan(0);
      expect(draft.roiMetrics.length).toBeGreaterThan(0);
      expect(draft.firstDemo).toMatch(/\//); // pointe vers une surface réelle du produit
      expect(draft.honesty).toMatch(/déterministe/);
    }
  });

  it("prompt inconnu → repli PME générique validé, jamais un crash", () => {
    const draft = draftAgentDefinitionFromPrompt("Bot mystère pour fleuriste spatial");
    expect(draft.matchedVertical).toBe("generic");
    expect(draft.definition.capabilities).toContain("human_handoff");
  });

  it("est déterministe : même prompt, même draft", () => {
    const a = draftAgentDefinitionFromPrompt(DEMO_PROMPTS[0]);
    const b = draftAgentDefinitionFromPrompt(DEMO_PROMPTS[0]);
    expect(a).toEqual(b);
  });
});

describe("5. Le readiness score baisse quand la configuration manque", () => {
  const fullScore = resolveAgentRuntimePlan(ALLO_MAUDE_AGENT, COMPANY, FULL_ENV).readinessScore;

  it("sans numéro Twilio : score plus bas, verdict not_ready, manque explicite", () => {
    const plan = resolveAgentRuntimePlan(ALLO_MAUDE_AGENT, { ...COMPANY, twilioPhoneNumber: undefined }, FULL_ENV);
    expect(plan.readinessScore).toBeLessThan(fullScore);
    expect(plan.verdict).toBe("not_ready");
    expect(plan.missingConfiguration).toContain("Company.twilioPhoneNumber");
    expect(plan.enabledCapabilities).not.toContain("missed_call_rescue");
  });

  it("sans transferPhone : le transfert humain est bloquant — pas de repli, pas d'agent", () => {
    const plan = resolveAgentRuntimePlan(ALLO_MAUDE_AGENT, { ...COMPANY, transferPhone: "" }, FULL_ENV);
    expect(plan.readinessScore).toBeLessThan(fullScore);
    expect(plan.verdict).toBe("not_ready");
    expect(plan.missingConfiguration).toContain("Company.transferPhone");
    expect(plan.enabledCapabilities).not.toContain("human_handoff");
  });

  it("environnement non vérifié → dégradé, jamais « ça va marcher »", () => {
    const plan = resolveAgentRuntimePlan(ALLO_MAUDE_AGENT, COMPANY, {});
    expect(plan.verdict).toBe("degraded");
    expect(plan.readinessScore).toBeLessThan(fullScore);
  });
});

describe("6. Aucun agent ne peut déclarer une capability inconnue", () => {
  it("validateAgentDefinition jette CapabilityUnknownError — échec propre", () => {
    const bogus: AgentDefinition = {
      ...ALLO_MAUDE_AGENT,
      id: "bogus",
      capabilities: [...ALLO_MAUDE_AGENT.capabilities, "teleportation" as CapabilityId],
    };
    expect(() => validateAgentDefinition(bogus)).toThrow(CapabilityUnknownError);
  });

  it("tout agent du registre ne référence que des capabilities du registre", () => {
    for (const def of Object.values(AGENT_DEFINITIONS)) {
      for (const id of def.capabilities) expect(CAPABILITY_REGISTRY[id]).toBeDefined();
    }
  });

  it("les runtimeEvents déclarés par les capabilities existent tous à la frontière ADR-020", () => {
    for (const cap of Object.values(CAPABILITY_REGISTRY)) {
      for (const event of cap.runtimeEvents) expect(RUNTIME_EVENT_TYPES).toContain(event);
    }
  });
});

describe("7. Les métriques ROI sont explicites, jamais magiques", () => {
  it("chaque métrique de chaque agent (et des drafts) porte méthode + base", () => {
    const all = [
      ...Object.values(AGENT_DEFINITIONS),
      ...DEMO_PROMPTS.map((p) => draftAgentDefinitionFromPrompt(p).definition),
    ];
    for (const def of all) {
      expect(def.roiMetrics.length).toBeGreaterThan(0);
      for (const metric of def.roiMetrics) {
        expect(metric.method.trim().length).toBeGreaterThan(20);
        expect(["measured", "estimated_baseline"]).toContain(metric.basis);
      }
    }
  });

  it("une métrique sans méthode fait échouer la validation", () => {
    const bogus: AgentDefinition = {
      ...ALLO_MAUDE_AGENT,
      id: "bogus-roi",
      roiMetrics: [{ id: "magic", label: "Magie", unit: "cad", method: "  ", basis: "measured" }],
    };
    expect(() => validateAgentDefinition(bogus)).toThrow(AgentDefinitionError);
  });

  it("une action non tracée fait échouer la validation — pas d'action fantôme", () => {
    const bogus: AgentDefinition = {
      ...ALLO_MAUDE_AGENT,
      id: "bogus-action",
      actionTargets: [{ id: "ghost", description: "SMS invisible", executedBy: "twilio_sms", tracedBy: [] }],
    };
    expect(() => validateAgentDefinition(bogus)).toThrow(AgentDefinitionError);
  });

  it("les ports backend sont obligatoires — pas de prompt sans contrat backend", () => {
    const bogus: AgentDefinition = {
      ...ALLO_MAUDE_AGENT,
      id: "bogus-ports",
      backendBindings: { ...REQUIRED_BACKEND_BINDINGS, actionLedger: "" as never },
    };
    expect(() => validateAgentDefinition(bogus)).toThrow(AgentDefinitionError);
  });
});
