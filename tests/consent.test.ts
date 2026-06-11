import { describe, expect, it } from "vitest";
import type { Call, CallIntelligence } from "@/domain/call";
import type { ConsentRecord } from "@/domain/consent";
import { canonicalPhone } from "@/domain/consent";
import { canFollowUp, consentFromCall, isRevocationMessage } from "@/services/consent";
import { planQuoteFollowUps } from "@/services/follow-up";
import { SEED_COMPANIES } from "@/data/companies";

const NOW = new Date("2026-06-11T16:00:00-04:00");

function call(fields: Record<string, string>, over: Partial<Call> = {}): Call {
  const intelligence: CallIntelligence = {
    engine: "rules-v1", summary: "x", intent: "demande_soumission", intentConfidence: 0.9,
    sentiment: "neutre", urgency: "normale", leadQuality: "tiede", estimatedValueCad: 500,
    valueBasis: "bareme_industrie", nextAction: "rappeler_immediatement", tags: [],
    commercialScore: 60, confidence: 0.9, finalStatus: "suivi_requis", collectedFields: fields,
  };
  return {
    id: "call_test", companyId: "comp_belair", direction: "inbound", status: "completed",
    source: "live", fromNumber: "+1 (819) 555-1234", language: "fr",
    startedAt: "2026-06-08T10:00:00-04:00", durationSec: 90, transcript: [], recordingUrl: null,
    intelligence, ...over,
  };
}

function record(over: Partial<ConsentRecord>): ConsentRecord {
  return {
    id: "cons_x", companyId: "comp_belair", phone: "8195551234", kind: "rappel",
    status: "actif", verbatim: "oui", channel: "appel", capturedAt: "2026-06-08T14:00:00.000Z", ...over,
  };
}

describe("canonicalPhone", () => {
  it("normalise les formats nord-américains vers 10 chiffres", () => {
    expect(canonicalPhone("+1 (819) 555-1234")).toBe("8195551234");
    expect(canonicalPhone("819-555-1234")).toBe("8195551234");
  });
});

describe("consentFromCall", () => {
  it("« oui » → consentement actif avec le verbatim exact et le numéro canonique", () => {
    const c = consentFromCall(call({ consentement_rappel: "Oui, pas de problème, rappelez-moi" }), NOW)!;
    expect(c.status).toBe("actif");
    expect(c.phone).toBe("8195551234");
    expect(c.verbatim).toBe("Oui, pas de problème, rappelez-moi");
    expect(c.sourceCallId).toBe("call_test");
  });

  it("« non » → REFUS enregistré (pas une absence)", () => {
    expect(consentFromCall(call({ consentement_rappel: "Non merci, je rappellerai" }), NOW)?.status).toBe("refuse");
  });

  it("réponse ambiguë ou champ absent → null, jamais de consentement inventé", () => {
    expect(consentFromCall(call({ consentement_rappel: "peut-être, on verra" }), NOW)).toBeNull();
    expect(consentFromCall(call({}), NOW)).toBeNull();
  });
});

describe("isRevocationMessage", () => {
  it("reconnaît les mots de retrait FR/EN, insensible à la casse", () => {
    for (const m of ["STOP", "stop", " Arrêt ", "ARRET", "unsubscribe", "Désabonne"]) {
      expect(isRevocationMessage(m), m).toBe(true);
    }
  });

  it("ne confond pas un message normal avec une révocation", () => {
    for (const m of ["stop quand vous voulez demain", "ok pour le rendez-vous", "CHAUDS"]) {
      expect(isRevocationMessage(m), m).toBe(false);
    }
  });
});

describe("canFollowUp", () => {
  it("une révocation l'emporte sur TOUT, même un consentement plus récent", () => {
    const consents = [
      record({ id: "c1", status: "revoque", capturedAt: "2026-06-01T00:00:00.000Z" }),
      record({ id: "c2", status: "actif", capturedAt: "2026-06-10T00:00:00.000Z" }),
    ];
    expect(canFollowUp(consents, "819-555-1234")).toBe(false);
  });

  it("le consentement le plus récent tranche entre refus et oui", () => {
    const refusPuisOui = [
      record({ id: "c1", status: "refuse", capturedAt: "2026-06-01T00:00:00.000Z" }),
      record({ id: "c2", status: "actif", capturedAt: "2026-06-10T00:00:00.000Z" }),
    ];
    expect(canFollowUp(refusPuisOui, "8195551234")).toBe(true);
    const ouiPuisRefus = [
      record({ id: "c1", status: "actif", capturedAt: "2026-06-01T00:00:00.000Z" }),
      record({ id: "c2", status: "refuse", capturedAt: "2026-06-10T00:00:00.000Z" }),
    ];
    expect(canFollowUp(ouiPuisRefus, "8195551234")).toBe(false);
  });

  it("aucun enregistrement → pas de relance", () => {
    expect(canFollowUp([], "8195551234")).toBe(false);
  });
});

describe("planQuoteFollowUps + révocations du coffre", () => {
  const company = SEED_COMPANIES[0];

  it("un numéro révoqué n'est JAMAIS relancé, même avec consentement capté en appel", () => {
    const c = call({ consentement_rappel: "oui parfait" }, { companyId: company.id });
    const sans = planQuoteFollowUps(company, [c], [], NOW);
    expect(sans).toHaveLength(1);
    const avec = planQuoteFollowUps(company, [c], [], NOW, new Set(["8195551234"]));
    expect(avec).toHaveLength(0);
  });
});
