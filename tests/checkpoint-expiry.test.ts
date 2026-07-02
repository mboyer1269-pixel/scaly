/**
 * Balayeur de brouillons périmés + write conditionnel anti-course.
 * Invariant : un brouillon orphelin devient visible (abandoned + analyse) UNE
 * seule fois, jamais pendant qu'un appel est peut-être encore actif, et aucun
 * write concurrent ne peut écraser un appel finalisé.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryStore } from "@/server/store";
import {
  DEFAULT_CHECKPOINT_STALE_MINUTES,
  checkpointStaleMinutesFromEnv,
  expireStaleCheckpoints,
} from "@/services/checkpoint-expiry";
import type { Call } from "@/domain/call";

const NOW = new Date("2026-07-01T12:00:00.000Z");
const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

function draft(id: string, checkpointAt: string, over: Partial<Call> = {}): Call {
  return {
    id,
    companyId: "comp_belair",
    direction: "inbound",
    status: "in_progress",
    source: "live",
    fromNumber: "+15145550111",
    language: "fr",
    startedAt: "2026-07-01T09:00:00.000Z",
    durationSec: 42,
    transcript: [
      { speaker: "agent", text: "Plomberie Bélair, bonjour !", atMs: 500, lang: "fr" },
      { speaker: "caller", text: "Mon chauffe-eau fuit, c'est urgent.", atMs: 4200, lang: "fr" },
    ],
    recordingUrl: null,
    provenance: { provider: "twilio", externalId: id.replace("call_twilio_", ""), checkpointAt },
    ...over,
  };
}

afterEach(() => {
  restoreEnv();
  vi.resetModules();
  delete (globalThis as { __scalyStore?: unknown }).__scalyStore;
});

describe("expireStaleCheckpoints", () => {
  it("finalise un brouillon périmé : abandoned, transcript conservé, analyse, audit, zéro action", async () => {
    const store = new InMemoryStore();
    await store.saveCall(draft("call_twilio_CA_STALE", "2026-07-01T09:30:00.000Z")); // dernier flush il y a 2 h 30

    const result = await expireStaleCheckpoints(store, { now: NOW });

    expect(result.expired).toBe(1);
    const call = await store.getCall("call_twilio_CA_STALE");
    expect(call?.status).toBe("abandoned");
    expect(call?.provenance?.checkpointAt).toBeUndefined();
    expect(call?.provenance?.externalId).toBe("CA_STALE");
    expect(call?.transcript).toHaveLength(2);
    expect(call?.intelligence?.summary).toBeTruthy();
    expect(await store.listActions("comp_belair", "call_twilio_CA_STALE")).toHaveLength(0);
    const audits = (await store.getAuditLog(50)).filter((a) => a.event === "brouillon_checkpoint_expiré");
    expect(audits).toHaveLength(1);
  });

  it("laisse tranquille un brouillon récent — l'appel est peut-être encore actif", async () => {
    const store = new InMemoryStore();
    await store.saveCall(draft("call_twilio_CA_LIVE", "2026-07-01T11:50:00.000Z")); // flush il y a 10 min

    const result = await expireStaleCheckpoints(store, { now: NOW });

    expect(result.expired).toBe(0);
    expect((await store.getCall("call_twilio_CA_LIVE"))?.status).toBe("in_progress");
  });

  it("rerun cron idempotent : deuxième passage = zéro expiration, zéro audit en double", async () => {
    const store = new InMemoryStore();
    await store.saveCall(draft("call_twilio_CA_TWICE", "2026-07-01T09:00:00.000Z"));

    expect((await expireStaleCheckpoints(store, { now: NOW })).expired).toBe(1);
    expect((await expireStaleCheckpoints(store, { now: NOW })).expired).toBe(0);
    const audits = (await store.getAuditLog(50)).filter((a) => a.event === "brouillon_checkpoint_expiré");
    expect(audits).toHaveLength(1);
  });

  it("ne touche jamais aux appels finalisés, même vieux", async () => {
    const store = new InMemoryStore();
    const before = (await store.listCalls()).map((c) => `${c.id}:${c.status}`).sort();

    await expireStaleCheckpoints(store, { now: NOW });

    const after = (await store.listCalls()).map((c) => `${c.id}:${c.status}`).sort();
    expect(after).toEqual(before);
  });

  it("respecte le seuil configurable", async () => {
    const store = new InMemoryStore();
    await store.saveCall(draft("call_twilio_CA_SEUIL", "2026-07-01T11:00:00.000Z")); // flush il y a 60 min

    // Seuil large : encore vivant. Seuil serré : périmé.
    expect((await expireStaleCheckpoints(store, { now: NOW, staleMinutes: 90 })).expired).toBe(0);
    expect((await expireStaleCheckpoints(store, { now: NOW, staleMinutes: 30 })).expired).toBe(1);
  });

  it("checkpointStaleMinutesFromEnv : défaut 60, valeur valide respectée, 0/invalide → défaut", () => {
    expect(checkpointStaleMinutesFromEnv({})).toBe(DEFAULT_CHECKPOINT_STALE_MINUTES);
    expect(checkpointStaleMinutesFromEnv({ SCALY_CHECKPOINT_STALE_MINUTES: "120" })).toBe(120);
    expect(checkpointStaleMinutesFromEnv({ SCALY_CHECKPOINT_STALE_MINUTES: "0" })).toBe(DEFAULT_CHECKPOINT_STALE_MINUTES);
    expect(checkpointStaleMinutesFromEnv({ SCALY_CHECKPOINT_STALE_MINUTES: "n'importe quoi" })).toBe(DEFAULT_CHECKPOINT_STALE_MINUTES);
  });
});

describe("saveCallUnlessFinalized — le write conditionnel anti-course", () => {
  it("écrit un brouillon absent, met à jour un brouillon vivant, refuse d'écraser un final", async () => {
    const store = new InMemoryStore();
    const d = draft("call_twilio_CA_RACE", "2026-07-01T11:59:00.000Z");

    expect(await store.saveCallUnlessFinalized(d)).toBe(true); // création
    expect(await store.saveCallUnlessFinalized({ ...d, durationSec: 60 })).toBe(true); // brouillon → brouillon

    await store.saveCall({ ...d, status: "completed", provenance: { provider: "twilio", externalId: "CA_RACE" } }); // finalisation
    expect(await store.saveCallUnlessFinalized(d)).toBe(false); // flush zombie refusé
    expect((await store.getCall("call_twilio_CA_RACE"))?.status).toBe("completed");
  });
});

describe("GET /api/cron/purge — balayeur branché au cron", () => {
  it("expire les brouillons périmés et reste idempotent au rerun", async () => {
    process.env.STORE_PROVIDER = "memory";
    process.env.CRON_SECRET = "cron_test_secret";
    const store = new InMemoryStore();
    await store.saveCall(draft("call_twilio_CA_CRON", "2026-07-01T01:00:00.000Z"));
    (globalThis as { __scalyStore?: unknown }).__scalyStore = store;

    const { GET } = await import("@/app/api/cron/purge/route");
    const req = () => new Request("https://scaly.test/api/cron/purge", { headers: { authorization: "Bearer cron_test_secret" } });

    const first = await (await GET(req())).json();
    expect(first.ok).toBe(true);
    expect(first.staleCheckpoints).toBe(1);
    expect((await store.getCall("call_twilio_CA_CRON"))?.status).toBe("abandoned");

    const second = await (await GET(req())).json();
    expect(second.staleCheckpoints).toBe(0);
  });
});
