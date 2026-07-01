/**
 * Service — Moteur de demande d'avis, permission-aware et sans faux avis.
 *
 * Déterministe et pur : aucune dépendance, aucun SMS/email réel, aucun Prisma.
 * Un appel ne devient une demande d'avis que s'il est RÉSOLU et NON négatif.
 * Urgence, escalade, insatisfaction, non-résolu, spam/fournisseur → jamais de
 * demande. Le lien d'avis provient UNIQUEMENT de `company.reviewUrl` (config
 * approuvée) — jamais inventé.
 */
import type { Call } from "@/domain/call";
import type { Company } from "@/domain/company";
import type {
  ReviewRequest,
  ReviewRequestReason,
  ReviewRequestStatus,
} from "@/domain/review-request";
import { newId } from "@/lib/format";

export interface ReviewRequestRepository {
  list(companyId: string): Promise<ReviewRequest[]>;
  get(id: string): Promise<ReviewRequest | undefined>;
  save(request: ReviewRequest): Promise<ReviewRequest>;
}

export class InMemoryReviewRequestRepository implements ReviewRequestRepository {
  private items = new Map<string, ReviewRequest>();

  async list(companyId: string): Promise<ReviewRequest[]> {
    return [...this.items.values()].filter((item) => item.companyId === companyId);
  }

  async get(id: string): Promise<ReviewRequest | undefined> {
    return this.items.get(id);
  }

  async save(request: ReviewRequest): Promise<ReviewRequest> {
    this.items.set(request.id, request);
    return request;
  }
}

export function getReviewRequestRepository(): ReviewRequestRepository {
  const g = globalThis as { __scalyReviewRequests?: ReviewRequestRepository };
  if (g.__scalyReviewRequests) return g.__scalyReviewRequests;
  const repo: ReviewRequestRepository =
    process.env.STORE_PROVIDER === "prisma"
      ? new (require("../server/prisma-phase4-repos").PrismaReviewRequestRepository)()
      : new InMemoryReviewRequestRepository();
  g.__scalyReviewRequests = repo;
  return repo;
}

export interface ReviewEligibility {
  eligible: boolean;
  reason: ReviewRequestReason;
}

/**
 * Évalue si un appel mérite une demande d'avis. Conservateur par design :
 * n'est éligible qu'un appel résolu par l'IA, sans urgence, escalade, plainte,
 * sentiment négatif, ni spam/fournisseur.
 */
export function evaluateReviewEligibility(call: Call): ReviewEligibility {
  const i = call.intelligence;
  if (!i) return { eligible: false, reason: "no_analysis" };
  if (i.intent === "spam" || i.intent === "fournisseur" || i.finalStatus === "ignore_spam") {
    return { eligible: false, reason: "spam_or_supplier" };
  }
  if (i.urgency === "critique" || i.urgency === "haute") return { eligible: false, reason: "call_urgent" };
  if (i.finalStatus === "transfere") return { eligible: false, reason: "call_escalated" };
  if (i.finalStatus === "suivi_requis" || i.finalStatus === "perdu") {
    return { eligible: false, reason: "call_unresolved" };
  }
  if (i.sentiment === "negatif" || i.intent === "plainte") {
    return { eligible: false, reason: "customer_dissatisfied" };
  }
  if (i.finalStatus === "resolu_par_ia") return { eligible: true, reason: "resolved_positive" };
  return { eligible: false, reason: "not_resolved" };
}

/**
 * Valide/normalise un lien d'avis saisi par le propriétaire. Vide accepté
 * (retourne undefined = pas de lien). Sinon, SEULES les URL https complètes
 * sont acceptées ; sinon, lève une erreur claire. Toujours trim avant retour.
 * Ne fabrique jamais d'URL.
 */
export function normalizeReviewUrl(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new Error("Lien Google Review invalide.");
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Lien Google Review invalide : entrez une URL https complète.");
  }
  if (url.protocol !== "https:") {
    throw new Error("Lien Google Review invalide : seules les adresses https sont acceptées.");
  }
  return trimmed;
}

/** Message sobre, humain, FR-CA. N'utilise que des données réelles (nom, entreprise, lien config). */
export function buildReviewMessage(company: Company, customerName?: string, reviewUrl?: string): string {
  const greeting = customerName ? `Bonjour ${customerName},` : "Bonjour,";
  const base = `${greeting} merci d'avoir contacté ${company.name}. Si notre service vous a plu, un court avis nous aiderait beaucoup`;
  return reviewUrl ? `${base} : ${reviewUrl}` : `${base}.`;
}

export interface CreateReviewRequestOptions {
  now?: Date;
  repo?: ReviewRequestRepository;
  /** Permission-aware : false = le client s'est désinscrit → saut « no_consent ». Défaut : autorisé. */
  canContact?: boolean;
}

function phoneOf(call: Call): string | undefined {
  return call.fromNumber && call.fromNumber !== "inconnu" ? call.fromNumber : undefined;
}

/**
 * Crée une demande d'avis à partir d'un appel. Retourne toujours un
 * enregistrement : `drafted`/`eligible` si l'appel qualifie, sinon `skipped`
 * avec la raison — utile pour mesurer la preuve sociale et les sauts.
 */
export async function createReviewRequestFromCall(
  call: Call,
  company: Company,
  options: CreateReviewRequestOptions = {},
): Promise<ReviewRequest> {
  const now = options.now ?? new Date();
  const iso = now.toISOString();
  const repo = options.repo ?? getReviewRequestRepository();
  const customerName = call.callerName;
  const customerPhone = phoneOf(call);
  const base = {
    id: newId("review_req"),
    companyId: company.id,
    customerName,
    customerPhone,
    sourceCallId: call.id,
    createdAt: iso,
    updatedAt: iso,
  };

  const skip = (reason: ReviewRequestReason): Promise<ReviewRequest> =>
    repo.save({ ...base, status: "skipped", reason, message: "", skippedAt: iso });

  if (options.canContact === false) return skip("no_consent");

  const verdict = evaluateReviewEligibility(call);
  if (!verdict.eligible) return skip(verdict.reason);

  // Lien d'avis UNIQUEMENT depuis la config. Jamais inventé.
  const reviewUrl = company.reviewUrl;
  const message = buildReviewMessage(company, customerName, reviewUrl);
  // Sans lien approuvé, la demande qualifie mais n'est pas prête à l'envoi.
  const status: ReviewRequestStatus = reviewUrl ? "drafted" : "eligible";
  const reason: ReviewRequestReason = reviewUrl ? "resolved_positive" : "awaiting_review_url";
  return repo.save({ ...base, status, reason, message, reviewUrl });
}

interface MutationOptions {
  now?: Date;
  repo?: ReviewRequestRepository;
}

async function transition(
  companyId: string,
  id: string,
  repo: ReviewRequestRepository,
  patch: (current: ReviewRequest, iso: string) => ReviewRequest,
  now: Date,
): Promise<ReviewRequest> {
  const current = await repo.get(id);
  if (!current || current.companyId !== companyId) throw new Error("Demande d'avis introuvable.");
  return repo.save(patch(current, now.toISOString()));
}

export function markReviewRequestSent(
  companyId: string,
  id: string,
  options: MutationOptions = {},
): Promise<ReviewRequest> {
  const now = options.now ?? new Date();
  const repo = options.repo ?? getReviewRequestRepository();
  return transition(companyId, id, repo, (current, iso) => ({ ...current, status: "sent", sentAt: iso, updatedAt: iso }), now);
}

export function markReviewRequestSkipped(
  companyId: string,
  id: string,
  options: MutationOptions & { reason?: ReviewRequestReason } = {},
): Promise<ReviewRequest> {
  const now = options.now ?? new Date();
  const repo = options.repo ?? getReviewRequestRepository();
  return transition(
    companyId,
    id,
    repo,
    (current, iso) => ({ ...current, status: "skipped", reason: options.reason ?? "owner_skipped", skippedAt: iso, updatedAt: iso }),
    now,
  );
}

function safeReason(reason: string): string {
  return reason.trim().replace(/\s+/g, " ").slice(0, 200) || "delivery_failed";
}

export function markReviewRequestFailed(
  companyId: string,
  id: string,
  reason: string,
  options: MutationOptions = {},
): Promise<ReviewRequest> {
  const now = options.now ?? new Date();
  const repo = options.repo ?? getReviewRequestRepository();
  return transition(
    companyId,
    id,
    repo,
    (current, iso) => ({ ...current, status: "failed", failureReason: safeReason(reason), updatedAt: iso }),
    now,
  );
}

export interface ListReviewRequestsOptions {
  status?: ReviewRequestStatus | ReviewRequestStatus[];
  repo?: ReviewRequestRepository;
}

const STATUS_RANK: Record<ReviewRequestStatus, number> = {
  drafted: 0,
  eligible: 1,
  failed: 2,
  sent: 3,
  skipped: 4,
};

/** Tri stable : actionnable d'abord (drafted, eligible), puis les plus récentes. */
export async function listReviewRequests(
  companyId: string,
  options: ListReviewRequestsOptions = {},
): Promise<ReviewRequest[]> {
  const repo = options.repo ?? getReviewRequestRepository();
  const all = await repo.list(companyId);
  const wanted = options.status ? new Set(Array.isArray(options.status) ? options.status : [options.status]) : null;
  const filtered = wanted ? all.filter((item) => wanted.has(item.status)) : all;
  return filtered.sort((a, b) => {
    if (STATUS_RANK[a.status] !== STATUS_RANK[b.status]) return STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (a.createdAt !== b.createdAt) return b.createdAt.localeCompare(a.createdAt);
    return a.id.localeCompare(b.id);
  });
}
