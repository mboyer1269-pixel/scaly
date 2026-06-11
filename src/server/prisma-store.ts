/**
 * PrismaStore — implémentation Postgres du ScalyRepository.
 * Mêmes contrats que l'InMemoryStore (src/server/store.ts) ; les mappers
 * domaine ↔ lignes Prisma sont exportés pour être réutilisés par prisma/seed.ts.
 */
import { Prisma } from "@prisma/client";
import type {
  Company as CompanyRow,
  VoiceAgent as VoiceAgentRow,
  Call as CallRow,
  Action as ActionRow,
} from "@prisma/client";
import type { Call, CallIntelligence, TranscriptTurn } from "@/domain/call";
import type { AuditEntry, ScalyAction } from "@/domain/action";
import type { BusinessHours, Company, CompliancePolicy, EscalationRule, FollowUpPreferences, LanguageCode } from "@/domain/company";
import type { VoiceAgentConfig, VoiceProfile } from "@/domain/agent";
import type { ComplianceAuditEntry, LiveCheck, ScalyRepository, StoreInfo } from "./store";
import { prisma } from "./prisma";

// ---------------------------------------------------------------------------
// Mappers domaine ↔ base
// ---------------------------------------------------------------------------

const asJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

export function companyToDb(c: Company): Prisma.CompanyCreateInput {
  return {
    id: c.id,
    name: c.name,
    industry: c.industry,
    sectorLabel: c.sectorLabel,
    ownerName: c.ownerName,
    ownerEmail: c.ownerEmail,
    mainPhone: c.mainPhone,
    transferPhone: c.transferPhone,
    city: c.city,
    languages: c.languages,
    defaultLanguage: c.defaultLanguage,
    tone: c.tone,
    hours: asJson(c.hours),
    escalationRules: asJson(c.escalationRules),
    essentialQuestions: c.essentialQuestions,
    services: c.services,
    serviceAreas: c.serviceAreas,
    policies: c.policies,
    followUp: asJson(c.followUp),
    compliance: asJson(c.compliance),
    planId: c.planId,
    createdAt: new Date(c.createdAt),
  };
}

export function companyFromDb(row: CompanyRow): Company {
  return {
    id: row.id,
    name: row.name,
    industry: row.industry as Company["industry"],
    sectorLabel: row.sectorLabel,
    ownerName: row.ownerName,
    ownerEmail: row.ownerEmail,
    mainPhone: row.mainPhone,
    transferPhone: row.transferPhone,
    city: row.city,
    languages: row.languages as LanguageCode[],
    defaultLanguage: row.defaultLanguage as LanguageCode,
    tone: row.tone as Company["tone"],
    hours: row.hours as unknown as BusinessHours,
    escalationRules: row.escalationRules as unknown as EscalationRule[],
    essentialQuestions: row.essentialQuestions,
    services: row.services,
    serviceAreas: row.serviceAreas,
    policies: row.policies,
    followUp: row.followUp as unknown as FollowUpPreferences,
    compliance: row.compliance as unknown as CompliancePolicy,
    planId: row.planId as Company["planId"],
    createdAt: row.createdAt.toISOString(),
  };
}

export function agentToDb(a: VoiceAgentConfig): Prisma.VoiceAgentCreateManyInput {
  return {
    id: a.id,
    companyId: a.companyId,
    displayName: a.displayName,
    persona: a.persona,
    style: a.style,
    languages: a.languages,
    greetingScript: a.greetingScript,
    closingScript: a.closingScript,
    qualificationScriptId: a.qualificationScriptId,
    allowedPhrases: a.allowedPhrases,
    forbiddenPhrases: a.forbiddenPhrases,
    safetyRules: a.safetyRules,
    answerLimits: a.answerLimits,
    transferPolicy: a.transferPolicy,
    voiceProfile: asJson(a.voiceProfile),
  };
}

export function agentFromDb(row: VoiceAgentRow): VoiceAgentConfig {
  return {
    id: row.id,
    companyId: row.companyId,
    displayName: row.displayName,
    persona: row.persona,
    style: row.style,
    languages: row.languages as LanguageCode[],
    greetingScript: row.greetingScript,
    closingScript: row.closingScript,
    qualificationScriptId: row.qualificationScriptId,
    allowedPhrases: row.allowedPhrases,
    forbiddenPhrases: row.forbiddenPhrases,
    safetyRules: row.safetyRules,
    answerLimits: row.answerLimits,
    transferPolicy: row.transferPolicy,
    voiceProfile: row.voiceProfile as unknown as VoiceProfile,
  };
}

export function callToDb(c: Call): Prisma.CallCreateManyInput {
  return {
    id: c.id,
    companyId: c.companyId,
    direction: c.direction,
    status: c.status,
    source: c.source,
    fromNumber: c.fromNumber,
    callerName: c.callerName ?? null,
    language: c.language,
    startedAt: new Date(c.startedAt),
    durationSec: c.durationSec,
    scriptId: c.scriptId ?? null,
    personaId: c.personaId ?? null,
    seed: c.seed ?? null,
    transcript: asJson(c.transcript),
    intelligence: c.intelligence ? asJson(c.intelligence) : Prisma.JsonNull,
    recordingUrl: c.recordingUrl,
  };
}

export function callFromDb(row: CallRow): Call {
  return {
    id: row.id,
    companyId: row.companyId,
    direction: row.direction as Call["direction"],
    status: row.status as Call["status"],
    source: row.source as Call["source"],
    fromNumber: row.fromNumber,
    callerName: row.callerName ?? undefined,
    language: row.language as LanguageCode,
    startedAt: row.startedAt.toISOString(),
    durationSec: row.durationSec,
    scriptId: row.scriptId ?? undefined,
    personaId: row.personaId ?? undefined,
    seed: row.seed ?? undefined,
    transcript: row.transcript as unknown as TranscriptTurn[],
    intelligence: (row.intelligence as unknown as CallIntelligence | null) ?? undefined,
    recordingUrl: null,
  };
}

export function actionToDb(a: ScalyAction): Prisma.ActionCreateManyInput {
  return {
    id: a.id,
    companyId: a.companyId,
    callId: a.callId ?? null,
    type: a.type,
    title: a.title,
    payload: asJson(a.payload),
    status: a.status,
    attempts: a.attempts,
    lastError: a.lastError ?? null,
    executor: a.executor,
    executedAt: a.executedAt ? new Date(a.executedAt) : null,
    createdAt: new Date(a.createdAt),
    audit: asJson(a.audit),
  };
}

export function actionFromDb(row: ActionRow): ScalyAction {
  return {
    id: row.id,
    companyId: row.companyId,
    callId: row.callId ?? undefined,
    type: row.type as ScalyAction["type"],
    title: row.title,
    payload: row.payload as unknown as Record<string, unknown>,
    status: row.status as ScalyAction["status"],
    attempts: row.attempts,
    lastError: row.lastError ?? undefined,
    executor: row.executor as ScalyAction["executor"],
    executedAt: row.executedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    audit: row.audit as unknown as AuditEntry[],
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export class PrismaStore implements ScalyRepository {
  info(): StoreInfo {
    return {
      provider: "prisma",
      persistent: true,
      description: "Postgres via Prisma — données durables (STORE_PROVIDER=prisma)",
    };
  }

  async verifyLive(): Promise<LiveCheck> {
    const started = Date.now();
    const verifiedAt = new Date().toISOString();
    try {
      // Preuve écriture + relecture + suppression d'une sentinelle, puis comptages.
      const sentinelId = `livecheck_${started.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      await prisma.auditLog.create({ data: { id: sentinelId, actor: "system", event: "live_check" } });
      const readBack = await prisma.auditLog.findUnique({ where: { id: sentinelId } });
      await prisma.auditLog.delete({ where: { id: sentinelId } });
      const [companies, calls] = await Promise.all([prisma.company.count(), prisma.call.count()]);
      const latencyMs = Date.now() - started;
      if (!readBack) {
        return { ok: false, provider: "prisma", latencyMs, detail: "Écriture acceptée mais relecture impossible", verifiedAt };
      }
      return {
        ok: true,
        provider: "prisma",
        latencyMs,
        detail: `Écriture + relecture + suppression OK · ${companies} entreprises, ${calls} appels en base`,
        verifiedAt,
      };
    } catch (err) {
      return {
        ok: false,
        provider: "prisma",
        latencyMs: Date.now() - started,
        detail: err instanceof Error ? err.message : String(err),
        verifiedAt,
      };
    }
  }

  async listCompanies(): Promise<Company[]> {
    const rows = await prisma.company.findMany({ orderBy: { name: "asc" } });
    return rows.map(companyFromDb);
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const row = await prisma.company.findUnique({ where: { id } });
    return row ? companyFromDb(row) : undefined;
  }

  async updateCompany(id: string, patch: Partial<Company>): Promise<Company | undefined> {
    const existing = await this.getCompany(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch, id: existing.id };
    await prisma.company.update({ where: { id }, data: companyToDb(updated) });
    await this.recordAudit({ companyId: id, actor: "ui", event: "config_entreprise_modifiée", detail: Object.keys(patch).join(", ") });
    return updated;
  }

  async getAgentByCompany(companyId: string): Promise<VoiceAgentConfig | undefined> {
    const row = await prisma.voiceAgent.findFirst({ where: { companyId } });
    return row ? agentFromDb(row) : undefined;
  }

  async updateAgent(companyId: string, patch: Partial<VoiceAgentConfig>): Promise<VoiceAgentConfig | undefined> {
    const existing = await this.getAgentByCompany(companyId);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch, id: existing.id, companyId: existing.companyId };
    await prisma.voiceAgent.update({ where: { id: existing.id }, data: agentToDb(updated) });
    await this.recordAudit({ companyId, actor: "ui", event: "agent_vocal_modifié", detail: Object.keys(patch).join(", ") });
    return updated;
  }

  async listCalls(companyId?: string): Promise<Call[]> {
    const rows = await prisma.call.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { startedAt: "desc" },
    });
    return rows.map(callFromDb);
  }

  async getCall(id: string): Promise<Call | undefined> {
    const row = await prisma.call.findUnique({ where: { id } });
    return row ? callFromDb(row) : undefined;
  }

  async addCall(call: Call, actions: ScalyAction[]): Promise<void> {
    await prisma.$transaction([
      prisma.call.create({ data: callToDb(call) }),
      ...(actions.length ? [prisma.action.createMany({ data: actions.map(actionToDb) })] : []),
    ]);
    await this.recordAudit({ companyId: call.companyId, actor: "simulateur", event: "appel_ajouté", detail: call.id });
  }

  async listActions(companyId?: string, callId?: string): Promise<ScalyAction[]> {
    const rows = await prisma.action.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(callId ? { callId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(actionFromDb);
  }

  async getAction(id: string): Promise<ScalyAction | undefined> {
    const row = await prisma.action.findUnique({ where: { id } });
    return row ? actionFromDb(row) : undefined;
  }

  async saveAction(action: ScalyAction): Promise<ScalyAction> {
    const data = actionToDb(action);
    await prisma.action.upsert({ where: { id: action.id }, create: data, update: data });
    return action;
  }

  async getAuditLog(limit = 50): Promise<ComplianceAuditEntry[]> {
    const rows = await prisma.auditLog.findMany({ orderBy: { at: "desc" }, take: limit });
    return rows.map((r) => ({
      at: r.at.toISOString(),
      companyId: r.companyId ?? undefined,
      actor: r.actor,
      event: r.event,
      detail: r.detail ?? undefined,
    }));
  }

  async recordAudit(entry: Omit<ComplianceAuditEntry, "at">): Promise<void> {
    await prisma.auditLog.create({
      data: {
        companyId: entry.companyId ?? null,
        actor: entry.actor,
        event: entry.event,
        detail: entry.detail ?? null,
      },
    });
  }
}
