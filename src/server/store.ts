/**
 * Persistance — Repository + implémentation in-memory seedée.
 *
 * HONNÊTETÉ : il n'y a PAS de base de données. Les données vivent en mémoire
 * du processus Next.js et sont régénérées à chaque redémarrage (déterministes
 * grâce aux seeds). Le schéma Postgres est PRÉPARÉ dans prisma/schema.prisma ;
 * la migration vers Prisma remplace cette classe sans toucher au reste (P1).
 */
import type { Call } from "@/domain/call";
import type { ScalyAction } from "@/domain/action";
import type { Company } from "@/domain/company";
import type { VoiceAgentConfig } from "@/domain/agent";
import { buildSeedData } from "./seed";

/** Journal d'audit de conformité (qui a changé quoi, quand). */
export interface ComplianceAuditEntry {
  at: string;
  companyId?: string;
  actor: string;
  event: string;
  detail?: string;
}

export interface ScalyRepository {
  listCompanies(): Company[];
  getCompany(id: string): Company | undefined;
  updateCompany(id: string, patch: Partial<Company>): Company | undefined;
  getAgentByCompany(companyId: string): VoiceAgentConfig | undefined;
  updateAgent(companyId: string, patch: Partial<VoiceAgentConfig>): VoiceAgentConfig | undefined;
  listCalls(companyId?: string): Call[];
  getCall(id: string): Call | undefined;
  addCall(call: Call, actions: ScalyAction[]): void;
  listActions(companyId?: string, callId?: string): ScalyAction[];
  getAction(id: string): ScalyAction | undefined;
  getAuditLog(limit?: number): ComplianceAuditEntry[];
  recordAudit(entry: Omit<ComplianceAuditEntry, "at">): void;
}

class InMemoryStore implements ScalyRepository {
  private companies = new Map<string, Company>();
  private agents = new Map<string, VoiceAgentConfig>(); // clé : companyId
  private calls = new Map<string, Call>();
  private actions = new Map<string, ScalyAction>();
  private audit: ComplianceAuditEntry[] = [];

  constructor() {
    const seed = buildSeedData();
    for (const c of seed.companies) this.companies.set(c.id, c);
    for (const a of seed.agents) this.agents.set(a.companyId, a);
    for (const c of seed.calls) this.calls.set(c.id, c);
    for (const a of seed.actions) this.actions.set(a.id, a);
    this.recordAudit({ actor: "system", event: "seed_chargé", detail: `${seed.calls.length} appels, ${seed.actions.length} actions (données de démonstration)` });
  }

  listCompanies(): Company[] {
    return [...this.companies.values()];
  }

  getCompany(id: string): Company | undefined {
    return this.companies.get(id);
  }

  updateCompany(id: string, patch: Partial<Company>): Company | undefined {
    const existing = this.companies.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch, id: existing.id };
    this.companies.set(id, updated);
    this.recordAudit({ companyId: id, actor: "ui", event: "config_entreprise_modifiée", detail: Object.keys(patch).join(", ") });
    return updated;
  }

  getAgentByCompany(companyId: string): VoiceAgentConfig | undefined {
    return this.agents.get(companyId);
  }

  updateAgent(companyId: string, patch: Partial<VoiceAgentConfig>): VoiceAgentConfig | undefined {
    const existing = this.agents.get(companyId);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch, id: existing.id, companyId: existing.companyId };
    this.agents.set(companyId, updated);
    this.recordAudit({ companyId, actor: "ui", event: "agent_vocal_modifié", detail: Object.keys(patch).join(", ") });
    return updated;
  }

  listCalls(companyId?: string): Call[] {
    const all = [...this.calls.values()].filter((c) => !companyId || c.companyId === companyId);
    return all.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  getCall(id: string): Call | undefined {
    return this.calls.get(id);
  }

  addCall(call: Call, actions: ScalyAction[]): void {
    this.calls.set(call.id, call);
    for (const a of actions) this.actions.set(a.id, a);
    this.recordAudit({ companyId: call.companyId, actor: "simulateur", event: "appel_ajouté", detail: call.id });
  }

  listActions(companyId?: string, callId?: string): ScalyAction[] {
    return [...this.actions.values()]
      .filter((a) => (!companyId || a.companyId === companyId) && (!callId || a.callId === callId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getAction(id: string): ScalyAction | undefined {
    return this.actions.get(id);
  }

  getAuditLog(limit = 50): ComplianceAuditEntry[] {
    return this.audit.slice(-limit).reverse();
  }

  recordAudit(entry: Omit<ComplianceAuditEntry, "at">): void {
    this.audit.push({ ...entry, at: new Date().toISOString() });
  }
}

/**
 * Singleton (survit au hot-reload Next.js via globalThis).
 * En P1, `getStore()` retournera une implémentation Prisma — même interface.
 */
export function getStore(): ScalyRepository {
  const g = globalThis as { __scalyStore?: ScalyRepository };
  if (!g.__scalyStore) g.__scalyStore = new InMemoryStore();
  return g.__scalyStore;
}
