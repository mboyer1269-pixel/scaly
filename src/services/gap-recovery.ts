/**
 * Service — Remplissage intelligent des annulations (appointment_gap_recovery).
 *
 * Le moteur de la capability : les packs déclarent le contexte (taxonomie,
 * gabarits, prudence), CE fichier exécute. Cœur en fonctions PURES (détection,
 * matching, message, transitions) + une fine couche d'orchestration sur un
 * repo injectable (in-memory par défaut, Prisma quand STORE_PROVIDER=prisma —
 * même pattern que les moteurs Phase 4).
 *
 * Barrières NON négociables (voir CAPABILITY safetyRules) :
 *  - tenant : chaque lecture/écriture est filtrée par companyId ;
 *  - consentement : un SMS ne part JAMAIS sans consentement actif du coffre
 *    (ADR-018) — un refus exclut du matching, une révocation annule l'offre ;
 *  - prudence : le message n'affirme jamais que la plage est réservée ;
 *  - annulation : une entité annulée bloque toute livraison future, pour toujours ;
 *  - volume : limite basse de candidats par plage — jamais de relance de masse.
 */
import type { Call } from "@/domain/call";
import type { Company } from "@/domain/company";
import type { IndustryPack } from "@/domain/pack";
import type {
  AppointmentGap,
  AppointmentGapSource,
  RecoveryOffer,
  RecoveryOfferStatus,
  SmsConsentState,
  WaitlistEntry,
} from "@/domain/gap-recovery";
import { GAP_RECOVERY_CAPABILITY, offerIdempotencyKey } from "@/domain/gap-recovery";
import type { ConsentRecord } from "@/domain/consent";
import { canonicalPhone } from "@/domain/consent";
import type { Urgency } from "@/domain/call";
import { getIndustryPack, GENERAL_PACK } from "@/data/industry-packs";
import { packSupportsCapability, requireCapability } from "@/data/capabilities";
import { canFollowUp, consentFromCall } from "@/services/consent";
import { newId } from "@/lib/format";

/* ------------------------------------------------------------------ */
/* Persistance — repo injectable (in-memory | Prisma)                   */
/* ------------------------------------------------------------------ */

export interface GapRecoveryRepository {
  listWaitlistEntries(companyId: string): Promise<WaitlistEntry[]>;
  getWaitlistEntry(id: string): Promise<WaitlistEntry | undefined>;
  saveWaitlistEntry(entry: WaitlistEntry): Promise<WaitlistEntry>;
  listGaps(companyId: string): Promise<AppointmentGap[]>;
  getGap(id: string): Promise<AppointmentGap | undefined>;
  saveGap(gap: AppointmentGap): Promise<AppointmentGap>;
  findGapByIdempotencyKey(companyId: string, key: string): Promise<AppointmentGap | undefined>;
  listOffers(companyId: string, gapId?: string): Promise<RecoveryOffer[]>;
  getOffer(id: string): Promise<RecoveryOffer | undefined>;
  saveOffer(offer: RecoveryOffer): Promise<RecoveryOffer>;
  findOfferByIdempotencyKey(companyId: string, key: string): Promise<RecoveryOffer | undefined>;
  /** Effacement tenant (Loi 25). Retourne le nombre total de lignes supprimées. */
  deleteByCompany(companyId: string): Promise<number>;
}

export class InMemoryGapRecoveryRepository implements GapRecoveryRepository {
  private entries = new Map<string, WaitlistEntry>();
  private gaps = new Map<string, AppointmentGap>();
  private offers = new Map<string, RecoveryOffer>();

  async listWaitlistEntries(companyId: string): Promise<WaitlistEntry[]> {
    return [...this.entries.values()]
      .filter((e) => e.companyId === companyId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async getWaitlistEntry(id: string): Promise<WaitlistEntry | undefined> {
    return this.entries.get(id);
  }

  async saveWaitlistEntry(entry: WaitlistEntry): Promise<WaitlistEntry> {
    this.entries.set(entry.id, entry);
    return entry;
  }

  async listGaps(companyId: string): Promise<AppointmentGap[]> {
    return [...this.gaps.values()]
      .filter((g) => g.companyId === companyId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getGap(id: string): Promise<AppointmentGap | undefined> {
    return this.gaps.get(id);
  }

  async saveGap(gap: AppointmentGap): Promise<AppointmentGap> {
    this.gaps.set(gap.id, gap);
    return gap;
  }

  async findGapByIdempotencyKey(companyId: string, key: string): Promise<AppointmentGap | undefined> {
    return [...this.gaps.values()].find((g) => g.companyId === companyId && g.idempotencyKey === key);
  }

  async listOffers(companyId: string, gapId?: string): Promise<RecoveryOffer[]> {
    return [...this.offers.values()]
      .filter((o) => o.companyId === companyId && (!gapId || o.gapId === gapId))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async getOffer(id: string): Promise<RecoveryOffer | undefined> {
    return this.offers.get(id);
  }

  async saveOffer(offer: RecoveryOffer): Promise<RecoveryOffer> {
    this.offers.set(offer.id, offer);
    return offer;
  }

  async findOfferByIdempotencyKey(companyId: string, key: string): Promise<RecoveryOffer | undefined> {
    return [...this.offers.values()].find((o) => o.companyId === companyId && o.idempotencyKey === key);
  }

  async deleteByCompany(companyId: string): Promise<number> {
    let count = 0;
    for (const [id, e] of [...this.entries]) if (e.companyId === companyId) { this.entries.delete(id); count += 1; }
    for (const [id, g] of [...this.gaps]) if (g.companyId === companyId) { this.gaps.delete(id); count += 1; }
    for (const [id, o] of [...this.offers]) if (o.companyId === companyId) { this.offers.delete(id); count += 1; }
    return count;
  }
}

export function getGapRecoveryRepository(): GapRecoveryRepository {
  const g = globalThis as { __scalyGapRecovery?: GapRecoveryRepository };
  if (g.__scalyGapRecovery) return g.__scalyGapRecovery;
  const repo: GapRecoveryRepository =
    process.env.STORE_PROVIDER === "prisma"
      ? new (require("../server/prisma-gap-recovery-repo").PrismaGapRecoveryRepository)()
      : new InMemoryGapRecoveryRepository();
  g.__scalyGapRecovery = repo;
  return repo;
}

/* ------------------------------------------------------------------ */
/* Audit — sink injectable (journal recordAudit du store par défaut)    */
/* ------------------------------------------------------------------ */

/** Événement d'audit MINIMAL : type, tenant, ids, statut, résumé court. Jamais de transcript. */
export interface GapRecoveryAuditEvent {
  event: string;
  companyId: string;
  detail: string;
}

export interface GapRecoveryAuditSink {
  record(event: GapRecoveryAuditEvent): Promise<void>;
}

/** Sink par défaut : le journal d'audit du store (fil de conformité existant). */
function defaultAuditSink(): GapRecoveryAuditSink {
  return {
    async record(e) {
      const { getStore } = require("../server/store") as typeof import("../server/store");
      await getStore().recordAudit({ companyId: e.companyId, actor: "gap-recovery", event: e.event, detail: e.detail });
    },
  };
}

interface EngineOptions {
  repo?: GapRecoveryRepository;
  audit?: GapRecoveryAuditSink;
  now?: Date;
}

function resolve(options?: EngineOptions) {
  return {
    repo: options?.repo ?? getGapRecoveryRepository(),
    audit: options?.audit ?? defaultAuditSink(),
    now: options?.now ?? new Date(),
  };
}

/** Erreur métier propre du moteur (transition illégale, donnée manquante). */
export class GapRecoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GapRecoveryError";
  }
}

/* ------------------------------------------------------------------ */
/* Phase 5 — Détection d'intention « liste d'attente / rappel si… »     */
/* ------------------------------------------------------------------ */

const WAITLIST_PATTERNS: RegExp[] = [
  /si (?:une |la |ça |ca )?(?:place|plage|dispo\w*)\s+se lib/i,
  /s'il y a (?:une |des )?(?:annulation|place|plage)/i,
  /si (?:quelqu'un|kelkun) annule/i,
  /si (?:ça|ca) annule/i,
  /liste d(?:'|e )attente/i,
  /liste de (?:rappel|relance)/i,
  /(?:appelez|appele|rappelez|rappele|textez|texte)[\s-]*moi si/i,
  /je peux venir plus t(?:ô|o)t/i,
  /plus t(?:ô|o)t si (?:possible|jamais|vous avez)/i,
  /(?:avant|plus tôt),? si (?:une place|ça|ca) se lib/i,
  /je suis disponible si/i,
  /\bwait\s?list\b/i,
  /if (?:a spot|an appointment|a slot|something|anything) (?:opens|frees) up/i,
  /if (?:there'?s|there is) a cancell?ation/i,
  /if (?:someone|somebody|anyone) cancels/i,
  /call me if/i,
  /text me if/i,
  /i can come (?:in )?earlier/i,
];

export interface WaitlistIntentDetection {
  matched: boolean;
  /** Extrait COURT qui a déclenché la détection — preuve, pas transcript. */
  evidence?: string;
}

/** Détection PURE de l'intention liste d'attente dans les tours de l'appelant. */
export function detectWaitlistIntent(call: Call): WaitlistIntentDetection {
  for (const turn of call.transcript) {
    if (turn.speaker !== "caller") continue;
    for (const re of WAITLIST_PATTERNS) {
      const m = turn.text.match(re);
      if (m) return { matched: true, evidence: turn.text.slice(0, 160) };
    }
  }
  return { matched: false };
}

/** Consentement SMS tel que CONNU au moment de l'appel — dérivé du même capteur que le coffre. */
function smsConsentFromCall(call: Call): SmsConsentState {
  const consent = consentFromCall(call);
  if (!consent) return "unknown";
  return consent.status === "actif" ? "yes" : "no";
}

function channelPreferenceFromCall(call: Call): WaitlistEntry["channelPreference"] {
  const fields = call.intelligence?.collectedFields ?? {};
  const verbatim = Object.values(fields).join(" ").toLowerCase();
  if (/texto|texte|sms|text/.test(verbatim)) return "sms";
  if (/appel|appelle|rappel|call/.test(verbatim)) return "call";
  return "unknown";
}

/** Catégorie de service : mappe prudemment le libellé capté sur la taxonomie du pack, sinon rien. */
function serviceCategoryFromLabel(label: string | undefined, pack: IndustryPack | undefined): string | undefined {
  if (!label || !pack) return undefined;
  const lower = label.toLowerCase();
  const hit = pack.serviceCategories.find(
    (c) => lower.includes(c.label.toLowerCase()) || lower.includes(c.id.replace(/_/g, " ")),
  );
  return hit?.id;
}

export interface CaptureWaitlistResult {
  created: boolean;
  entry?: WaitlistEntry;
  reason?: "aucune_intention" | "capability_non_supportee" | "telephone_manquant" | "deja_inscrit";
}

/**
 * Capte l'intention liste d'attente d'un appel analysé → WaitlistEntry persistée.
 * Capability-driven avec REPLI : une industrie sans pack dédié utilise le pack
 * PME générale (invariant produit : le repli general_sme ne crashe jamais) —
 * une plomberie a aussi des rendez-vous annulés. Le PROMPT vocal, lui, reste
 * strict (findIndustryPack) : la capture est post-appel, elle ne touche pas
 * au comportement en ligne des industries sans pack. Refus propre seulement
 * si le pack résolu ne déclare pas la capability.
 * Idempotent : même appel (sourceCallId) ou même numéro déjà actif → pas de doublon.
 */
export async function captureWaitlistEntryFromCall(
  call: Call,
  company: Company,
  options?: EngineOptions,
): Promise<CaptureWaitlistResult> {
  if (!call.companyId) throw new GapRecoveryError("companyId obligatoire sur l'appel — aucune donnée sans tenant.");
  const { repo, audit, now } = resolve(options);

  const pack = getIndustryPack(company.industry);
  if (!packSupportsCapability(pack, GAP_RECOVERY_CAPABILITY)) {
    return { created: false, reason: "capability_non_supportee" };
  }

  const detection = detectWaitlistIntent(call);
  if (!detection.matched) return { created: false, reason: "aucune_intention" };

  const phone = call.fromNumber && call.fromNumber !== "inconnu" ? call.fromNumber : "";
  if (!phone) return { created: false, reason: "telephone_manquant" };

  const existing = await repo.listWaitlistEntries(call.companyId);
  const canon = canonicalPhone(phone);
  const duplicate = existing.find(
    (e) => e.status === "active" && (e.sourceCallId === call.id || canonicalPhone(e.phone) === canon),
  );
  if (duplicate) return { created: false, entry: duplicate, reason: "deja_inscrit" };

  const fields = call.intelligence?.collectedFields ?? {};
  const nowIso = now.toISOString();
  const entry: WaitlistEntry = {
    id: newId("wait"),
    companyId: call.companyId,
    industryPackId: pack.id,
    capabilityId: GAP_RECOVERY_CAPABILITY,
    callerName: call.callerName ?? (fields["callerName"] || undefined),
    phone,
    sourceCallId: call.id,
    desiredServiceCategory: serviceCategoryFromLabel(fields["service"], pack),
    desiredServiceLabel: fields["service"] || undefined,
    preferredTimeWindow: fields["moment"] || fields["preferredTime"] || undefined,
    urgency: call.intelligence?.urgency,
    channelPreference: channelPreferenceFromCall(call),
    consentToSms: smsConsentFromCall(call),
    status: "active",
    notes: detection.evidence,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  await repo.saveWaitlistEntry(entry);
  await audit.record({
    event: "waitlist.entry_created",
    companyId: entry.companyId,
    detail: `${entry.id} · ${canon} · consentement SMS : ${entry.consentToSms} (appel ${call.id})`,
  });
  return { created: true, entry };
}

/* ------------------------------------------------------------------ */
/* Phase 7 — Matching simple mais propre (fonction PURE)                */
/* ------------------------------------------------------------------ */

const URGENCY_RANK: Record<Urgency, number> = { critique: 0, haute: 1, normale: 2, basse: 3 };

/**
 * Candidats pertinents pour une plage. Règles dures :
 *  - même companyId (jamais de cross-tenant), statut active, téléphone présent ;
 *  - un consentement SMS REFUSÉ exclut (ADR-018 : un refus est final — on ne
 *    prépare même pas d'offre) ; « unknown » reste éligible mais ne partira
 *    jamais en SMS automatique (canal action_only, un humain décide) ;
 *  - catégorie compatible priorisée ; sans catégorie déclarée → repli prudent
 *    APRÈS les correspondances exactes ; une catégorie DIFFÉRENTE exclut ;
 *  - ordre : compatibilité, urgence, puis premier arrivé ; limite basse.
 */
export function matchWaitlistCandidates(
  entries: WaitlistEntry[],
  gap: AppointmentGap,
  limit: number,
): WaitlistEntry[] {
  return entries
    .filter(
      (e) =>
        e.companyId === gap.companyId &&
        e.status === "active" &&
        Boolean(e.phone) &&
        e.consentToSms !== "no" &&
        (!gap.serviceCategory || !e.desiredServiceCategory || e.desiredServiceCategory === gap.serviceCategory),
    )
    .sort((a, b) => {
      const aExact = gap.serviceCategory && a.desiredServiceCategory === gap.serviceCategory ? 0 : 1;
      const bExact = gap.serviceCategory && b.desiredServiceCategory === gap.serviceCategory ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      const aU = URGENCY_RANK[a.urgency ?? "normale"];
      const bU = URGENCY_RANK[b.urgency ?? "normale"];
      if (aU !== bU) return aU - bU;
      return a.createdAt.localeCompare(b.createdAt);
    })
    .slice(0, Math.max(0, limit));
}

/* ------------------------------------------------------------------ */
/* Phase 8 — Message prudent (fonction PURE)                            */
/* ------------------------------------------------------------------ */

const FORBIDDEN_MESSAGE_PATTERNS = [/réserv(?:é|ée|e)\s+pour\s+vous/i, /garanti/i, /dernière chance/i, /urgent[\s!]/i];

/**
 * Message d'offre depuis le gabarit du pack ({name}, {company}, {slot}).
 * Barrières appliquées EN CODE, pas par confiance dans le gabarit :
 * l'entreprise est identifiée, STOP est présent, aucune promesse de réservation.
 */
export function buildOfferMessage(
  company: Company,
  pack: IndustryPack | undefined,
  gap: AppointmentGap,
  entry: WaitlistEntry,
): string {
  const template = (pack ?? GENERAL_PACK).cancellation.freedSlotSmsTemplate;
  const name = entry.callerName?.trim();
  let message = template
    .replace("{name}", name ?? "")
    .replace("{company}", company.name)
    .replace("{slot}", gap.humanLabel)
    .replace(/\s{2,}/g, " ")
    .replace(/Bonjour\s*,/, "Bonjour,");
  if (!message.includes(company.name)) message = `${company.name} — ${message}`;
  if (!/\bSTOP\b/.test(message)) message += " Répondez STOP pour ne plus recevoir ces alertes.";
  for (const forbidden of FORBIDDEN_MESSAGE_PATTERNS) {
    if (forbidden.test(message)) {
      throw new GapRecoveryError(`Gabarit non conforme (« ${forbidden.source} ») — le message ne doit jamais promettre la plage ni presser la personne.`);
    }
  }
  return message;
}

/* ------------------------------------------------------------------ */
/* Phase 6 — Ouvrir une plage libérée + préparer les offres             */
/* ------------------------------------------------------------------ */

export interface OpenAppointmentGapInput {
  companyId: string;
  serviceCategory?: string;
  serviceLabel?: string;
  startsAt?: string;
  endsAt?: string;
  humanLabel: string;
  source?: AppointmentGapSource;
  /** Clé stable optionnelle : rouvrir la même plage est un no-op (idempotence). */
  idempotencyKey?: string;
  /** Limite de candidats — bornée par la limite de la capability. */
  maxCandidates?: number;
}

export interface OpenAppointmentGapResult {
  gap: AppointmentGap;
  offers: RecoveryOffer[];
  /** true si la plage existait déjà (clé d'idempotence) — rien de nouveau n'a été créé. */
  idempotent: boolean;
}

/**
 * Ouvre une plage libérée SANS calendrier complet : persiste, audite,
 * matche les candidats actifs et prépare les offres (une par candidat,
 * idempotentes). Les offres sont PRÉPARÉES, jamais envoyées ici —
 * l'envoi passe par sendPreparedOffers et son consent gate.
 */
export async function openAppointmentGap(
  input: OpenAppointmentGapInput,
  company: Company,
  options?: EngineOptions,
): Promise<OpenAppointmentGapResult> {
  if (!input.companyId) throw new GapRecoveryError("companyId obligatoire — aucune donnée sans tenant.");
  if (input.companyId !== company.id) throw new GapRecoveryError("companyId incohérent avec l'entreprise résolue.");
  if (!input.humanLabel?.trim()) throw new GapRecoveryError("humanLabel obligatoire — la plage doit rester lisible sans calendrier.");
  requireCapability(GAP_RECOVERY_CAPABILITY); // échec propre AVANT toute écriture si la capability disparaît du registre
  const { repo, audit, now } = resolve(options);
  const pack = getIndustryPack(company.industry); // repli PME : gabarits et taxonomie toujours résolus

  if (input.idempotencyKey) {
    const existing = await repo.findGapByIdempotencyKey(input.companyId, input.idempotencyKey);
    if (existing) {
      return { gap: existing, offers: await repo.listOffers(input.companyId, existing.id), idempotent: true };
    }
  }

  const nowIso = now.toISOString();
  const gap: AppointmentGap = {
    id: newId("gap"),
    companyId: input.companyId,
    industryPackId: pack?.id,
    capabilityId: GAP_RECOVERY_CAPABILITY,
    serviceCategory: input.serviceCategory,
    serviceLabel: input.serviceLabel,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    humanLabel: input.humanLabel.trim(),
    source: input.source ?? "manual",
    status: "open",
    idempotencyKey: input.idempotencyKey,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  await repo.saveGap(gap);
  await audit.record({
    event: "appointment_gap.opened",
    companyId: gap.companyId,
    detail: `${gap.id} · ${gap.humanLabel}${gap.serviceCategory ? ` · ${gap.serviceCategory}` : ""} · source ${gap.source}`,
  });

  const offers = await prepareOffersForGap(gap.id, company, { ...options, maxCandidates: input.maxCandidates });
  const fresh = (await repo.getGap(gap.id)) ?? gap;
  return { gap: fresh, offers, idempotent: false };
}

/**
 * Prépare les offres d'une plage ouverte : matching borné + une RecoveryOffer
 * idempotente par candidat. REFUSE proprement si la plage n'est plus ouvrable
 * (cancelled/filled/expired) — une plage annulée ne crée JAMAIS de nouvelle offre.
 */
export async function prepareOffersForGap(
  gapId: string,
  company: Company,
  options?: EngineOptions & { maxCandidates?: number },
): Promise<RecoveryOffer[]> {
  const capability = requireCapability(GAP_RECOVERY_CAPABILITY);
  const { repo, audit, now } = resolve(options);
  const gap = await repo.getGap(gapId);
  if (!gap) throw new GapRecoveryError(`Plage introuvable : ${gapId}`);
  if (gap.companyId !== company.id) throw new GapRecoveryError("Plage d'un autre tenant — accès refusé.");
  if (gap.status !== "open" && gap.status !== "offered") return [];

  const pack = getIndustryPack(company.industry);
  const defaultLimit = capability.defaultLimits.maxCandidatesPerGap;
  const limit = Math.min(Math.max(1, options?.maxCandidates ?? defaultLimit), defaultLimit * 2);

  const entries = await repo.listWaitlistEntries(gap.companyId);
  const candidates = matchWaitlistCandidates(entries, gap, limit);

  const offers: RecoveryOffer[] = [];
  for (const entry of candidates) {
    const key = offerIdempotencyKey(gap.id, entry.id);
    const existing = await repo.findOfferByIdempotencyKey(gap.companyId, key);
    if (existing) {
      offers.push(existing);
      continue;
    }
    const nowIso = now.toISOString();
    const offer: RecoveryOffer = {
      id: newId("offer"),
      companyId: gap.companyId,
      gapId: gap.id,
      waitlistEntryId: entry.id,
      channel: entry.consentToSms === "yes" ? "sms" : "action_only",
      status: "prepared",
      messagePreview: buildOfferMessage(company, pack, gap, entry),
      idempotencyKey: key,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await repo.saveOffer(offer);
    await audit.record({
      event: "recovery_offer.prepared",
      companyId: offer.companyId,
      detail: `${offer.id} · plage ${gap.id} · entrée ${entry.id} · canal ${offer.channel}`,
    });
    offers.push(offer);
  }

  if (offers.length > 0 && gap.status === "open") {
    await repo.saveGap({ ...gap, status: "offered", updatedAt: now.toISOString() });
  }
  return offers;
}

/* ------------------------------------------------------------------ */
/* Phase 9 — Transitions et annulation (cancel safety)                  */
/* ------------------------------------------------------------------ */

const OFFER_TRANSITIONS: Record<RecoveryOfferStatus, RecoveryOfferStatus[]> = {
  prepared: ["sent", "confirmed", "declined", "cancelled", "expired", "failed"],
  sent: ["confirmed", "declined", "cancelled", "expired", "failed"],
  confirmed: [],
  declined: [],
  cancelled: [],
  expired: [],
  failed: ["cancelled", "expired"],
};

/** Transition PURE d'une offre. Illégale → GapRecoveryError (jamais de statut silencieusement écrasé). */
export function transitionOffer(
  offer: RecoveryOffer,
  to: RecoveryOfferStatus,
  now: Date,
  extra?: { cancelReason?: string; deliveryId?: string },
): RecoveryOffer {
  if (!OFFER_TRANSITIONS[offer.status].includes(to)) {
    throw new GapRecoveryError(`Transition illégale : offre ${offer.id} ${offer.status} → ${to}.`);
  }
  const nowIso = now.toISOString();
  return {
    ...offer,
    status: to,
    updatedAt: nowIso,
    sentAt: to === "sent" ? nowIso : offer.sentAt,
    confirmedAt: to === "confirmed" ? nowIso : offer.confirmedAt,
    cancelledAt: to === "cancelled" ? nowIso : offer.cancelledAt,
    cancelReason: to === "cancelled" ? (extra?.cancelReason ?? "non précisé") : offer.cancelReason,
    deliveryId: extra?.deliveryId ?? offer.deliveryId,
  };
}

async function loadTenantOffer(repo: GapRecoveryRepository, companyId: string, offerId: string): Promise<RecoveryOffer> {
  const offer = await repo.getOffer(offerId);
  if (!offer || offer.companyId !== companyId) throw new GapRecoveryError(`Offre introuvable pour ce tenant : ${offerId}`);
  return offer;
}

/** Annule une offre — IDEMPOTENT : ré-annuler conserve cancelledAt/cancelReason d'origine. */
export async function cancelRecoveryOffer(
  companyId: string,
  offerId: string,
  reason: string,
  options?: EngineOptions,
): Promise<RecoveryOffer> {
  const { repo, audit, now } = resolve(options);
  const offer = await loadTenantOffer(repo, companyId, offerId);
  if (offer.status === "cancelled") return offer;
  const cancelled = transitionOffer(offer, "cancelled", now, { cancelReason: reason });
  await repo.saveOffer(cancelled);
  await audit.record({ event: "recovery_offer.cancelled", companyId, detail: `${offer.id} · ${reason}` });
  return cancelled;
}

/**
 * Contexte de courtoisie « premier arrivé, premier servi » : quand une offre
 * est confirmée, les personnes qui avaient REÇU le texto (offres sœurs `sent`)
 * sont prévenues que la plage est prise — au lieu de rester devant un message
 * qui promet encore une place. Optionnel et best-effort : sans port SMS ou
 * sans consentement encore actif, on annule sans texto (jamais de spam).
 */
export interface ConfirmNotifyContext {
  company: Company;
  smsPort?: RecoverySmsPort;
  consents?: ConsentRecord[];
}

/** Message de clôture aux non-retenus — identifie l'entreprise, ne promet rien, offre STOP. */
export function buildGapTakenMessage(company: Company, humanLabel: string): string {
  return `${company.name} : la plage ${humanLabel} vient d'être prise — première réponse l'emporte. Vous restez sur la liste et on vous fera signe dès qu'une autre place se libère. Répondez STOP pour ne plus recevoir ces alertes.`;
}

/**
 * Confirme une offre (la personne a dit OUI et l'équipe a validé) :
 * offre → confirmed, entrée → confirmed, plage → filled, et les offres
 * SŒURS encore livrables sont annulées (on ne relance pas pour une plage comblée).
 * Avec `notify`, les sœurs déjà ENVOYÉES reçoivent le message de clôture consenti.
 */
export async function confirmRecoveryOffer(
  companyId: string,
  offerId: string,
  options?: EngineOptions,
  notify?: ConfirmNotifyContext,
): Promise<RecoveryOffer> {
  const { repo, audit, now } = resolve(options);
  const offer = await loadTenantOffer(repo, companyId, offerId);
  const confirmed = transitionOffer(offer, "confirmed", now);
  await repo.saveOffer(confirmed);
  await audit.record({ event: "recovery_offer.confirmed", companyId, detail: `${offer.id} · plage ${offer.gapId}` });

  const entry = await repo.getWaitlistEntry(offer.waitlistEntryId);
  if (entry && entry.companyId === companyId && (entry.status === "active" || entry.status === "contacted")) {
    await repo.saveWaitlistEntry({ ...entry, status: "confirmed", updatedAt: now.toISOString() });
  }
  const gap = await repo.getGap(offer.gapId);
  if (gap && gap.companyId === companyId && gap.status !== "cancelled") {
    await repo.saveGap({ ...gap, status: "filled", updatedAt: now.toISOString() });
    await audit.record({ event: "appointment_gap.filled", companyId, detail: `${gap.id} · via offre ${offer.id}` });
  }
  for (const sibling of await repo.listOffers(companyId, offer.gapId)) {
    if (sibling.id !== offer.id && (sibling.status === "prepared" || sibling.status === "sent")) {
      const wasSent = sibling.status === "sent";
      await repo.saveOffer(transitionOffer(sibling, "cancelled", now, { cancelReason: "plage comblée" }));
      await audit.record({ event: "recovery_offer.cancelled", companyId, detail: `${sibling.id} · plage comblée` });

      // Message de clôture aux personnes qui avaient reçu l'offre — consentement
      // revérifié À L'ENVOI (un STOP entre-temps bloque même la courtoisie).
      if (wasSent && notify?.smsPort && gap) {
        const siblingEntry = await repo.getWaitlistEntry(sibling.waitlistEntryId);
        if (
          siblingEntry &&
          siblingEntry.companyId === companyId &&
          siblingEntry.status !== "cancelled" &&
          canFollowUp(notify.consents ?? [], siblingEntry.phone, "rappel")
        ) {
          try {
            await notify.smsPort.send(siblingEntry.phone, buildGapTakenMessage(notify.company, gap.humanLabel));
            await audit.record({
              event: "recovery_offer.gap_taken_notice",
              companyId,
              detail: `${sibling.id} · ${canonicalPhone(siblingEntry.phone)} avisé que la plage est prise`,
            });
          } catch {
            // La courtoisie est best-effort : son échec ne bloque jamais la confirmation.
          }
        }
      }
    }
  }
  return confirmed;
}

/** Décline une offre (la personne a dit NON). N'affecte NI les offres sœurs, ni l'entrée. */
export async function declineRecoveryOffer(
  companyId: string,
  offerId: string,
  options?: EngineOptions,
): Promise<RecoveryOffer> {
  const { repo, audit, now } = resolve(options);
  const offer = await loadTenantOffer(repo, companyId, offerId);
  if (offer.status === "declined") return offer;
  const declined = transitionOffer(offer, "declined", now);
  await repo.saveOffer(declined);
  await audit.record({ event: "recovery_offer.declined", companyId, detail: offer.id });
  return declined;
}

/** Annule une entrée de liste d'attente — IDEMPOTENT, raison et date conservées. */
export async function cancelWaitlistEntry(
  companyId: string,
  entryId: string,
  reason: string,
  options?: EngineOptions,
): Promise<WaitlistEntry> {
  const { repo, audit, now } = resolve(options);
  const entry = await repo.getWaitlistEntry(entryId);
  if (!entry || entry.companyId !== companyId) throw new GapRecoveryError(`Entrée introuvable pour ce tenant : ${entryId}`);
  if (entry.status === "cancelled") return entry;
  const nowIso = now.toISOString();
  const cancelled: WaitlistEntry = { ...entry, status: "cancelled", cancelledAt: nowIso, cancelReason: reason, updatedAt: nowIso };
  await repo.saveWaitlistEntry(cancelled);
  await audit.record({ event: "waitlist.entry_cancelled", companyId, detail: `${entry.id} · ${reason}` });
  // Une entrée annulée ne doit plus être contactée : ses offres livrables tombent aussi.
  for (const offer of await repo.listOffers(companyId)) {
    if (offer.waitlistEntryId === entry.id && (offer.status === "prepared" || offer.status === "sent")) {
      await repo.saveOffer(transitionOffer(offer, "cancelled", now, { cancelReason: "entrée de liste annulée" }));
      await audit.record({ event: "recovery_offer.cancelled", companyId, detail: `${offer.id} · entrée de liste annulée` });
    }
  }
  return cancelled;
}

/** Annule une plage — IDEMPOTENT ; ses offres livrables sont annulées avec elle. */
export async function cancelAppointmentGap(
  companyId: string,
  gapId: string,
  reason: string,
  options?: EngineOptions,
): Promise<AppointmentGap> {
  const { repo, audit, now } = resolve(options);
  const gap = await repo.getGap(gapId);
  if (!gap || gap.companyId !== companyId) throw new GapRecoveryError(`Plage introuvable pour ce tenant : ${gapId}`);
  if (gap.status === "cancelled") return gap;
  const nowIso = now.toISOString();
  const cancelled: AppointmentGap = { ...gap, status: "cancelled", cancelledAt: nowIso, cancelReason: reason, updatedAt: nowIso };
  await repo.saveGap(cancelled);
  await audit.record({ event: "appointment_gap.cancelled", companyId, detail: `${gap.id} · ${reason}` });
  for (const offer of await repo.listOffers(companyId, gap.id)) {
    if (offer.status === "prepared" || offer.status === "sent") {
      await repo.saveOffer(transitionOffer(offer, "cancelled", now, { cancelReason: "plage annulée" }));
      await audit.record({ event: "recovery_offer.cancelled", companyId, detail: `${offer.id} · plage annulée` });
    }
  }
  return cancelled;
}

/* ------------------------------------------------------------------ */
/* Réponse entrante OUI/NON — la boucle se ferme par texto              */
/* ------------------------------------------------------------------ */

const YES_REPLY = /^\s*(oui|yes)(\s*(svp|s'il vous pla[îi]t|please))?\s*[!.]*\s*$/i;
const NO_REPLY = /^\s*(non|no)(\s*(merci|thanks?|thank you))?\s*[!.]*\s*$/i;

export function isOfferYesReply(body: string): boolean {
  return YES_REPLY.test(body);
}

export function isOfferNoReply(body: string): boolean {
  return NO_REPLY.test(body);
}

/** La plus récente offre ENVOYÉE de ce numéro (même tenant, entrée encore vivante). */
export async function findActionableOfferForPhone(
  companyId: string,
  phone: string,
  options?: EngineOptions,
): Promise<RecoveryOffer | undefined> {
  const { repo } = resolve(options);
  const canon = canonicalPhone(phone);
  const entries = await repo.listWaitlistEntries(companyId);
  const mine = new Set(
    entries.filter((e) => canonicalPhone(e.phone) === canon && e.status !== "cancelled").map((e) => e.id),
  );
  if (mine.size === 0) return undefined;
  const offers = await repo.listOffers(companyId);
  return offers
    .filter((o) => o.status === "sent" && mine.has(o.waitlistEntryId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

/** Fenêtre pendant laquelle une réponse TARDIVE mérite encore une explication (pas un message générique). */
const LATE_REPLY_WINDOW_DAYS = 7;

/**
 * L'offre récente FERMÉE de ce numéro (confirmée, plage comblée entre-temps,
 * ou expirée) — pour répondre honnêtement à un OUI/NON arrivé trop tard.
 */
async function findRecentClosedOfferForPhone(
  companyId: string,
  phone: string,
  options?: EngineOptions,
): Promise<RecoveryOffer | undefined> {
  const { repo, now } = resolve(options);
  const canon = canonicalPhone(phone);
  const entries = await repo.listWaitlistEntries(companyId);
  const mine = new Set(entries.filter((e) => canonicalPhone(e.phone) === canon).map((e) => e.id));
  if (mine.size === 0) return undefined;
  const oldest = new Date(now.getTime() - LATE_REPLY_WINDOW_DAYS * 24 * 3600 * 1000).toISOString();
  return (await repo.listOffers(companyId))
    .filter(
      (o) =>
        mine.has(o.waitlistEntryId) &&
        o.createdAt >= oldest &&
        (o.status === "confirmed" || o.status === "expired" || (o.status === "cancelled" && o.cancelReason === "plage comblée")),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export interface OfferReplyResult {
  handled: boolean;
  /** Réponse SMS prête à retourner à la personne (FR, honnête, jamais de promesse). */
  reply?: string;
}

/**
 * Traite un texto entrant comme réponse à une offre : OUI → confirmée (plage
 * comblée, offres sœurs annulées ET prévenues si `notify` est fourni), NON →
 * déclinée. Une réponse TARDIVE (plage déjà prise, offre expirée, double OUI)
 * reçoit une explication honnête au lieu du message générique. Sans offre du
 * tout, on ne touche à RIEN (handled: false) — le reste du pipeline SMS
 * (STOP, propriétaire, tiers) garde la main.
 */
export async function handleOfferReply(
  company: Company,
  from: string,
  body: string,
  options?: EngineOptions,
  notify?: ConfirmNotifyContext,
): Promise<OfferReplyResult> {
  const yes = isOfferYesReply(body);
  const no = isOfferNoReply(body);
  if (!yes && !no) return { handled: false };

  const offer = await findActionableOfferForPhone(company.id, from, options);
  if (!offer) {
    // Réponse tardive : l'offre de cette personne vient d'être fermée — on
    // explique au lieu de servir le message générique (aucun état ne change).
    const closed = await findRecentClosedOfferForPhone(company.id, from, options);
    if (!closed) return { handled: false };
    if (closed.status === "confirmed") {
      return {
        handled: true,
        reply: yes
          ? `C'est déjà noté ! L'équipe de ${company.name} vous confirme la plage rapidement.`
          : `C'est noté — si vous ne pouvez plus prendre la plage, appelez ${company.name} pour qu'on la libère.`,
      };
    }
    if (closed.status === "expired") {
      return {
        handled: true,
        reply: `Merci pour votre réponse ! Cette offre de ${company.name} a expiré entre-temps, mais vous restez sur la liste — on vous fera signe dès qu'une place se libère. Répondez STOP pour ne plus recevoir ces alertes.`,
      };
    }
    // cancelled · « plage comblée » : quelqu'un d'autre a répondu avant.
    return {
      handled: true,
      reply: yes
        ? `Merci d'avoir répondu ! La plage vient tout juste d'être prise — première réponse l'emporte. Vous restez sur la liste de ${company.name} et on vous fera signe à la prochaine. Répondez STOP pour ne plus recevoir ces alertes.`
        : `C'est noté, merci ! Vous restez sur la liste de ${company.name}. Répondez STOP pour ne plus recevoir ces alertes.`,
    };
  }

  if (yes) {
    await confirmRecoveryOffer(company.id, offer.id, options, notify);
    return {
      handled: true,
      reply: `Parfait, c'est noté ! L'équipe de ${company.name} vous confirme la plage rapidement. Si vous changez d'idée, répondez NON ou appelez-nous.`,
    };
  }
  await declineRecoveryOffer(company.id, offer.id, options);
  return {
    handled: true,
    reply: `C'est noté, merci d'avoir répondu ! Vous restez sur la liste — on vous fera signe si une autre plage se libère. Répondez STOP pour ne plus recevoir ces alertes.`,
  };
}

/* ------------------------------------------------------------------ */
/* Expiration — une offre sans réponse ne vit pas éternellement         */
/* ------------------------------------------------------------------ */

/** Durée de vie par défaut d'une offre/plage sans réponse ni confirmation. */
export const OFFER_TTL_HOURS = 48;

export interface ExpireResult {
  offersExpired: number;
  gapsExpired: number;
}

/**
 * Expire les offres (prepared/sent) et les plages (open/offered) plus vieilles
 * que le TTL. Idempotent et sans surprise : expired est terminal, l'audit trace
 * chaque expiration, et une plage expirée ne crée plus jamais d'offre.
 */
export async function expireStaleGapRecovery(
  company: Company,
  ttlHours = OFFER_TTL_HOURS,
  options?: EngineOptions,
): Promise<ExpireResult> {
  const { repo, audit, now } = resolve(options);
  const cutoff = new Date(now.getTime() - ttlHours * 3600 * 1000).toISOString();
  const result: ExpireResult = { offersExpired: 0, gapsExpired: 0 };

  for (const offer of await repo.listOffers(company.id)) {
    if ((offer.status === "prepared" || offer.status === "sent") && offer.createdAt < cutoff) {
      await repo.saveOffer(transitionOffer(offer, "expired", now));
      await audit.record({ event: "recovery_offer.expired", companyId: company.id, detail: `${offer.id} · sans réponse après ${ttlHours} h` });
      result.offersExpired += 1;
    }
  }
  for (const gap of await repo.listGaps(company.id)) {
    if ((gap.status === "open" || gap.status === "offered") && gap.createdAt < cutoff) {
      await repo.saveGap({ ...gap, status: "expired", updatedAt: now.toISOString() });
      await audit.record({ event: "appointment_gap.expired", companyId: company.id, detail: `${gap.id} · ${gap.humanLabel}` });
      result.gapsExpired += 1;
    }
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Purge Loi 25 — les notes d'entrée sont des extraits de conversation  */
/* ------------------------------------------------------------------ */

/**
 * Vide les `notes` (evidence verbatim de l'intention) des entrées plus vieilles
 * que la rétention du tenant — même contrat que la purge des transcripts :
 * l'entrée opérationnelle survit, le verbatim disparaît. Idempotent.
 */
export async function purgeExpiredWaitlistNotes(
  company: Company,
  options?: EngineOptions,
): Promise<number> {
  const { repo, audit, now } = resolve(options);
  const cutoff = new Date(now.getTime() - company.compliance.retentionDays * 86_400_000).toISOString();
  let purged = 0;
  for (const entry of await repo.listWaitlistEntries(company.id)) {
    if (entry.notes && entry.createdAt < cutoff) {
      await repo.saveWaitlistEntry({ ...entry, notes: undefined, updatedAt: now.toISOString() });
      purged += 1;
    }
  }
  if (purged > 0) {
    await audit.record({
      event: "waitlist.notes_purged",
      companyId: company.id,
      detail: `${purged} note(s) d'intention purgée(s) — rétention ${company.compliance.retentionDays} j`,
    });
  }
  return purged;
}

/* ------------------------------------------------------------------ */
/* Phase 8 (suite) — Envoi consenti par port injectable                 */
/* ------------------------------------------------------------------ */

/** Port d'envoi SMS LÉGER (l'adapter Twilio existant s'y branche tel quel). */
export interface RecoverySmsPort {
  send(to: string, body: string): Promise<{ deliveryId?: string }>;
}

export interface SendPreparedOffersResult {
  sent: RecoveryOffer[];
  blocked: { offer: RecoveryOffer; reason: string }[];
}

/**
 * Envoie les offres PRÉPARÉES d'un tenant. Consent gate FINAL au moment de
 * l'envoi (pas seulement à la préparation) :
 *  - canal sms uniquement (action_only = un humain décide, jamais d'envoi auto) ;
 *  - coffre ADR-018 consulté : révocation ou absence de consentement actif →
 *    l'offre est ANNULÉE (motif conservé), pas envoyée ;
 *  - plage et entrée doivent être encore vivantes (cancel safety) ;
 *  - sans port SMS (Twilio non branché), tout reste `prepared` — honnête.
 */
export async function sendPreparedOffers(
  company: Company,
  consents: ConsentRecord[],
  smsPort: RecoverySmsPort | undefined,
  options?: EngineOptions,
): Promise<SendPreparedOffersResult> {
  const { repo, audit, now } = resolve(options);
  const result: SendPreparedOffersResult = { sent: [], blocked: [] };

  for (const offer of await repo.listOffers(company.id)) {
    if (offer.status !== "prepared" || offer.channel !== "sms") continue;

    const gap = await repo.getGap(offer.gapId);
    const entry = await repo.getWaitlistEntry(offer.waitlistEntryId);
    if (!gap || (gap.status !== "open" && gap.status !== "offered")) {
      result.blocked.push({ offer, reason: "plage non livrable" });
      continue;
    }
    if (!entry || (entry.status !== "active" && entry.status !== "contacted")) {
      result.blocked.push({ offer, reason: "entrée non livrable" });
      continue;
    }
    if (!canFollowUp(consents, entry.phone, "rappel")) {
      const cancelled = await cancelRecoveryOffer(company.id, offer.id, "consentement absent ou révoqué (ADR-018)", { repo, audit, now });
      result.blocked.push({ offer: cancelled, reason: "consentement absent ou révoqué" });
      continue;
    }
    if (!smsPort) {
      result.blocked.push({ offer, reason: "SMS non configuré — offre laissée préparée" });
      continue;
    }

    try {
      const { deliveryId } = await smsPort.send(entry.phone, offer.messagePreview);
      const sent = transitionOffer(offer, "sent", now, { deliveryId });
      await repo.saveOffer(sent);
      await repo.saveWaitlistEntry({ ...entry, status: "contacted", updatedAt: now.toISOString() });
      await audit.record({ event: "recovery_offer.sent", companyId: company.id, detail: `${offer.id} · ${canonicalPhone(entry.phone)}` });
      result.sent.push(sent);
    } catch (err) {
      const failed = transitionOffer(offer, "failed", now);
      await repo.saveOffer(failed);
      await audit.record({
        event: "recovery_offer.failed",
        companyId: company.id,
        detail: `${offer.id} · ${err instanceof Error ? err.message.slice(0, 120) : "erreur d'envoi"}`,
      });
      result.blocked.push({ offer: failed, reason: "échec d'envoi" });
    }
  }
  return result;
}
