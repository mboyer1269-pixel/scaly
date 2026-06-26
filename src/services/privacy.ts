import type { ScalyRepository } from "@/server/store";
import type { Call } from "@/domain/call";
import type { ScalyAction } from "@/domain/action";
import type { Company } from "@/domain/company";
import type { ConsentRecord } from "@/domain/consent";
import type { VoiceAgentConfig } from "@/domain/agent";
import type { VoiceSessionRecord } from "@/domain/voice";
import type { ReviewItem } from "@/domain/review";
import type { ReadinessEvidence, RealityLabel } from "@/domain/readiness";
import { deriveProviderReality } from "./reality";

export interface CompanyPrivacyExport {
  generatedAt: string;
  company: Company;
  agent?: VoiceAgentConfig;
  calls: Call[];
  actions: ScalyAction[];
  consents: ConsentRecord[];
  voiceSessions: VoiceSessionRecord[];
  reviewItems: ReviewItem[];
  readinessEvidence: ReadinessEvidence[];
  realityLabel: RealityLabel;
}

export interface AccountDeletionResult {
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
  };
  auditEvent: "account_data_deleted";
}

export async function buildCompanyPrivacyExport(
  store: ScalyRepository,
  companyId: string,
  now = new Date(),
): Promise<CompanyPrivacyExport> {
  const company = await store.getCompany(companyId);
  if (!company) throw new Error("Entreprise introuvable.");

  const [agent, calls, actions, consents, voiceSessions, reviewItems, readinessEvidence] = await Promise.all([
    store.getAgentByCompany(companyId),
    store.listCalls(companyId),
    store.listActions(companyId),
    store.listConsents(companyId),
    store.listVoiceSessions(companyId),
    store.listReviewItems(companyId),
    store.listReadinessEvidence(companyId),
  ]);

  return {
    generatedAt: now.toISOString(),
    company,
    agent,
    calls,
    actions,
    consents,
    voiceSessions,
    reviewItems,
    readinessEvidence,
    realityLabel: deriveProviderReality({
      configured: true,
      verified: store.info().provider === "prisma" && store.info().persistent,
      detail: store.info().persistent
        ? "Export généré depuis le repository durable configuré."
        : "Export généré depuis le store local; la persistance commerciale n'est pas vérifiée.",
    }),
  };
}

export async function deleteCompanyAccountData(
  store: ScalyRepository,
  companyId: string,
  requestedBy: string,
): Promise<AccountDeletionResult> {
  const result = await store.deleteCompanyData(companyId, requestedBy);
  await store.recordAudit({
    actor: "privacy",
    event: "account_data_deleted",
    detail: `${companyId} · requestedBy=${requestedBy} · calls=${result.deleted.calls} · actions=${result.deleted.actions}`,
  });
  return { ...result, auditEvent: "account_data_deleted" };
}
