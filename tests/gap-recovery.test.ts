/**
 * Remplissage intelligent des annulations (appointment_gap_recovery) :
 * registre de capabilities, capture d'intention, plage libérée, matching
 * borné par tenant, offres prudentes idempotentes, cancel safety, consent
 * gate ADR-018 et mappers Prisma — SANS jamais toucher getStore().
 */
import { describe, expect, it } from "vitest";
import type { Call, CallIntelligence } from "@/domain/call";
import type { Company } from "@/domain/company";
import type { ConsentRecord } from "@/domain/consent";
import type { AppointmentGap, RecoveryOffer, WaitlistEntry } from "@/domain/gap-recovery";
import { offerIdempotencyKey } from "@/domain/gap-recovery";
import { CapabilityUnknownError } from "@/domain/capability";
import { CAPABILITY_REGISTRY, findCapability, packSupportsCapability, requireCapability } from "@/data/capabilities";
import { INDUSTRY_PACKS, findIndustryPack, getIndustryPack } from "@/data/industry-packs";
import { SEED_COMPANIES } from "@/data/companies";
import {
  GapRecoveryError,
  InMemoryGapRecoveryRepository,
  buildOfferMessage,
  cancelAppointmentGap,
  cancelRecoveryOffer,
  cancelWaitlistEntry,
  captureWaitlistEntryFromCall,
  confirmRecoveryOffer,
  declineRecoveryOffer,
  detectWaitlistIntent,
  matchWaitlistCandidates,
  openAppointmentGap,
  prepareOffersForGap,
  sendPreparedOffers,
  transitionOffer,
  type GapRecoveryAuditEvent,
} from "@/services/gap-recovery";
import {
  appointmentGapFromDb,
  appointmentGapToDb,
  recoveryOfferFromDb,
  recoveryOfferToDb,
  waitlistEntryFromDb,
  waitlistEntryToDb,
} from "@/server/gap-recovery-mappers";

const NOW = new Date("2026-07-02T10:00:00-04:00");

const DENTAL = SEED_COMPANIES.find((c) => c.id === "comp_sourire")!; // dentiste — pack dédié
const AUTO = SEED_COMPANIES.find((c) => c.id === "comp_horizon")!; // concessionnaire — pack dédié
const NO_PACK = SEED_COMPANIES.find((c) => findIndustryPack(c.industry) === undefined)!; // industrie sans pack

function engine() {
  const repo = new InMemoryGapRecoveryRepository();
  const audits: GapRecoveryAuditEvent[] = [];
  const audit = { record: async (e: GapRecoveryAuditEvent) => void audits.push(e) };
  return { repo, audit, audits, options: { repo, audit, now: NOW } };
}

function call(company: Company, turnsText: string[], fields: Record<string, string> = {}, over: Partial<Call> = {}): Call {
  const intelligence: CallIntelligence = {
    engine: "rules-v1", summary: "x", intent: "prise_rdv", intentConfidence: 0.9,
    sentiment: "neutre", urgency: "normale", leadQuality: "tiede", estimatedValueCad: 200,
    valueBasis: "bareme_industrie", nextAction: "creer_suivi", tags: [],
    commercialScore: 60, confidence: 0.9, finalStatus: "suivi_requis", collectedFields: fields,
  };
  return {
    id: "call_gap_test", companyId: company.id, direction: "inbound", status: "completed",
    source: "live", fromNumber: "+1 (819) 555-2345", language: "fr",
    startedAt: "2026-07-02T09:00:00-04:00", durationSec: 90,
    transcript: turnsText.map((text, i) => ({ speaker: "caller" as const, text, atMs: i * 1000, lang: "fr" as const })),
    recordingUrl: null, intelligence, ...over,
  };
}

function entry(over: Partial<WaitlistEntry> = {}): WaitlistEntry {
  return {
    id: `wait_${Math.random().toString(36).slice(2, 8)}`,
    companyId: DENTAL.id,
    capabilityId: "appointment_gap_recovery",
    callerName: "Julie Tremblay",
    phone: "819-555-2345",
    channelPreference: "sms",
    consentToSms: "yes",
    status: "active",
    createdAt: "2026-07-01T09:00:00.000Z",
    updatedAt: "2026-07-01T09:00:00.000Z",
    ...over,
  };
}

function activeConsent(phone: string, over: Partial<ConsentRecord> = {}): ConsentRecord {
  return {
    id: `cons_${Math.random().toString(36).slice(2, 8)}`, companyId: DENTAL.id,
    phone: phone.replace(/\D/g, "").replace(/^1/, ""), kind: "rappel", status: "actif",
    verbatim: "Oui, textez-moi si une place se libère", channel: "appel",
    capturedAt: "2026-07-01T09:00:00.000Z", ...over,
  };
}

async function openedGap(options: ReturnType<typeof engine>["options"], over: Partial<Parameters<typeof openAppointmentGap>[0]> = {}) {
  return openAppointmentGap(
    { companyId: DENTAL.id, humanLabel: "jeudi 3 juillet à 14 h", serviceCategory: "cleaning", ...over },
    DENTAL,
    options,
  );
}

/* ------------------------------------------------------------------ */

describe("capability registry", () => {
  it("appointment_gap_recovery existe, avec limites basses et règles de sécurité", () => {
    const def = requireCapability("appointment_gap_recovery");
    expect(def.displayName).toBe("Remplissage intelligent des annulations");
    expect(def.defaultLimits.maxCandidatesPerGap).toBeLessThanOrEqual(5);
    expect(def.safetyRules.join(" ")).toMatch(/consentement/i);
    expect(def.safetyRules.join(" ")).toMatch(/tenant/i);
    expect(def.auditEvents).toContain("recovery_offer.prepared");
  });

  it("capability inconnue → échec PROPRE (CapabilityUnknownError), jamais un crash silencieux", () => {
    expect(findCapability("teleportation")).toBeUndefined();
    expect(() => requireCapability("teleportation")).toThrowError(CapabilityUnknownError);
    expect(() => requireCapability("teleportation")).toThrowError(/inconnue/);
  });

  it("tous les packs déclarent appointment_gap_recovery et chaque capability résout dans le registre", () => {
    for (const pack of INDUSTRY_PACKS) {
      expect(pack.capabilities, pack.id).toContain("appointment_gap_recovery");
      for (const id of pack.capabilities) expect(findCapability(id), `${pack.id} → ${id}`).toBeDefined();
      expect(packSupportsCapability(pack, "appointment_gap_recovery"), pack.id).toBe(true);
    }
    expect(Object.keys(CAPABILITY_REGISTRY)).toContain("appointment_gap_recovery");
  });

  it("industrie inconnue → repli PME générale qui supporte la capability, sans crash", () => {
    const fallback = getIndustryPack("metier_inconnu");
    expect(packSupportsCapability(fallback, "appointment_gap_recovery")).toBe(true);
    expect(packSupportsCapability(undefined, "appointment_gap_recovery")).toBe(false);
  });
});

describe("détection d'intention liste d'attente", () => {
  it("reconnaît les formulations FR-QC et EN typiques", () => {
    const phrases = [
      "Appelez-moi si une place se libère",
      "Je peux venir plus tôt s'il y a une annulation",
      "Mettez-moi sur une liste d'attente s'il vous plaît",
      "Textez-moi s'il y a une plage demain",
      "Si quelqu'un annule, je suis disponible",
      "Please text me if there's a cancellation",
      "Put me on the waitlist",
    ];
    for (const p of phrases) {
      expect(detectWaitlistIntent(call(DENTAL, [p])).matched, p).toBe(true);
    }
  });

  it("ne détecte rien dans un appel ordinaire (pas de faux positif « annulation » simple)", () => {
    expect(detectWaitlistIntent(call(DENTAL, ["Je veux annuler mon rendez-vous de jeudi."])).matched).toBe(false);
    expect(detectWaitlistIntent(call(DENTAL, ["J'aimerais un rendez-vous la semaine prochaine."])).matched).toBe(false);
  });
});

describe("capture WaitlistEntry depuis un appel", () => {
  it("persiste l'entrée avec consentement, préférence de canal, catégorie mappée et audit", async () => {
    const { options, repo, audits } = engine();
    const result = await captureWaitlistEntryFromCall(
      call(DENTAL, ["Si une place se libère avant, appelez-moi"], {
        consentement_rappel: "Oui parfait, textez-moi",
        service: "un nettoyage",
        moment: "cette semaine",
      }),
      DENTAL,
      options,
    );
    expect(result.created).toBe(true);
    const saved = (await repo.listWaitlistEntries(DENTAL.id))[0];
    expect(saved.companyId).toBe(DENTAL.id);
    expect(saved.capabilityId).toBe("appointment_gap_recovery");
    expect(saved.consentToSms).toBe("yes");
    expect(saved.channelPreference).toBe("sms");
    expect(saved.desiredServiceCategory).toBe("cleaning");
    expect(saved.preferredTimeWindow).toBe("cette semaine");
    expect(saved.status).toBe("active");
    expect(audits.map((a) => a.event)).toContain("waitlist.entry_created");
  });

  it("companyId manquant sur l'appel → GapRecoveryError (aucune donnée sans tenant)", async () => {
    const { options } = engine();
    const bad = call(DENTAL, ["liste d'attente"], {}, { companyId: "" });
    await expect(captureWaitlistEntryFromCall(bad, DENTAL, options)).rejects.toThrowError(GapRecoveryError);
  });

  it("absence de service/catégorie ne crash pas — champs simplement absents", async () => {
    const { options, repo } = engine();
    const result = await captureWaitlistEntryFromCall(call(DENTAL, ["Si quelqu'un annule, je suis disponible"]), DENTAL, options);
    expect(result.created).toBe(true);
    const saved = (await repo.listWaitlistEntries(DENTAL.id))[0];
    expect(saved.desiredServiceCategory).toBeUndefined();
    expect(saved.consentToSms).toBe("unknown"); // rien capté → jamais inventé
  });

  it("industrie SANS pack → refus propre capability_non_supportee, rien persisté, pas de crash", async () => {
    const { options, repo } = engine();
    const result = await captureWaitlistEntryFromCall(call(NO_PACK, ["Mettez-moi sur la liste d'attente"]), NO_PACK, options);
    expect(result).toEqual({ created: false, reason: "capability_non_supportee" });
    expect(await repo.listWaitlistEntries(NO_PACK.id)).toHaveLength(0);
  });

  it("téléphone inconnu → refus propre, pas d'entrée fantôme", async () => {
    const { options } = engine();
    const result = await captureWaitlistEntryFromCall(
      call(DENTAL, ["liste d'attente"], {}, { fromNumber: "inconnu" }),
      DENTAL,
      options,
    );
    expect(result).toEqual({ created: false, reason: "telephone_manquant" });
  });

  it("idempotent : le même appel (retry) ou le même numéro actif ne crée pas de doublon", async () => {
    const { options, repo } = engine();
    const c = call(DENTAL, ["Appelez-moi si une place se libère"]);
    const first = await captureWaitlistEntryFromCall(c, DENTAL, options);
    const second = await captureWaitlistEntryFromCall(c, DENTAL, options);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.reason).toBe("deja_inscrit");
    expect(second.entry?.id).toBe(first.entry?.id);
    expect(await repo.listWaitlistEntries(DENTAL.id)).toHaveLength(1);
  });

  it("annulation d'entrée : raison + date persistées, ré-annulation idempotente", async () => {
    const { options, repo, audits } = engine();
    const saved = await repo.saveWaitlistEntry(entry());
    const cancelled = await cancelWaitlistEntry(DENTAL.id, saved.id, "la personne a trouvé ailleurs", options);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelReason).toBe("la personne a trouvé ailleurs");
    expect(cancelled.cancelledAt).toBe(NOW.toISOString());
    const again = await cancelWaitlistEntry(DENTAL.id, saved.id, "autre raison", { ...options, now: new Date("2026-07-03T10:00:00Z") });
    expect(again.cancelledAt).toBe(cancelled.cancelledAt); // la première annulation fait foi
    expect(again.cancelReason).toBe("la personne a trouvé ailleurs");
    expect(audits.filter((a) => a.event === "waitlist.entry_cancelled")).toHaveLength(1);
  });
});

describe("AppointmentGap — ouverture, idempotence, annulation", () => {
  it("persiste la plage sans startsAt (humanLabel suffit) et audite appointment_gap.opened", async () => {
    const { options, repo, audits } = engine();
    const { gap } = await openedGap(options, { serviceCategory: undefined });
    expect(gap.companyId).toBe(DENTAL.id);
    expect(gap.humanLabel).toBe("jeudi 3 juillet à 14 h");
    expect(gap.startsAt).toBeUndefined();
    expect((await repo.listGaps(DENTAL.id))[0].id).toBe(gap.id);
    expect(audits.map((a) => a.event)).toContain("appointment_gap.opened");
  });

  it("humanLabel vide → GapRecoveryError propre, rien persisté", async () => {
    const { options, repo } = engine();
    await expect(openedGap(options, { humanLabel: "  " })).rejects.toThrowError(/humanLabel/);
    expect(await repo.listGaps(DENTAL.id)).toHaveLength(0);
  });

  it("idempotencyKey stable : rouvrir la même plage = même gap, aucune offre dupliquée", async () => {
    const { options, repo } = engine();
    await repo.saveWaitlistEntry(entry({ desiredServiceCategory: "cleaning" }));
    const first = await openedGap(options, { idempotencyKey: "annulation-jeudi-14h" });
    const second = await openedGap(options, { idempotencyKey: "annulation-jeudi-14h" });
    expect(second.idempotent).toBe(true);
    expect(second.gap.id).toBe(first.gap.id);
    expect(await repo.listOffers(DENTAL.id)).toHaveLength(first.offers.length);
  });

  it("annulation : raison + date persistées, offres livrables annulées avec, ré-annulation idempotente", async () => {
    const { options, repo, audits } = engine();
    await repo.saveWaitlistEntry(entry({ desiredServiceCategory: "cleaning" }));
    const { gap, offers } = await openedGap(options);
    expect(offers.length).toBeGreaterThan(0);
    const cancelled = await cancelAppointmentGap(DENTAL.id, gap.id, "le patient a repris sa plage", options);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelReason).toBe("le patient a repris sa plage");
    expect(cancelled.cancelledAt).toBe(NOW.toISOString());
    for (const o of await repo.listOffers(DENTAL.id, gap.id)) expect(o.status).toBe("cancelled");
    const again = await cancelAppointmentGap(DENTAL.id, gap.id, "autre", { ...options, now: new Date("2026-07-04T10:00:00Z") });
    expect(again.cancelledAt).toBe(cancelled.cancelledAt);
    expect(audits.map((a) => a.event)).toContain("appointment_gap.cancelled");
  });

  it("une plage annulée ne crée JAMAIS de nouvelle offre", async () => {
    const { options, repo } = engine();
    const { gap } = await openedGap(options); // aucune entrée → aucune offre
    await cancelAppointmentGap(DENTAL.id, gap.id, "annulée", options);
    await repo.saveWaitlistEntry(entry({ desiredServiceCategory: "cleaning" }));
    expect(await prepareOffersForGap(gap.id, DENTAL, options)).toHaveLength(0);
    expect(await repo.listOffers(DENTAL.id, gap.id)).toHaveLength(0);
  });
});

describe("matching — simple mais dur sur les invariants", () => {
  const gap = (over: Partial<AppointmentGap> = {}): AppointmentGap => ({
    id: "gap_x", companyId: DENTAL.id, capabilityId: "appointment_gap_recovery",
    humanLabel: "jeudi 14 h", source: "manual", status: "open",
    createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(), serviceCategory: "cleaning", ...over,
  });

  it("JAMAIS de cross-tenant : le tenant A ne voit pas les entrées du tenant B", () => {
    const candidates = matchWaitlistCandidates(
      [entry({ companyId: AUTO.id, desiredServiceCategory: "cleaning" }), entry({ desiredServiceCategory: "cleaning" })],
      gap(),
      10,
    );
    expect(candidates).toHaveLength(1);
    expect(candidates.every((c) => c.companyId === DENTAL.id)).toBe(true);
  });

  it("statut active seulement, téléphone obligatoire, refus SMS exclu (un refus est FINAL)", () => {
    const candidates = matchWaitlistCandidates(
      [
        entry({ status: "cancelled" }),
        entry({ status: "contacted" }),
        entry({ phone: "" }),
        entry({ consentToSms: "no" }),
        entry({ id: "wait_ok" }),
      ],
      gap({ serviceCategory: undefined }),
      10,
    );
    expect(candidates.map((c) => c.id)).toEqual(["wait_ok"]);
  });

  it("catégorie compatible priorisée, sans catégorie = repli prudent APRÈS, catégorie différente exclue", () => {
    const exact = entry({ id: "wait_exact", desiredServiceCategory: "cleaning", createdAt: "2026-07-01T12:00:00.000Z", updatedAt: "2026-07-01T12:00:00.000Z" });
    const none = entry({ id: "wait_none", desiredServiceCategory: undefined, createdAt: "2026-07-01T08:00:00.000Z", updatedAt: "2026-07-01T08:00:00.000Z" });
    const other = entry({ id: "wait_other", desiredServiceCategory: "emergency" });
    const candidates = matchWaitlistCandidates([none, other, exact], gap(), 10);
    expect(candidates.map((c) => c.id)).toEqual(["wait_exact", "wait_none"]);
  });

  it("ordre : urgence puis premier arrivé ; limite basse respectée", () => {
    const e1 = entry({ id: "w1", urgency: "normale", createdAt: "2026-07-01T08:00:00.000Z" });
    const e2 = entry({ id: "w2", urgency: "haute", createdAt: "2026-07-01T09:00:00.000Z" });
    const e3 = entry({ id: "w3", urgency: "normale", createdAt: "2026-07-01T07:00:00.000Z" });
    const e4 = entry({ id: "w4", urgency: "basse", createdAt: "2026-07-01T06:00:00.000Z" });
    const all = matchWaitlistCandidates([e1, e2, e3, e4], gap({ serviceCategory: undefined }), 10);
    expect(all.map((c) => c.id)).toEqual(["w2", "w3", "w1", "w4"]);
    expect(matchWaitlistCandidates([e1, e2, e3, e4], gap({ serviceCategory: undefined }), 2).map((c) => c.id)).toEqual(["w2", "w3"]);
  });

  it("la limite par défaut de la capability borne les offres préparées", async () => {
    const { options, repo } = engine();
    for (let i = 0; i < 6; i += 1) {
      await repo.saveWaitlistEntry(entry({ id: `wait_${i}`, phone: `819-555-00${i}0`, createdAt: `2026-07-01T0${i}:00:00.000Z` }));
    }
    const { offers } = await openedGap(options, { serviceCategory: undefined });
    expect(offers.length).toBe(requireCapability("appointment_gap_recovery").defaultLimits.maxCandidatesPerGap);
  });
});

describe("RecoveryOffer — message prudent, idempotence, transitions", () => {
  it("le message identifie l'entreprise, cite la plage, demande OUI, offre STOP et ne garantit RIEN", async () => {
    const { options, repo } = engine();
    await repo.saveWaitlistEntry(entry({ desiredServiceCategory: "cleaning" }));
    const { offers } = await openedGap(options);
    const message = offers[0].messagePreview;
    expect(message).toContain(DENTAL.name);
    expect(message).toContain("jeudi 3 juillet à 14 h");
    expect(message).toMatch(/OUI/);
    expect(message).toMatch(/STOP/);
    expect(message).not.toMatch(/garanti/i);
    expect(message).not.toMatch(/réservé pour vous/i);
  });

  it("un gabarit non conforme (promesse de réservation) est REFUSÉ par le moteur", () => {
    const badPack = {
      ...findIndustryPack(DENTAL.industry)!,
      cancellation: {
        ...findIndustryPack(DENTAL.industry)!.cancellation,
        freedSlotSmsTemplate: "Bonjour {name}, votre plage {slot} chez {company} est garantie ! STOP pour arrêter.",
      },
    };
    const g: AppointmentGap = {
      id: "gap_y", companyId: DENTAL.id, capabilityId: "appointment_gap_recovery",
      humanLabel: "jeudi", source: "manual", status: "open", createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
    };
    expect(() => buildOfferMessage(DENTAL, badPack, g, entry())).toThrowError(GapRecoveryError);
  });

  it("idempotencyKey stable et canonique : offer_<gapId>_<entryId>", async () => {
    const { options, repo } = engine();
    const e = await repo.saveWaitlistEntry(entry({ desiredServiceCategory: "cleaning" }));
    const { gap, offers } = await openedGap(options);
    expect(offers[0].idempotencyKey).toBe(offerIdempotencyKey(gap.id, e.id));
    expect(offerIdempotencyKey("g", "w")).toBe(offerIdempotencyKey("g", "w"));
  });

  it("une offre annulée ne peut PAS être envoyée (transition illégale) ; ré-annulation idempotente", async () => {
    const { options, repo } = engine();
    await repo.saveWaitlistEntry(entry());
    const { offers } = await openedGap(options, { serviceCategory: undefined });
    const cancelled = await cancelRecoveryOffer(DENTAL.id, offers[0].id, "le propriétaire a annulé", options);
    expect(cancelled.status).toBe("cancelled");
    expect(() => transitionOffer(cancelled, "sent", NOW)).toThrowError(/Transition illégale/);
    const again = await cancelRecoveryOffer(DENTAL.id, offers[0].id, "autre", { ...options, now: new Date("2026-07-05T10:00:00Z") });
    expect(again.cancelledAt).toBe(cancelled.cancelledAt);
    expect(again.cancelReason).toBe("le propriétaire a annulé");
  });

  it("confirmée : offre → confirmed, entrée → confirmed, plage → filled, offres sœurs annulées", async () => {
    const { options, repo, audits } = engine();
    const e1 = await repo.saveWaitlistEntry(entry({ id: "w1", phone: "819-555-0001", createdAt: "2026-07-01T08:00:00.000Z" }));
    await repo.saveWaitlistEntry(entry({ id: "w2", phone: "819-555-0002", createdAt: "2026-07-01T09:00:00.000Z" }));
    const { gap, offers } = await openedGap(options, { serviceCategory: undefined });
    expect(offers).toHaveLength(2);
    const mine = offers.find((o) => o.waitlistEntryId === e1.id)!;
    const confirmed = await confirmRecoveryOffer(DENTAL.id, mine.id, options);
    expect(confirmed.status).toBe("confirmed");
    expect((await repo.getGap(gap.id))?.status).toBe("filled");
    expect((await repo.getWaitlistEntry(e1.id))?.status).toBe("confirmed");
    const sibling = (await repo.listOffers(DENTAL.id, gap.id)).find((o) => o.id !== mine.id)!;
    expect(sibling.status).toBe("cancelled");
    expect(sibling.cancelReason).toBe("plage comblée");
    expect(audits.map((a) => a.event)).toContain("appointment_gap.filled");
  });

  it("déclinée : n'affecte NI les offres sœurs NI l'entrée", async () => {
    const { options, repo } = engine();
    await repo.saveWaitlistEntry(entry({ id: "w1", phone: "819-555-0001" }));
    const e2 = await repo.saveWaitlistEntry(entry({ id: "w2", phone: "819-555-0002" }));
    const { gap, offers } = await openedGap(options, { serviceCategory: undefined });
    const declined = await declineRecoveryOffer(DENTAL.id, offers[0].id, options);
    expect(declined.status).toBe("declined");
    const sibling = (await repo.listOffers(DENTAL.id, gap.id)).find((o) => o.id !== offers[0].id)!;
    expect(sibling.status).toBe("prepared");
    expect((await repo.getWaitlistEntry(e2.id))?.status).toBe("active");
  });
});

describe("envoi consenti — le consent gate est FINAL au moment de l'envoi", () => {
  function port(sentTo: { to: string; body: string }[]) {
    return { send: async (to: string, body: string) => { sentTo.push({ to, body }); return { deliveryId: `SM${sentTo.length}` }; } };
  }

  it("consentement actif + port SMS → envoyée, entrée contactée, audit recovery_offer.sent", async () => {
    const { options, repo, audits } = engine();
    const e = await repo.saveWaitlistEntry(entry());
    await openedGap(options, { serviceCategory: undefined });
    const sentTo: { to: string; body: string }[] = [];
    const result = await sendPreparedOffers(DENTAL, [activeConsent(e.phone)], port(sentTo), options);
    expect(result.sent).toHaveLength(1);
    expect(result.sent[0].status).toBe("sent");
    expect(result.sent[0].deliveryId).toBe("SM1");
    expect(sentTo[0].body).toMatch(/STOP/);
    expect((await repo.getWaitlistEntry(e.id))?.status).toBe("contacted");
    expect(audits.map((a) => a.event)).toContain("recovery_offer.sent");
  });

  it("révocation STOP dans le coffre → offre ANNULÉE au moment de l'envoi, jamais envoyée", async () => {
    const { options, repo } = engine();
    const e = await repo.saveWaitlistEntry(entry());
    await openedGap(options, { serviceCategory: undefined });
    const consents = [activeConsent(e.phone), activeConsent(e.phone, { status: "revoque", capturedAt: "2026-07-01T10:00:00.000Z" })];
    const sentTo: { to: string; body: string }[] = [];
    const result = await sendPreparedOffers(DENTAL, consents, port(sentTo), options);
    expect(sentTo).toHaveLength(0);
    expect(result.sent).toHaveLength(0);
    expect(result.blocked[0].offer.status).toBe("cancelled");
    expect(result.blocked[0].offer.cancelReason).toMatch(/ADR-018/);
  });

  it("consentement inconnu → canal action_only, JAMAIS de SMS automatique", async () => {
    const { options, repo } = engine();
    const e = await repo.saveWaitlistEntry(entry({ consentToSms: "unknown" }));
    const { offers } = await openedGap(options, { serviceCategory: undefined });
    expect(offers[0].channel).toBe("action_only");
    const sentTo: { to: string; body: string }[] = [];
    const result = await sendPreparedOffers(DENTAL, [activeConsent(e.phone)], port(sentTo), options);
    expect(sentTo).toHaveLength(0);
    expect(result.sent).toHaveLength(0);
    expect((await repo.listOffers(DENTAL.id))[0].status).toBe("prepared"); // un humain décide
  });

  it("sans port SMS (Twilio absent) → tout reste préparé, honnêtement", async () => {
    const { options, repo } = engine();
    const e = await repo.saveWaitlistEntry(entry());
    await openedGap(options, { serviceCategory: undefined });
    const result = await sendPreparedOffers(DENTAL, [activeConsent(e.phone)], undefined, options);
    expect(result.sent).toHaveLength(0);
    expect((await repo.listOffers(DENTAL.id))[0].status).toBe("prepared");
  });

  it("échec d'envoi → statut failed tracé, pas d'exception qui remonte", async () => {
    const { options, repo, audits } = engine();
    const e = await repo.saveWaitlistEntry(entry());
    await openedGap(options, { serviceCategory: undefined });
    const failing = { send: async () => { throw new Error("Twilio 500"); } };
    const result = await sendPreparedOffers(DENTAL, [activeConsent(e.phone)], failing, options);
    expect(result.sent).toHaveLength(0);
    expect((await repo.listOffers(DENTAL.id))[0].status).toBe("failed");
    expect(audits.map((a) => a.event)).toContain("recovery_offer.failed");
  });
});

describe("mappers Prisma — round-trip sans base", () => {
  it("WaitlistEntry : complet et minimal", () => {
    const full = entry({ sourceCallId: "call_1", desiredServiceCategory: "cleaning", desiredServiceLabel: "nettoyage", preferredTimeWindow: "cette semaine", urgency: "haute", notes: "evidence", industryPackId: "pack_dentaire", cancelledAt: "2026-07-02T10:00:00.000Z", cancelReason: "x", status: "cancelled" });
    expect(waitlistEntryFromDb(waitlistEntryToDb(full))).toEqual(full);
    const minimal = entry({ callerName: undefined });
    expect(waitlistEntryFromDb(waitlistEntryToDb(minimal))).toEqual(minimal);
  });

  it("AppointmentGap : complet et minimal", () => {
    const full: AppointmentGap = {
      id: "gap_1", companyId: DENTAL.id, industryPackId: "pack_dentaire", capabilityId: "appointment_gap_recovery",
      serviceCategory: "cleaning", serviceLabel: "Nettoyage", startsAt: "2026-07-03T18:00:00.000Z", endsAt: "2026-07-03T19:00:00.000Z",
      humanLabel: "jeudi 14 h", source: "call", status: "cancelled", idempotencyKey: "k1",
      createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(), cancelledAt: NOW.toISOString(), cancelReason: "y",
    };
    expect(appointmentGapFromDb(appointmentGapToDb(full))).toEqual(full);
    const minimal: AppointmentGap = {
      id: "gap_2", companyId: DENTAL.id, capabilityId: "appointment_gap_recovery",
      humanLabel: "vendredi matin", source: "manual", status: "open",
      createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
    };
    expect(appointmentGapFromDb(appointmentGapToDb(minimal))).toEqual(minimal);
  });

  it("RecoveryOffer : complet et minimal", () => {
    const full: RecoveryOffer = {
      id: "offer_1", companyId: DENTAL.id, gapId: "gap_1", waitlistEntryId: "wait_1", channel: "sms",
      status: "sent", messagePreview: "Bonjour…", deliveryId: "SM123", idempotencyKey: "offer_gap_1_wait_1",
      createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(), sentAt: NOW.toISOString(),
      confirmedAt: NOW.toISOString(), cancelledAt: NOW.toISOString(), cancelReason: "z",
    };
    expect(recoveryOfferFromDb(recoveryOfferToDb(full))).toEqual(full);
    const minimal: RecoveryOffer = {
      id: "offer_2", companyId: DENTAL.id, gapId: "gap_1", waitlistEntryId: "wait_1", channel: "action_only",
      status: "prepared", messagePreview: "Bonjour…", idempotencyKey: "offer_gap_1_wait_1",
      createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
    };
    expect(recoveryOfferFromDb(recoveryOfferToDb(minimal))).toEqual(minimal);
  });
});
