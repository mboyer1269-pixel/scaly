/**
 * Dossier d'appel vérifiable — assemble, pour UN appel, tout ce que Scaly sait
 * déjà : transcript horodaté, provenance Twilio (signature vérifiée ou non),
 * consentements verbatim (ADR-018), audit trail lié. Le tout scellé par une
 * empreinte SHA-256 calculée sur une sérialisation canonique (clés triées) :
 * toute modification du contenu après export change l'empreinte (tamper-evident).
 *
 * VOCABULAIRE PRODUIT (volontairement prudent) : « vérifiable », « traçable »,
 * « horodaté » — jamais « certifié », « opposable » ou « preuve légale ».
 * Le dossier documente ; il ne remplace pas un avis juridique.
 *
 * Fonctions PURES (données entrantes → paquet sortant) : testables sans store.
 */
import { createHash } from "node:crypto";
import type { Call, TranscriptTurn } from "@/domain/call";
import type { Company } from "@/domain/company";
import type { ConsentRecord } from "@/domain/consent";
import type { ReadinessEvidence } from "@/domain/readiness";
import type { ComplianceAuditEntry } from "@/server/store";

export const EVIDENCE_SCHEMA_VERSION = 1;

export const EVIDENCE_DISCLAIMER =
  "Dossier d'appel généré par Allô Maude — contenu horodaté, traçable et vérifiable par empreinte SHA-256. " +
  "Document d'information opérationnelle ; ne constitue pas un avis juridique.";

export interface CallEvidencePackage {
  schemaVersion: typeof EVIDENCE_SCHEMA_VERSION;
  generatedAt: string;
  disclaimer: string;
  company: { id: string; name: string };
  call: {
    id: string;
    direction: Call["direction"];
    status: Call["status"];
    source: Call["source"];
    fromNumber: string;
    callerName?: string;
    language: Call["language"];
    startedAt: string;
    durationSec: number;
    transcript: TranscriptTurn[];
  };
  provenance: {
    provider?: string;
    externalId?: string;
    /** Horodatage de la vérification de signature Twilio à l'ingestion, si faite. */
    verifiedAt?: string;
    signatureVerified: boolean;
  };
  /** Résumé factuel de l'analyse — pas les scores internes. */
  analysis?: {
    summary: string;
    intent: string;
    finalStatus: string;
    transferReason?: string;
  };
  /** Tous les consentements connus de CE numéro pour CE tenant (verbatim inclus). */
  consents: ConsentRecord[];
  /** Entrées d'audit liées à l'appel (par callId ou callSid), ordre chronologique. */
  auditTrail: ComplianceAuditEntry[];
  /** Preuves d'ingestion liées (ex. « Webhook Twilio signé vérifié »). */
  provenanceEvidence: { label: string; status: string; detail: string; verifiedAt?: string; createdAt: string }[];
  /** SHA-256 hex de la sérialisation canonique de tout ce qui précède. */
  evidenceHash: string;
}

/** Sérialisation canonique : clés d'objets triées récursivement, undefined omis. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? "null" : stableStringify(v))).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(Buffer.from(s, "utf-8")).digest("hex");
}

export function computeEvidenceHash(pkg: Omit<CallEvidencePackage, "evidenceHash">): string {
  return sha256Hex(stableStringify(pkg));
}

export function buildEvidencePackage(input: {
  company: Company;
  call: Call;
  consents: ConsentRecord[];
  auditTrail: ComplianceAuditEntry[];
  provenanceEvidence: ReadinessEvidence[];
  generatedAt?: string;
}): CallEvidencePackage {
  const { call } = input;
  const body: Omit<CallEvidencePackage, "evidenceHash"> = {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    disclaimer: EVIDENCE_DISCLAIMER,
    company: { id: input.company.id, name: input.company.name },
    call: {
      id: call.id,
      direction: call.direction,
      status: call.status,
      source: call.source,
      fromNumber: call.fromNumber,
      callerName: call.callerName,
      language: call.language,
      startedAt: call.startedAt,
      durationSec: call.durationSec,
      transcript: call.transcript,
    },
    provenance: {
      provider: call.provenance?.provider,
      externalId: call.provenance?.externalId,
      verifiedAt: call.provenance?.verifiedAt,
      signatureVerified: Boolean(call.provenance?.verifiedAt),
    },
    ...(call.intelligence
      ? {
          analysis: {
            summary: call.intelligence.summary,
            intent: call.intelligence.intent,
            finalStatus: call.intelligence.finalStatus,
            transferReason: call.intelligence.transferReason,
          },
        }
      : {}),
    consents: input.consents,
    auditTrail: [...input.auditTrail].sort((a, b) => a.at.localeCompare(b.at)),
    provenanceEvidence: input.provenanceEvidence.map((e) => ({
      label: e.label,
      status: e.status,
      detail: e.detail,
      verifiedAt: e.verifiedAt,
      createdAt: e.createdAt,
    })),
  };
  return { ...body, evidenceHash: computeEvidenceHash(body) };
}

export interface EvidenceVerification {
  valid: boolean;
  expectedHash: string;
  actualHash: string;
}

/** Recalcule l'empreinte d'un dossier présenté : match = intact, mismatch = altéré. */
export function verifyEvidencePackage(pkg: CallEvidencePackage): EvidenceVerification {
  const { evidenceHash, ...body } = pkg;
  const actualHash = computeEvidenceHash(body);
  return { valid: actualHash === evidenceHash, expectedHash: evidenceHash, actualHash };
}
