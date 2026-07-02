/**
 * Scaly Event Boundary v1 (ADR-020) : sanitizer hostile (secrets, transcript,
 * JSON-safe), append idempotent par (companyId, dedupeKey), isolation tenant,
 * transitions de livraison, mappers Prisma purs, ports substituables et
 * émission réelle depuis le moteur gap-recovery — SANS jamais toucher getStore().
 */
import { describe, expect, it } from "vitest";
import type { RuntimeEvent } from "@/domain/runtime-event";
import {
  RUNTIME_EVENT_TYPES,
  defaultDedupeKey,
  redactPhone,
  sanitizeRuntimeEventPayload,
} from "@/domain/runtime-event";
import {
  EventOutboxError,
  InMemoryEventOutboxRepository,
  appendRuntimeEvent,
  markRuntimeEventDelivery,
  tryAppendRuntimeEvent,
} from "@/services/event-outbox";
import { runtimeEventFromDb, runtimeEventToDb } from "@/server/event-outbox-mappers";
import { OutboxOnlyActionLedger } from "@/services/ports";
import { SEED_COMPANIES } from "@/data/companies";
import {
  InMemoryGapRecoveryRepository,
  confirmRecoveryOffer,
  openAppointmentGap,
  prepareOffersForGap,
  sendPreparedOffers,
  type GapRecoveryAuditEvent,
} from "@/services/gap-recovery";
import type { WaitlistEntry } from "@/domain/gap-recovery";
import type { ConsentRecord } from "@/domain/consent";

const NOW = new Date("2026-07-02T10:00:00-04:00");

function outbox() {
  const repo = new InMemoryEventOutboxRepository();
  return { repo, options: { repo, now: NOW } };
}

describe("redactPhone — jamais un numéro complet dans un payload", () => {
  it("garde seulement les 4 derniers chiffres", () => {
    expect(redactPhone("+1 (819) 414-1269")).toBe("•••1269");
    expect(redactPhone("8195552345")).toBe("•••2345");
  });
  it("valeurs dégénérées → inconnu", () => {
    expect(redactPhone("")).toBe("inconnu");
    expect(redactPhone(undefined)).toBe("inconnu");
    expect(redactPhone("abc")).toBe("inconnu");
  });
});

describe("sanitizeRuntimeEventPayload — payload hostile → payload propre", () => {
  it("caviarde les valeurs qui ressemblent à des secrets", () => {
    const { payload, redactions } = sanitizeRuntimeEventPayload({
      note: "voici sk-abc123def456ghi789jkl012 pour toi",
      db: "postgresql://user:pass@host.neon.tech/db",
      sid: "AC0123456789abcdef0123456789abcdef",
      bearer: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
    });
    expect(payload.note).toBe("[REDACTED]");
    expect(payload.db).toBe("[REDACTED]");
    expect(payload.sid).toBe("[REDACTED]");
    expect(payload.bearer).toBe("[REDACTED]");
    expect(redactions.length).toBeGreaterThanOrEqual(4);
  });

  it("caviarde les clés sensibles peu importe la valeur", () => {
    const { payload } = sanitizeRuntimeEventPayload({
      apiKey: "innocent",
      TWILIO_AUTH_TOKEN: "x",
      databaseUrl: "y",
      normal: "reste",
    });
    expect(payload.apiKey).toBe("[REDACTED]");
    expect(payload.TWILIO_AUTH_TOKEN).toBe("[REDACTED]");
    expect(payload.databaseUrl).toBe("[REDACTED]");
    expect(payload.normal).toBe("reste");
  });

  it("interdit le transcript complet — transcriptRef/summary seulement", () => {
    const { payload, redactions } = sanitizeRuntimeEventPayload({
      transcript: [{ speaker: "caller", text: "verbatim secret" }],
      turns: ["tour 1"],
      transcriptRef: "call_abc",
      summary: "résumé court",
    });
    expect(payload.transcript).toBeUndefined();
    expect(payload.turns).toBeUndefined();
    expect(payload.transcriptRef).toBe("call_abc");
    expect(payload.summary).toBe("résumé court");
    expect(redactions.some((r) => r.includes("transcript"))).toBe(true);
  });

  it("rend JSON-safe : fonctions retirées, Dates → ISO, NaN → null, chaînes bornées", () => {
    const { payload } = sanitizeRuntimeEventPayload({
      fn: () => "jamais",
      when: new Date("2026-07-02T10:00:00.000Z"),
      bad: Number.NaN,
      long: "x".repeat(900),
      nested: { deep: { value: 1 } },
    });
    expect(payload.fn).toBeUndefined();
    expect(payload.when).toBe("2026-07-02T10:00:00.000Z");
    expect(payload.bad).toBeNull();
    expect((payload.long as string).length).toBeLessThanOrEqual(501);
    expect(payload.nested).toEqual({ deep: { value: 1 } });
    // Le résultat complet doit survivre à JSON.stringify sans perte.
    expect(() => JSON.stringify(payload)).not.toThrow();
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
  });

  it("ne jette jamais : cycle → sous-arbre coupé à la profondeur maximale", () => {
    const a: Record<string, unknown> = { name: "a" };
    a.self = a;
    const { payload } = sanitizeRuntimeEventPayload({ a });
    expect(() => JSON.stringify(payload)).not.toThrow();
  });
});

describe("appendRuntimeEvent — idempotence et isolation tenant", () => {
  it("refuse sans companyId ou correlationId", async () => {
    const { options } = outbox();
    await expect(
      appendRuntimeEvent({ companyId: "", type: "call.completed", correlationId: "CA1" }, options),
    ).rejects.toThrow(EventOutboxError);
    await expect(
      appendRuntimeEvent({ companyId: "comp_a", type: "call.completed", correlationId: "" }, options),
    ).rejects.toThrow(EventOutboxError);
  });

  it("même dedupeKey → même événement, une seule écriture (retry Twilio)", async () => {
    const { repo, options } = outbox();
    const first = await appendRuntimeEvent(
      { companyId: "comp_a", type: "call.completed", correlationId: "CA123", payload: { durationSec: 42 } },
      options,
    );
    const second = await appendRuntimeEvent(
      { companyId: "comp_a", type: "call.completed", correlationId: "CA123", payload: { durationSec: 99 } },
      options,
    );
    expect(first.idempotent).toBe(false);
    expect(second.idempotent).toBe(true);
    expect(second.event.id).toBe(first.event.id);
    expect(second.event.payload.durationSec).toBe(42); // l'original gagne
    expect(await repo.listEvents("comp_a")).toHaveLength(1);
  });

  it("le même flux chez un AUTRE tenant reste un événement distinct", async () => {
    const { repo, options } = outbox();
    await appendRuntimeEvent({ companyId: "comp_a", type: "call.completed", correlationId: "CA123" }, options);
    await appendRuntimeEvent({ companyId: "comp_b", type: "call.completed", correlationId: "CA123" }, options);
    expect(await repo.listEvents("comp_a")).toHaveLength(1);
    expect(await repo.listEvents("comp_b")).toHaveLength(1);
  });

  it("contrat complet : source scaly, schemaVersion, statut pending, dedupeKey par défaut", async () => {
    const { options } = outbox();
    const { event } = await appendRuntimeEvent(
      {
        companyId: "comp_a",
        type: "consent.captured",
        correlationId: "CA9",
        externalId: "CA9",
        payload: { phone: redactPhone("819-555-2345"), status: "actif" },
      },
      options,
    );
    expect(event.source).toBe("scaly");
    expect(event.schemaVersion).toBe(1);
    expect(event.status).toBe("pending");
    expect(event.attempts).toBe(0);
    expect(event.dedupeKey).toBe(defaultDedupeKey("consent.captured", "CA9"));
    expect(event.occurredAt).toBe(NOW.toISOString());
    expect(event.payload.phone).toBe("•••2345");
    expect(RUNTIME_EVENT_TYPES).toContain(event.type);
  });

  it("un payload avec secret est caviardé AVANT persistance, avec trace honnête", async () => {
    const { options } = outbox();
    const { event } = await appendRuntimeEvent(
      {
        companyId: "comp_a",
        type: "runtime.failure",
        correlationId: "CA10",
        payload: { error: "connexion postgresql://u:p@db.neon.tech refusée" },
      },
      options,
    );
    expect(event.payload.error).toBe("[REDACTED]");
    expect(Array.isArray(event.payload._redactions)).toBe(true);
  });

  it("tryAppendRuntimeEvent ne jette jamais (repo hostile)", async () => {
    const broken = {
      findEventByDedupeKey: async () => {
        throw new Error("base morte");
      },
    } as unknown as InMemoryEventOutboxRepository;
    const result = await tryAppendRuntimeEvent(
      { companyId: "comp_a", type: "call.completed", correlationId: "CA1" },
      { repo: broken, now: NOW },
    );
    expect(result).toBeUndefined();
  });
});

describe("markRuntimeEventDelivery — transitions du futur dispatcher", () => {
  async function seeded() {
    const { repo, options } = outbox();
    const { event } = await appendRuntimeEvent(
      { companyId: "comp_a", type: "call.completed", correlationId: "CA1" },
      options,
    );
    return { repo, options, event };
  }

  it("pending → delivered incrémente attempts", async () => {
    const { options, event } = await seeded();
    const delivered = await markRuntimeEventDelivery("comp_a", event.id, { ok: true }, options);
    expect(delivered.status).toBe("delivered");
    expect(delivered.attempts).toBe(1);
    expect(delivered.lastError).toBeUndefined();
  });

  it("pending → failed → delivered, avec lastError borné", async () => {
    const { options, event } = await seeded();
    const failed = await markRuntimeEventDelivery("comp_a", event.id, { ok: false, error: "x".repeat(500) }, options);
    expect(failed.status).toBe("failed");
    expect(failed.lastError!.length).toBeLessThanOrEqual(300);
    const delivered = await markRuntimeEventDelivery("comp_a", event.id, { ok: true }, options);
    expect(delivered.status).toBe("delivered");
    expect(delivered.attempts).toBe(2);
  });

  it("delivered est terminal ; mauvais tenant refusé", async () => {
    const { options, event } = await seeded();
    await markRuntimeEventDelivery("comp_a", event.id, { ok: true }, options);
    await expect(markRuntimeEventDelivery("comp_a", event.id, { ok: false }, options)).rejects.toThrow(EventOutboxError);
    await expect(markRuntimeEventDelivery("comp_autre", event.id, { ok: true }, options)).rejects.toThrow(EventOutboxError);
  });
});

describe("deleteByCompany (Loi 25) — scoped au tenant", () => {
  it("supprime uniquement le tenant ciblé et compte", async () => {
    const { repo, options } = outbox();
    await appendRuntimeEvent({ companyId: "A", type: "call.completed", correlationId: "c1" }, options);
    await appendRuntimeEvent({ companyId: "A", type: "call.transferred", correlationId: "c1" }, options);
    await appendRuntimeEvent({ companyId: "B", type: "call.completed", correlationId: "c2" }, options);
    expect(await repo.deleteByCompany("A")).toBe(2);
    expect(await repo.listEvents("A")).toHaveLength(0);
    expect(await repo.listEvents("B")).toHaveLength(1);
  });
});

describe("mappers Prisma — round-trip pur sans base", () => {
  it("domaine -> row -> domaine sans perte (y compris optionnels)", async () => {
    const { options } = outbox();
    const { event } = await appendRuntimeEvent(
      {
        companyId: "comp_a",
        type: "recovery.offer_sent",
        correlationId: "gap_1",
        externalId: "SM123",
        payload: { offerId: "offer_1", phone: "•••2345" },
      },
      options,
    );
    expect(runtimeEventFromDb(runtimeEventToDb(event))).toEqual(event);
    // Variante avec champs optionnels absents.
    const minimal: RuntimeEvent = { ...event, externalId: undefined, lastError: undefined };
    expect(runtimeEventFromDb(runtimeEventToDb(minimal))).toEqual(minimal);
    // Variante failed avec lastError.
    const failed: RuntimeEvent = { ...event, status: "failed", attempts: 3, lastError: "timeout" };
    expect(runtimeEventFromDb(runtimeEventToDb(failed))).toEqual(failed);
  });
});

describe("ports — substituables, sans dépendance réseau", () => {
  it("OutboxOnlyActionLedger accepte un événement sans effet de bord", async () => {
    const { options } = outbox();
    const { event } = await appendRuntimeEvent(
      { companyId: "comp_a", type: "call.completed", correlationId: "CA1" },
      options,
    );
    await expect(new OutboxOnlyActionLedger().appendEvent(event)).resolves.toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/* Émission réelle depuis le moteur gap-recovery (events injecté)       */
/* ------------------------------------------------------------------ */

const DENTAL = SEED_COMPANIES.find((c) => c.id === "comp_sourire")!;

function gapEngine() {
  const repo = new InMemoryGapRecoveryRepository();
  const events = new InMemoryEventOutboxRepository();
  const audits: GapRecoveryAuditEvent[] = [];
  const audit = { record: async (e: GapRecoveryAuditEvent) => void audits.push(e) };
  return { repo, events, audits, options: { repo, audit, events, now: NOW } };
}

function waitEntry(over: Partial<WaitlistEntry> = {}): WaitlistEntry {
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

function consent(phone: string): ConsentRecord {
  return {
    id: `cons_${Math.random().toString(36).slice(2, 8)}`,
    companyId: DENTAL.id,
    phone: phone.replace(/\D/g, "").replace(/^1/, ""),
    kind: "rappel",
    status: "actif",
    verbatim: "Oui, textez-moi si une place se libère",
    channel: "appel",
    capturedAt: "2026-07-01T09:00:00.000Z",
  };
}

describe("gap recovery émet sur la frontière (repo d'événements injecté)", () => {
  it("gap ouvert → recovery.gap_opened UNE fois, même rejoué (idempotence)", async () => {
    const { events, options } = gapEngine();
    const input = { companyId: DENTAL.id, humanLabel: "jeudi 14 h", idempotencyKey: "slot-jeudi-14h" };
    await openAppointmentGap(input, DENTAL, options);
    await openAppointmentGap(input, DENTAL, options); // retour idempotent — pas de ré-émission
    const emitted = await events.listEvents(DENTAL.id);
    expect(emitted.filter((e) => e.type === "recovery.gap_opened")).toHaveLength(1);
    expect(emitted[0].correlationId).toMatch(/^gap_/);
  });

  it("offre envoyée → recovery.offer_sent avec téléphone caviardé ; échec SMS → runtime.failure", async () => {
    const { repo, events, options } = gapEngine();
    await repo.saveWaitlistEntry(waitEntry());
    await repo.saveWaitlistEntry(waitEntry({ phone: "819-555-9999" }));
    const { gap } = await openAppointmentGap({ companyId: DENTAL.id, humanLabel: "jeudi 14 h" }, DENTAL, options);
    await prepareOffersForGap(gap.id, DENTAL, options);

    let first = true;
    const flaky = {
      send: async () => {
        if (first) {
          first = false;
          return { deliveryId: "SM_ok_1" };
        }
        throw new Error("provider 500");
      },
    };
    const consents = [consent("819-555-2345"), consent("819-555-9999")];
    await sendPreparedOffers(DENTAL, consents, flaky, options);

    const emitted = await events.listEvents(DENTAL.id);
    const sent = emitted.filter((e) => e.type === "recovery.offer_sent");
    const failures = emitted.filter((e) => e.type === "runtime.failure");
    expect(sent).toHaveLength(1);
    expect(sent[0].externalId).toBe("SM_ok_1");
    expect(String(sent[0].payload.phone)).toMatch(/^•••\d{4}$/); // jamais le numéro complet
    expect(failures).toHaveLength(1);
    expect(failures[0].payload.component).toBe("sms");
  });

  it("OUI → recovery.offer_confirmed corrélé à la plage", async () => {
    const { repo, events, options } = gapEngine();
    await repo.saveWaitlistEntry(waitEntry());
    const { gap } = await openAppointmentGap({ companyId: DENTAL.id, humanLabel: "jeudi 14 h" }, DENTAL, options);
    const [offer] = await prepareOffersForGap(gap.id, DENTAL, options);
    await sendPreparedOffers(DENTAL, [consent("819-555-2345")], { send: async () => ({ deliveryId: "SM1" }) }, options);

    await confirmRecoveryOffer(DENTAL.id, offer.id, options);
    const confirmedEvents = (await events.listEvents(DENTAL.id)).filter((e) => e.type === "recovery.offer_confirmed");
    expect(confirmedEvents).toHaveLength(1);
    expect(confirmedEvents[0].correlationId).toBe(gap.id);
    expect(confirmedEvents[0].payload.offerId).toBe(offer.id);
  });
});
