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
  VoiceSession as VoiceSessionRow,
  ReviewItem as ReviewItemRow,
  ReadinessEvidence as ReadinessEvidenceRow,
} from "@prisma/client";
import type { Call, CallIntelligence, TranscriptTurn } from "@/domain/call";
import type { VoiceFieldState, VoiceRuntimeEvent, VoiceRuntimeState, VoiceRuntimeTelemetry, VoiceSessionRecord, VoiceTurn } from "@/domain/voice";
import type { AuditEntry, ScalyAction } from "@/domain/action";
import type { BusinessHours, Company, CompliancePolicy, CoveragePolicy, EscalationRule, FollowUpPreferences, LanguageCode } from "@/domain/company";
import type { ConsentRecord } from "@/domain/consent";
import type { ReadinessEvidence, ReadinessKind } from "@/domain/readiness";
import type { ReviewItem, ReviewStatus } from "@/domain/review";
import { canonicalPhone } from "@/domain/consent";
import type { VoiceAgentConfig, VoiceProfile } from "@/domain/agent";
import type { CompanyDeletionResult, ComplianceAuditEntry, LiveCheck, ScalyRepository, StoreInfo } from "./store";
import { prisma } from "./prisma";

// ---------------------------------------------------------------------------
// Mappers domaine ↔ base
// ---------------------------------------------------------------------------

const asJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

export function companyToDb(c: Company): Prisma.CompanyCreateInput {
  return {
    id: c.id,
    name: c.name,
    businessDescription: c.businessDescription,
    industry: c.industry,
    sectorLabel: c.sectorLabel,
    ownerName: c.ownerName,
    ownerEmail: c.ownerEmail,
    mainPhone: c.mainPhone,
    twilioPhoneNumber: c.twilioPhoneNumber ?? null,
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
    coverage: c.coverage ? asJson(c.coverage) : Prisma.DbNull,
    compliance: asJson(c.compliance),
    planId: c.planId,
    billing: c.billing ? asJson(c.billing) : Prisma.DbNull,
    createdAt: new Date(c.createdAt),
  };
}

export function companyFromDb(row: CompanyRow): Company {
  return {
    id: row.id,
    name: row.name,
    businessDescription: row.businessDescription ?? undefined,
    industry: row.industry as Company["industry"],
    sectorLabel: row.sectorLabel,
    ownerName: row.ownerName,
    ownerEmail: row.ownerEmail,
    mainPhone: row.mainPhone,
    twilioPhoneNumber: row.twilioPhoneNumber ?? undefined,
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
    coverage: row.coverage ? (row.coverage as unknown as CoveragePolicy) : undefined,
    compliance: row.compliance as unknown as CompliancePolicy,
    planId: row.planId as Company["planId"],
    billing: row.billing ? (row.billing as unknown as Company["billing"]) : undefined,
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
    ownerInstructions: a.ownerInstructions ?? [],
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
    ownerInstructions: row.ownerInstructions,
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

export function voiceSessionToDb(r: VoiceSessionRecord): Prisma.VoiceSessionCreateInput {
  return {
    id: r.id,
    companyId: r.companyId,
    scenarioId: r.scenarioId ?? null,
    status: r.status,
    language: r.language,
    startedAt: new Date(r.startedAt),
    endedAt: r.endedAt ? new Date(r.endedAt) : null,
    turns: asJson(r.turns),
    events: asJson(r.events),
    fields: asJson(r.fields),
    telemetry: asJson(r.telemetry),
    callId: r.callId ?? null,
  };
}

export function voiceSessionFromDb(row: VoiceSessionRow): VoiceSessionRecord {
  return {
    id: row.id,
    companyId: row.companyId,
    scenarioId: row.scenarioId ?? undefined,
    status: row.status as VoiceRuntimeState,
    language: row.language as LanguageCode,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString(),
    turns: row.turns as unknown as VoiceTurn[],
    events: row.events as unknown as VoiceRuntimeEvent[],
    fields: row.fields as unknown as VoiceFieldState[],
    telemetry: row.telemetry as unknown as VoiceRuntimeTelemetry,
    callId: row.callId ?? undefined,
  };
}

export function reviewItemFromDb(row: ReviewItemRow): ReviewItem {
  return {
    id: row.id,
    companyId: row.companyId,
    callId: row.callId,
    reason: row.reason as ReviewItem["reason"],
    evidence: row.evidence,
    status: row.status as ReviewStatus,
    resolution: row.resolution ?? undefined,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString(),
  };
}

export function readinessEvidenceFromDb(row: ReadinessEvidenceRow): ReadinessEvidence {
  return {
    id: row.id,
    companyId: row.companyId,
    kind: row.kind as ReadinessKind,
    status: row.status as ReadinessEvidence["status"],
    label: row.label,
    detail: row.detail,
    callId: row.callId ?? undefined,
    externalId: row.externalId ?? undefined,
    verifiedAt: row.verifiedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
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
    const data = callToDb(call);
    await prisma.$transaction([
      prisma.action.deleteMany({ where: { callId: call.id } }),
      prisma.call.upsert({ where: { id: call.id }, create: data, update: data }),
      ...(actions.length ? [prisma.action.createMany({ data: actions.map(actionToDb) })] : []),
    ]);
    await this.recordAudit({ companyId: call.companyId, actor: "simulateur", event: "appel_ajouté", detail: call.id });
  }

  async saveCall(call: Call): Promise<Call> {
    const data = callToDb(call);
    await prisma.call.upsert({ where: { id: call.id }, create: data, update: data });
    return call;
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

  async listConsents(companyId?: string, phone?: string): Promise<ConsentRecord[]> {
    const rows = await prisma.consent.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(phone ? { phone: canonicalPhone(phone) } : {}),
      },
      orderBy: { capturedAt: "desc" },
    });
    return rows.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      phone: r.phone,
      kind: r.kind as ConsentRecord["kind"],
      status: r.status as ConsentRecord["status"],
      verbatim: r.verbatim,
      channel: r.channel as ConsentRecord["channel"],
      sourceCallId: r.sourceCallId ?? undefined,
      capturedAt: r.capturedAt.toISOString(),
      revokedAt: r.revokedAt?.toISOString(),
      revokedVia: r.revokedVia ?? undefined,
    }));
  }

  async saveConsent(record: ConsentRecord): Promise<ConsentRecord> {
    const data = {
      id: record.id,
      companyId: record.companyId,
      phone: record.phone,
      kind: record.kind,
      status: record.status,
      verbatim: record.verbatim,
      channel: record.channel,
      sourceCallId: record.sourceCallId ?? null,
      capturedAt: new Date(record.capturedAt),
      revokedAt: record.revokedAt ? new Date(record.revokedAt) : null,
      revokedVia: record.revokedVia ?? null,
    };
    await prisma.consent.upsert({ where: { id: record.id }, create: data, update: data });
    return record;
  }

  async revokeConsents(companyId: string, phone: string, via: string, now = new Date()): Promise<number> {
    const r = await prisma.consent.updateMany({
      where: { companyId, phone: canonicalPhone(phone), status: { not: "revoque" } },
      data: { status: "revoque", revokedAt: now, revokedVia: via },
    });
    return r.count;
  }

  async saveVoiceSession(record: VoiceSessionRecord): Promise<VoiceSessionRecord> {
    const data = voiceSessionToDb(record);
    await prisma.voiceSession.upsert({ where: { id: record.id }, create: data, update: data });
    await this.recordAudit({ companyId: record.companyId, actor: "voice-lab", event: "session_vocale_sauvegardée", detail: record.id });
    return record;
  }

  async listVoiceSessions(companyId?: string): Promise<VoiceSessionRecord[]> {
    const rows = await prisma.voiceSession.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { startedAt: "desc" },
    });
    return rows.map(voiceSessionFromDb);
  }

  async getVoiceSession(id: string): Promise<VoiceSessionRecord | undefined> {
    const row = await prisma.voiceSession.findUnique({ where: { id } });
    return row ? voiceSessionFromDb(row) : undefined;
  }

  async listReviewItems(companyId: string, status?: ReviewStatus): Promise<ReviewItem[]> {
    const rows = await prisma.reviewItem.findMany({
      where: { companyId, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(reviewItemFromDb);
  }

  async saveReviewItem(item: ReviewItem): Promise<ReviewItem> {
    const data = {
      id: item.id,
      companyId: item.companyId,
      callId: item.callId,
      reason: item.reason,
      evidence: item.evidence,
      status: item.status,
      resolution: item.resolution ?? null,
      createdAt: new Date(item.createdAt),
      resolvedAt: item.resolvedAt ? new Date(item.resolvedAt) : null,
    };
    await prisma.reviewItem.upsert({ where: { id: item.id }, create: data, update: data });
    return item;
  }

  async resolveReviewItem(
    id: string,
    resolution: string,
    status: "resolved" | "ignored" = "resolved",
    now = new Date(),
  ): Promise<ReviewItem | undefined> {
    const existing = await prisma.reviewItem.findUnique({ where: { id } });
    if (!existing) return undefined;
    const row = await prisma.reviewItem.update({
      where: { id },
      data: { status, resolution, resolvedAt: now },
    });
    await this.recordAudit({
      companyId: row.companyId,
      actor: "ui",
      event: "revision_résolue",
      detail: `${row.id}: ${resolution}`,
    });
    return reviewItemFromDb(row);
  }

  async listReadinessEvidence(companyId: string, kind?: ReadinessKind): Promise<ReadinessEvidence[]> {
    const rows = await prisma.readinessEvidence.findMany({
      where: { companyId, ...(kind ? { kind } : {}) },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(readinessEvidenceFromDb);
  }

  async saveReadinessEvidence(evidence: ReadinessEvidence): Promise<ReadinessEvidence> {
    const data = {
      id: evidence.id,
      companyId: evidence.companyId,
      kind: evidence.kind,
      status: evidence.status,
      label: evidence.label,
      detail: evidence.detail,
      callId: evidence.callId ?? null,
      externalId: evidence.externalId ?? null,
      verifiedAt: evidence.verifiedAt ? new Date(evidence.verifiedAt) : null,
      createdAt: new Date(evidence.createdAt),
    };
    await prisma.readinessEvidence.upsert({ where: { id: evidence.id }, create: data, update: data });
    return evidence;
  }

  async deleteCompanyData(companyId: string, _requestedBy: string): Promise<CompanyDeletionResult> {
    const [
      actions,
      calls,
      agents,
      consents,
      voiceSessions,
      reviewItems,
      readinessEvidence,
      usage,
      _auditLog,
      company,
    ] = await prisma.$transaction([
      prisma.action.deleteMany({ where: { companyId } }),
      prisma.call.deleteMany({ where: { companyId } }),
      prisma.voiceAgent.deleteMany({ where: { companyId } }),
      prisma.consent.deleteMany({ where: { companyId } }),
      prisma.voiceSession.deleteMany({ where: { companyId } }),
      prisma.reviewItem.deleteMany({ where: { companyId } }),
      prisma.readinessEvidence.deleteMany({ where: { companyId } }),
      prisma.usagePeriod.deleteMany({ where: { companyId } }),
      prisma.auditLog.updateMany({ where: { companyId }, data: { companyId: null } }),
      prisma.company.deleteMany({ where: { id: companyId } }),
    ]);

    return {
      companyId,
      deleted: {
        company: company.count,
        agents: agents.count,
        calls: calls.count,
        actions: actions.count,
        consents: consents.count,
        voiceSessions: voiceSessions.count,
        reviewItems: reviewItems.count,
        readinessEvidence: readinessEvidence.count,
        usagePeriods: usage.count,
      },
    };
  }

  async purgeExpiredTranscripts(now = new Date()): Promise<{ purged: number; voicePurged: number }> {
    const companies = await this.listCompanies();
    let purged = 0;
    let voicePurged = 0;
    for (const company of companies) {
      const cutoff = new Date(now.getTime() - company.compliance.retentionDays * 86_400_000);
      const res = await prisma.call.updateMany({
        where: {
          companyId: company.id,
          startedAt: { lt: cutoff },
          NOT: { transcript: { equals: [] } },
        },
        data: { transcript: [] },
      });
      const vres = await prisma.voiceSession.updateMany({
        where: {
          companyId: company.id,
          startedAt: { lt: cutoff },
          NOT: { turns: { equals: [] } },
        },
        data: { turns: [], events: [] },
      });
      if (res.count > 0 || vres.count > 0) {
        purged += res.count;
        voicePurged += vres.count;
        await this.recordAudit({
          companyId: company.id,
          actor: "system",
          event: "transcripts_purgés",
          detail: `${res.count} appels, ${vres.count} sessions vocales · rétention ${company.compliance.retentionDays} j`,
        });
      }
    }
    return { purged, voicePurged };
  }
}
