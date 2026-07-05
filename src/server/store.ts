/**
 * Persistance — Repository async + deux implémentations interchangeables :
 *  - InMemoryStore (démo)  : données seedées en mémoire, régénérées à chaque
 *    redémarrage (déterministes grâce aux seeds).
 *  - PrismaStore (réel)    : Postgres via Prisma (src/server/prisma-store.ts),
 *    activé par STORE_PROVIDER=prisma. Schéma : prisma/schema.prisma.
 *
 * L'interface est asynchrone pour que les deux implémentations soient
 * strictement substituables (Prisma est intrinsèquement async).
 */
import type { Call } from "@/domain/call";
import type { ScalyAction } from "@/domain/action";
import type { Company } from "@/domain/company";
import type { ConsentRecord } from "@/domain/consent";
import { canonicalPhone } from "@/domain/consent";
import type { VoiceAgentConfig } from "@/domain/agent";
import type { VoiceSessionRecord } from "@/domain/voice";
import type { ReadinessEvidence, ReadinessKind } from "@/domain/readiness";
import type { ReviewItem, ReviewStatus } from "@/domain/review";
import { getBusinessKnowledgeRepository } from "@/services/business-brain";
import { getOwnerNotificationRepository } from "@/services/owner-notifications";
import { getReviewRequestRepository } from "@/services/review-requests";
import { getGapRecoveryRepository } from "@/services/gap-recovery";
import { buildSeedData } from "./seed";

/** Journal d'audit de conformité (qui a changé quoi, quand). */
export interface ComplianceAuditEntry {
  at: string;
  companyId?: string;
  actor: string;
  event: string;
  detail?: string;
}

export type StoreProvider = "memory" | "prisma";

export interface StoreInfo {
  provider: StoreProvider;
  persistent: boolean;
  description: string;
}

/** Résultat d'une vérification vivante (aller-retour réel vers la persistance). */
export interface LiveCheck {
  ok: boolean;
  provider: StoreProvider;
  latencyMs: number;
  detail: string;
  verifiedAt: string;
}

export interface CompanyDeletionResult {
  companyId: string;
  deleted: {
    company: number;
    agents: number;
    calls: number;
    actions: number;
    consents: number;
    voiceSessions: number;
    reviewItems: number;
    readinessEvidence: number;
    usagePeriods: number;
    businessKnowledge: number;
    ownerNotifications: number;
    reviewRequests: number;
    /** WaitlistEntry + AppointmentGap + RecoveryOffer (remplissage des annulations). */
    gapRecovery: number;
  };
}

export interface ScalyRepository {
  info(): StoreInfo;
  /** Preuve d'aller-retour réel (lecture + écriture). Jamais « vert » par complaisance. */
  verifyLive(): Promise<LiveCheck>;
  listCompanies(): Promise<Company[]>;
  getCompany(id: string): Promise<Company | undefined>;
  updateCompany(id: string, patch: Partial<Company>): Promise<Company | undefined>;
  getAgentByCompany(companyId: string): Promise<VoiceAgentConfig | undefined>;
  updateAgent(companyId: string, patch: Partial<VoiceAgentConfig>): Promise<VoiceAgentConfig | undefined>;
  listCalls(companyId?: string): Promise<Call[]>;
  getCall(id: string): Promise<Call | undefined>;
  /** Retrouve un appel par son identifiant externe (ex. callSid Twilio) pour l'idempotence. */
  findCallByExternalId(companyId: string, externalId: string): Promise<Call | undefined>;
  addCall(call: Call, actions: ScalyAction[]): Promise<void>;
  /** Persiste un appel modifié (ex. ré-analyse LLM, purge de transcript). */
  saveCall(call: Call): Promise<Call>;
  /**
   * Write conditionnel anti-course : écrit l'appel SEULEMENT s'il est absent
   * ou encore `in_progress`. Une finalisation concurrente (/complete, repli,
   * balayeur) gagne TOUJOURS — un flush zombie ne peut jamais écraser un final.
   * Retourne false si le write a été refusé.
   */
  saveCallUnlessFinalized(call: Call): Promise<boolean>;
  listActions(companyId?: string, callId?: string): Promise<ScalyAction[]>;
  getAction(id: string): Promise<ScalyAction | undefined>;
  /** Persiste une action mutée (ex. après executeAction). */
  saveAction(action: ScalyAction): Promise<ScalyAction>;
  getAuditLog(limit?: number): Promise<ComplianceAuditEntry[]>;
  recordAudit(entry: Omit<ComplianceAuditEntry, "at">): Promise<void>;
  /** Coffre de consentements (ADR-018) — par personne, opposable, révocable. */
  listConsents(companyId?: string, phone?: string): Promise<ConsentRecord[]>;
  saveConsent(record: ConsentRecord): Promise<ConsentRecord>;
  /** Révoque TOUS les consentements de ce numéro. Retourne le nombre révoqué. */
  revokeConsents(companyId: string, phone: string, via: string, now?: Date): Promise<number>;
  /** Persiste une session du Voice Lab (upsert — turns/events purgeables Loi 25). */
  saveVoiceSession(record: VoiceSessionRecord): Promise<VoiceSessionRecord>;
  listVoiceSessions(companyId?: string): Promise<VoiceSessionRecord[]>;
  getVoiceSession(id: string): Promise<VoiceSessionRecord | undefined>;
  listReviewItems(companyId: string, status?: ReviewStatus): Promise<ReviewItem[]>;
  saveReviewItem(item: ReviewItem): Promise<ReviewItem>;
  resolveReviewItem(
    id: string,
    resolution: string,
    status?: "resolved" | "ignored",
    now?: Date,
  ): Promise<ReviewItem | undefined>;
  listReadinessEvidence(companyId: string, kind?: ReadinessKind): Promise<ReadinessEvidence[]>;
  saveReadinessEvidence(evidence: ReadinessEvidence): Promise<ReadinessEvidence>;
  /** Suppression de compte demandée par le propriétaire : retire les données opérationnelles et conserve seulement l'audit non tenanté. */
  deleteCompanyData(companyId: string, requestedBy: string): Promise<CompanyDeletionResult>;
  /**
   * Purge Loi 25 : vide les transcripts des appels ET les turns/events des
   * sessions vocales plus vieux que le `compliance.retentionDays` de chaque
   * compagnie (l'intelligence agrégée est conservée, le verbatim est supprimé).
   */
  purgeExpiredTranscripts(now?: Date): Promise<{ purged: number; voicePurged: number }>;
}

/** Exporté pour les tests : instanciation directe, sans passer par l'env (jamais de vraie base en test). */
export class InMemoryStore implements ScalyRepository {
  private companies = new Map<string, Company>();
  private agents = new Map<string, VoiceAgentConfig>(); // clé : companyId
  private calls = new Map<string, Call>();
  private actions = new Map<string, ScalyAction>();
  private voiceSessions = new Map<string, VoiceSessionRecord>();
  private consents = new Map<string, ConsentRecord>();
  private reviewItems = new Map<string, ReviewItem>();
  private readinessEvidence = new Map<string, ReadinessEvidence>();
  private audit: ComplianceAuditEntry[] = [];

  constructor() {
    const seed = buildSeedData();
    for (const c of seed.companies) this.companies.set(c.id, c);
    for (const a of seed.agents) this.agents.set(a.companyId, a);
    for (const c of seed.calls) this.calls.set(c.id, c);
    for (const a of seed.actions) this.actions.set(a.id, a);
    this.audit.push({
      at: new Date().toISOString(),
      actor: "system",
      event: "seed_chargé",
      detail: `${seed.calls.length} appels, ${seed.actions.length} actions (données de démonstration)`,
    });
  }

  info(): StoreInfo {
    return {
      provider: "memory",
      persistent: false,
      description: "In-memory — données de démonstration régénérées à chaque redémarrage",
    };
  }

  async verifyLive(): Promise<LiveCheck> {
    return {
      ok: true,
      provider: "memory",
      latencyMs: 0,
      detail: `Aucune base de données — ${this.calls.size} appels en mémoire de processus`,
      verifiedAt: new Date().toISOString(),
    };
  }

  async listCompanies(): Promise<Company[]> {
    return [...this.companies.values()];
  }

  async getCompany(id: string): Promise<Company | undefined> {
    return this.companies.get(id);
  }

  async updateCompany(id: string, patch: Partial<Company>): Promise<Company | undefined> {
    const existing = this.companies.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch, id: existing.id };
    this.companies.set(id, updated);
    await this.recordAudit({ companyId: id, actor: "ui", event: "config_entreprise_modifiée", detail: Object.keys(patch).join(", ") });
    return updated;
  }

  async getAgentByCompany(companyId: string): Promise<VoiceAgentConfig | undefined> {
    return this.agents.get(companyId);
  }

  async updateAgent(companyId: string, patch: Partial<VoiceAgentConfig>): Promise<VoiceAgentConfig | undefined> {
    const existing = this.agents.get(companyId);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch, id: existing.id, companyId: existing.companyId };
    this.agents.set(companyId, updated);
    await this.recordAudit({ companyId, actor: "ui", event: "agent_vocal_modifié", detail: Object.keys(patch).join(", ") });
    return updated;
  }

  async listCalls(companyId?: string): Promise<Call[]> {
    const all = [...this.calls.values()].filter((c) => !companyId || c.companyId === companyId);
    return all.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  async getCall(id: string): Promise<Call | undefined> {
    return this.calls.get(id);
  }

  async findCallByExternalId(companyId: string, externalId: string): Promise<Call | undefined> {
    return [...this.calls.values()].find(
      (c) => c.companyId === companyId && c.provenance?.externalId === externalId,
    );
  }

  async addCall(call: Call, actions: ScalyAction[]): Promise<void> {
    for (const [id, action] of this.actions) {
      if (action.callId === call.id) this.actions.delete(id);
    }
    this.calls.set(call.id, call);
    for (const a of actions) this.actions.set(a.id, a);
    await this.recordAudit({ companyId: call.companyId, actor: "simulateur", event: "appel_ajouté", detail: call.id });
  }

  async saveCall(call: Call): Promise<Call> {
    this.calls.set(call.id, call);
    return call;
  }

  async saveCallUnlessFinalized(call: Call): Promise<boolean> {
    const existing = this.calls.get(call.id);
    if (existing && existing.status !== "in_progress") return false;
    this.calls.set(call.id, call);
    return true;
  }

  async listActions(companyId?: string, callId?: string): Promise<ScalyAction[]> {
    return [...this.actions.values()]
      .filter((a) => (!companyId || a.companyId === companyId) && (!callId || a.callId === callId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getAction(id: string): Promise<ScalyAction | undefined> {
    return this.actions.get(id);
  }

  async saveAction(action: ScalyAction): Promise<ScalyAction> {
    this.actions.set(action.id, action);
    return action;
  }

  async getAuditLog(limit = 50): Promise<ComplianceAuditEntry[]> {
    return this.audit.slice(-limit).reverse();
  }

  async recordAudit(entry: Omit<ComplianceAuditEntry, "at">): Promise<void> {
    this.audit.push({ ...entry, at: new Date().toISOString() });
  }

  async listConsents(companyId?: string, phone?: string): Promise<ConsentRecord[]> {
    const canon = phone ? canonicalPhone(phone) : undefined;
    return [...this.consents.values()]
      .filter((c) => (!companyId || c.companyId === companyId) && (!canon || c.phone === canon))
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  }

  async saveConsent(record: ConsentRecord): Promise<ConsentRecord> {
    this.consents.set(record.id, record);
    return record;
  }

  async revokeConsents(companyId: string, phone: string, via: string, now = new Date()): Promise<number> {
    const canon = canonicalPhone(phone);
    let revoked = 0;
    for (const c of this.consents.values()) {
      if (c.companyId === companyId && c.phone === canon && c.status !== "revoque") {
        this.consents.set(c.id, { ...c, status: "revoque", revokedAt: now.toISOString(), revokedVia: via });
        revoked += 1;
      }
    }
    return revoked;
  }

  async saveVoiceSession(record: VoiceSessionRecord): Promise<VoiceSessionRecord> {
    this.voiceSessions.set(record.id, record);
    await this.recordAudit({ companyId: record.companyId, actor: "voice-lab", event: "session_vocale_sauvegardée", detail: record.id });
    return record;
  }

  async listVoiceSessions(companyId?: string): Promise<VoiceSessionRecord[]> {
    return [...this.voiceSessions.values()]
      .filter((s) => !companyId || s.companyId === companyId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  async getVoiceSession(id: string): Promise<VoiceSessionRecord | undefined> {
    return this.voiceSessions.get(id);
  }

  async listReviewItems(companyId: string, status?: ReviewStatus): Promise<ReviewItem[]> {
    return [...this.reviewItems.values()]
      .filter((item) => item.companyId === companyId && (!status || item.status === status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async saveReviewItem(item: ReviewItem): Promise<ReviewItem> {
    this.reviewItems.set(item.id, item);
    return item;
  }

  async resolveReviewItem(
    id: string,
    resolution: string,
    status: "resolved" | "ignored" = "resolved",
    now = new Date(),
  ): Promise<ReviewItem | undefined> {
    const existing = this.reviewItems.get(id);
    if (!existing) return undefined;
    const updated: ReviewItem = {
      ...existing,
      status,
      resolution,
      resolvedAt: now.toISOString(),
    };
    this.reviewItems.set(id, updated);
    await this.recordAudit({
      companyId: updated.companyId,
      actor: "ui",
      event: "revision_résolue",
      detail: `${updated.id}: ${resolution}`,
    });
    return updated;
  }

  async listReadinessEvidence(companyId: string, kind?: ReadinessKind): Promise<ReadinessEvidence[]> {
    return [...this.readinessEvidence.values()]
      .filter((evidence) => evidence.companyId === companyId && (!kind || evidence.kind === kind))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async saveReadinessEvidence(evidence: ReadinessEvidence): Promise<ReadinessEvidence> {
    this.readinessEvidence.set(evidence.id, evidence);
    return evidence;
  }

  async deleteCompanyData(companyId: string, _requestedBy: string): Promise<CompanyDeletionResult> {
    const deleted = {
      company: this.companies.delete(companyId) ? 1 : 0,
      agents: this.agents.delete(companyId) ? 1 : 0,
      calls: 0,
      actions: 0,
      consents: 0,
      voiceSessions: 0,
      reviewItems: 0,
      readinessEvidence: 0,
      usagePeriods: 0,
      businessKnowledge: 0,
      ownerNotifications: 0,
      reviewRequests: 0,
      gapRecovery: 0,
    };

    for (const [id, call] of [...this.calls]) {
      if (call.companyId === companyId) {
        this.calls.delete(id);
        deleted.calls += 1;
      }
    }
    for (const [id, action] of [...this.actions]) {
      if (action.companyId === companyId) {
        this.actions.delete(id);
        deleted.actions += 1;
      }
    }
    for (const [id, consent] of [...this.consents]) {
      if (consent.companyId === companyId) {
        this.consents.delete(id);
        deleted.consents += 1;
      }
    }
    for (const [id, session] of [...this.voiceSessions]) {
      if (session.companyId === companyId) {
        this.voiceSessions.delete(id);
        deleted.voiceSessions += 1;
      }
    }
    for (const [id, review] of [...this.reviewItems]) {
      if (review.companyId === companyId) {
        this.reviewItems.delete(id);
        deleted.reviewItems += 1;
      }
    }
    for (const [id, evidence] of [...this.readinessEvidence]) {
      if (evidence.companyId === companyId) {
        this.readinessEvidence.delete(id);
        deleted.readinessEvidence += 1;
      }
    }

    // Moteurs Phase 4 (repos autonomes) — effacement complet (Loi 25).
    deleted.businessKnowledge = await getBusinessKnowledgeRepository().deleteByCompany(companyId);
    deleted.ownerNotifications = await getOwnerNotificationRepository().deleteByCompany(companyId);
    deleted.reviewRequests = await getReviewRequestRepository().deleteByCompany(companyId);
    deleted.gapRecovery = await getGapRecoveryRepository().deleteByCompany(companyId);

    this.audit = this.audit.map((entry) => entry.companyId === companyId ? { ...entry, companyId: undefined } : entry);
    return { companyId, deleted };
  }

  async purgeExpiredTranscripts(now = new Date()): Promise<{ purged: number; voicePurged: number }> {
    let purged = 0;
    let voicePurged = 0;
    for (const company of this.companies.values()) {
      const cutoff = new Date(now.getTime() - company.compliance.retentionDays * 86_400_000);
      for (const call of this.calls.values()) {
        if (call.companyId === company.id && call.transcript.length > 0 && new Date(call.startedAt) < cutoff) {
          this.calls.set(call.id, { ...call, transcript: [] });
          purged += 1;
        }
      }
      for (const vs of this.voiceSessions.values()) {
        if (vs.companyId === company.id && (vs.turns.length > 0 || vs.events.length > 0) && new Date(vs.startedAt) < cutoff) {
          this.voiceSessions.set(vs.id, { ...vs, turns: [], events: [] });
          voicePurged += 1;
        }
      }
      if (purged > 0 || voicePurged > 0) {
        await this.recordAudit({ companyId: company.id, actor: "system", event: "transcripts_purgés", detail: `rétention ${company.compliance.retentionDays} j` });
      }
    }
    return { purged, voicePurged };
  }
}

function createPrismaStore(): ScalyRepository {
  // Charge Prisma uniquement quand STORE_PROVIDER=prisma.
  const { PrismaStore } = require("./prisma-store") as typeof import("./prisma-store");
  return new PrismaStore();
}

/**
 * Singleton (survit au hot-reload Next.js via globalThis).
 * STORE_PROVIDER=prisma → Postgres réel ; sinon démo in-memory.
 */
export function getStore(): ScalyRepository {
  const wanted: StoreProvider = process.env.STORE_PROVIDER === "prisma" ? "prisma" : "memory";
  const g = globalThis as { __scalyStore?: ScalyRepository };
  if (!g.__scalyStore || g.__scalyStore.info().provider !== wanted) {
    g.__scalyStore = wanted === "prisma" ? createPrismaStore() : new InMemoryStore();
  }
  return g.__scalyStore;
}
