import { describe, expect, it } from "vitest";
import type { Call, CallIntelligence } from "@/domain/call";
import type { Company } from "@/domain/company";
import { DEFAULT_COMPANY_ID, SEED_COMPANIES } from "@/data/companies";
import {
  InMemoryReviewRequestRepository,
  buildReviewMessage,
  createReviewRequestFromCall,
  evaluateReviewEligibility,
  listReviewRequests,
  markReviewRequestFailed,
  markReviewRequestSent,
  markReviewRequestSkipped,
} from "@/services/review-requests";

const NOW = new Date("2026-07-01T12:00:00.000Z");

function repo() {
  return new InMemoryReviewRequestRepository();
}

function companyWithUrl(): Company {
  const c = SEED_COMPANIES.find((x) => x.id === DEFAULT_COMPANY_ID);
  if (!c?.reviewUrl) throw new Error("fixture: compagnie avec reviewUrl attendue");
  return c;
}

function companyWithoutUrl(): Company {
  const c = SEED_COMPANIES.find((x) => x.id === "comp_rivnord");
  if (!c) throw new Error("fixture: comp_rivnord introuvable");
  if (c.reviewUrl) throw new Error("fixture: comp_rivnord ne doit pas avoir de reviewUrl");
  return c;
}

function intel(over: Partial<CallIntelligence> = {}): CallIntelligence {
  return {
    engine: "rules-v1",
    summary: "Rendez-vous confirmé, client satisfait.",
    intent: "prise_rdv",
    intentConfidence: 0.9,
    sentiment: "positif",
    urgency: "basse",
    leadQuality: "chaud",
    estimatedValueCad: 300,
    valueBasis: "bareme_industrie",
    nextAction: "aucune",
    tags: [],
    commercialScore: 60,
    confidence: 0.9,
    finalStatus: "resolu_par_ia",
    collectedFields: {},
    ...over,
  };
}

function call(over: Partial<Call> = {}): Call {
  return {
    id: "call_1",
    companyId: DEFAULT_COMPANY_ID,
    direction: "inbound",
    status: "completed",
    source: "live",
    fromNumber: "514-555-0000",
    callerName: "Mme Roy",
    language: "fr",
    startedAt: NOW.toISOString(),
    durationSec: 90,
    transcript: [],
    recordingUrl: null,
    intelligence: intel(),
    ...over,
  };
}

describe("evaluateReviewEligibility (garde-fous, jamais de faux avis)", () => {
  it("éligible si l'appel est résolu et positif", () => {
    expect(evaluateReviewEligibility(call())).toEqual({ eligible: true, reason: "resolved_positive" });
  });

  it("saute si l'appel est urgent", () => {
    expect(evaluateReviewEligibility(call({ intelligence: intel({ urgency: "critique" }) }))).toEqual({
      eligible: false,
      reason: "call_urgent",
    });
  });

  it("saute si l'appel est escaladé (transféré à un humain)", () => {
    expect(
      evaluateReviewEligibility(call({ intelligence: intel({ finalStatus: "transfere", urgency: "normale" }) })),
    ).toEqual({ eligible: false, reason: "call_escalated" });
  });

  it("saute si l'appel n'est pas résolu", () => {
    expect(
      evaluateReviewEligibility(call({ intelligence: intel({ finalStatus: "suivi_requis", urgency: "normale" }) })),
    ).toEqual({ eligible: false, reason: "call_unresolved" });
  });

  it("saute si le client est insatisfait (sentiment négatif ou plainte)", () => {
    expect(evaluateReviewEligibility(call({ intelligence: intel({ sentiment: "negatif" }) })).reason).toBe(
      "customer_dissatisfied",
    );
    expect(
      evaluateReviewEligibility(call({ intelligence: intel({ intent: "plainte", urgency: "normale" }) })).reason,
    ).toBe("customer_dissatisfied");
  });

  it("saute le spam / fournisseur et les appels sans analyse", () => {
    expect(evaluateReviewEligibility(call({ intelligence: intel({ intent: "spam", finalStatus: "ignore_spam" }) })).reason).toBe(
      "spam_or_supplier",
    );
    expect(evaluateReviewEligibility(call({ intelligence: undefined })).reason).toBe("no_analysis");
  });
});

describe("buildReviewMessage (sobre, FR-CA, jamais inventé)", () => {
  it("est humain, en français, et n'inclut le lien que s'il existe", () => {
    const withUrl = buildReviewMessage(companyWithUrl(), "Mme Roy", companyWithUrl().reviewUrl);
    expect(withUrl).toContain("Bonjour Mme Roy,");
    expect(withUrl).toContain("merci d'avoir contacté");
    expect(withUrl).toContain(companyWithUrl().name);
    expect(withUrl).toContain(companyWithUrl().reviewUrl as string);

    const withoutUrl = buildReviewMessage(companyWithoutUrl(), undefined);
    expect(withoutUrl).toContain("Bonjour,");
    expect(withoutUrl).not.toContain("http");
  });
});

describe("createReviewRequestFromCall", () => {
  it("prépare une demande prête à envoyer quand la config a un lien d'avis", async () => {
    const r = repo();
    const company = companyWithUrl();
    const request = await createReviewRequestFromCall(call({ companyId: company.id }), company, { now: NOW, repo: r });

    expect(request.status).toBe("drafted");
    expect(request.reason).toBe("resolved_positive");
    expect(request.reviewUrl).toBe(company.reviewUrl);
    expect(request.message).toContain(company.reviewUrl as string);
    expect(request.customerName).toBe("Mme Roy");
    expect(request.sourceCallId).toBe("call_1");
  });

  it("n'invente JAMAIS de lien : sans config, statut eligible et reviewUrl absent", async () => {
    const r = repo();
    const company = companyWithoutUrl();
    const request = await createReviewRequestFromCall(call({ companyId: company.id }), company, { now: NOW, repo: r });

    expect(request.status).toBe("eligible");
    expect(request.reason).toBe("awaiting_review_url");
    expect(request.reviewUrl).toBeUndefined();
    expect(request.message).not.toContain("http");
  });

  it("crée un enregistrement skipped (mesurable) quand l'appel ne qualifie pas", async () => {
    const r = repo();
    const company = companyWithUrl();
    const request = await createReviewRequestFromCall(
      call({ companyId: company.id, intelligence: intel({ urgency: "critique" }) }),
      company,
      { now: NOW, repo: r },
    );
    expect(request.status).toBe("skipped");
    expect(request.reason).toBe("call_urgent");
    expect(request.message).toBe("");
    expect(request.skippedAt).toBe(NOW.toISOString());
  });

  it("respecte le consentement : canContact=false → skipped no_consent même si l'appel qualifie", async () => {
    const r = repo();
    const company = companyWithUrl();
    const request = await createReviewRequestFromCall(call({ companyId: company.id }), company, {
      now: NOW,
      repo: r,
      canContact: false,
    });
    expect(request.status).toBe("skipped");
    expect(request.reason).toBe("no_consent");
  });
});

describe("cycle de vie et scoping", () => {
  it("markSent / markSkipped / markFailed appliquent la transition et horodatent", async () => {
    const r = repo();
    const company = companyWithUrl();
    const base = await createReviewRequestFromCall(call({ id: "c1", companyId: company.id }), company, { now: NOW, repo: r });

    const sent = await markReviewRequestSent(company.id, base.id, { now: NOW, repo: r });
    expect(sent.status).toBe("sent");
    expect(sent.sentAt).toBe(NOW.toISOString());

    const second = await createReviewRequestFromCall(call({ id: "c2", companyId: company.id }), company, { now: NOW, repo: r });
    const failed = await markReviewRequestFailed(company.id, second.id, "sms indisponible", { now: NOW, repo: r });
    expect(failed.status).toBe("failed");
    expect(failed.failureReason).toBe("sms indisponible");

    const third = await createReviewRequestFromCall(call({ id: "c3", companyId: company.id }), company, { now: NOW, repo: r });
    const skipped = await markReviewRequestSkipped(company.id, third.id, { now: NOW, repo: r });
    expect(skipped.status).toBe("skipped");
    expect(skipped.reason).toBe("owner_skipped");
  });

  it("empêche un tenant de modifier la demande d'un autre", async () => {
    const r = repo();
    const company = companyWithUrl();
    const req = await createReviewRequestFromCall(call({ companyId: company.id }), company, { now: NOW, repo: r });
    await expect(markReviewRequestSent("comp_autre", req.id, { now: NOW, repo: r })).rejects.toThrow();
    await expect(markReviewRequestSkipped("comp_autre", req.id, { now: NOW, repo: r })).rejects.toThrow();
    const untouched = await r.get(req.id);
    expect(untouched?.status).toBe("drafted");
  });

  it("listReviewRequests place les actionnables (drafted, eligible) en tête et filtre par statut", async () => {
    const r = repo();
    const withUrl = companyWithUrl();
    const withoutUrl = companyWithoutUrl();
    // même tenant pour tester le tri : on force le companyId.
    await createReviewRequestFromCall(call({ id: "a", companyId: withUrl.id }), withUrl, { now: NOW, repo: r });
    const eligibleReq = await createReviewRequestFromCall(
      call({ id: "b", companyId: withUrl.id, callerName: "Sans lien" }),
      { ...withoutUrl, id: withUrl.id },
      { now: NOW, repo: r },
    );
    const skipped = await createReviewRequestFromCall(
      call({ id: "c", companyId: withUrl.id, intelligence: intel({ urgency: "critique" }) }),
      withUrl,
      { now: NOW, repo: r },
    );

    const all = await listReviewRequests(withUrl.id, { repo: r });
    expect(all[0]?.status).toBe("drafted");
    expect(all.some((x) => x.id === eligibleReq.id && x.status === "eligible")).toBe(true);
    expect(all[all.length - 1]?.id).toBe(skipped.id);

    const onlyDrafted = await listReviewRequests(withUrl.id, { status: "drafted", repo: r });
    expect(onlyDrafted.every((x) => x.status === "drafted")).toBe(true);
  });
});
