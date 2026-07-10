/**
 * Durabilité transcript — si le pont realtime crash avant /api/voice/complete,
 * le backend garde un brouillon exploitable (checkpoint), le repli humain le
 * transforme en appel transféré ANALYSÉ, et le final le remplace en place.
 * Invariant produit : l'appel est sauvé ET la mémoire est préservée.
 */
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryStore } from "@/server/store";
import { createCheckpointer } from "../realtime/checkpoint";

const ORIGINAL_ENV = { ...process.env };
const PONT_SECRET = "secret_pont_test";

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

function setStore(store: InMemoryStore) {
  (globalThis as { __scalyStore?: unknown }).__scalyStore = store;
}

function sign(url: string, params: Record<string, string>, token: string): string {
  const data = url + Object.keys(params).sort().map((key) => key + params[key]).join("");
  return createHmac("sha1", token).update(Buffer.from(data, "utf-8")).digest("base64");
}

function twilioRequest(path: string, params: Record<string, string>, token = "twilio_test_token") {
  const url = `https://scaly.test${path}`;
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": sign(url, params, token),
    },
    body: new URLSearchParams(params),
  });
}

function jsonRequest(path: string, body: unknown, secret: string | null = PONT_SECRET) {
  return new Request(`https://scaly.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(secret ? { "x-scaly-secret": secret } : {}) },
    body: JSON.stringify(body),
  });
}

async function storeWithTwilioNumbers() {
  const store = new InMemoryStore();
  await store.updateCompany("comp_belair", {
    twilioPhoneNumber: "+15145550001",
    transferPhone: "+15145550991",
  });
  setStore(store);
  return store;
}

function baseEnv() {
  process.env.STORE_PROVIDER = "memory";
  process.env.REALTIME_SHARED_SECRET = PONT_SECRET;
  process.env.TWILIO_AUTH_TOKEN = "twilio_test_token";
  process.env.SCALY_PUBLIC_URL = "https://scaly.test";
}

const TURNS = [
  { speaker: "agent" as const, text: "Plomberie Bélair, bonjour ! Comment puis-je vous aider ?", atMs: 500 },
  { speaker: "caller" as const, text: "Mon chauffe-eau fuit, c'est urgent, je suis à Longueuil.", atMs: 6200 },
];

function checkpointBody(callSid: string, turns = TURNS) {
  return {
    callSid,
    from: "+15145550111",
    companyId: "comp_belair",
    startedAt: "2026-07-01T12:00:00.000Z",
    turns,
  };
}

afterEach(() => {
  restoreEnv();
  vi.resetModules();
  delete (globalThis as { __scalyStore?: unknown }).__scalyStore;
});

describe("POST /api/voice/checkpoint — brouillon vivant pendant l'appel", () => {
  it("accepte un batch valide et persiste un brouillon in_progress invisible des moteurs métier", async () => {
    baseEnv();
    const store = await storeWithTwilioNumbers();

    const { POST } = await import("@/app/api/voice/checkpoint/route");
    const res = await POST(jsonRequest("/api/voice/checkpoint", checkpointBody("CA_CKPT_1")));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual(expect.objectContaining({ callId: "call_twilio_CA_CKPT_1", turns: 2, checkpoint: true }));
    const call = (await store.listCalls("comp_belair")).find((c) => c.id === "call_twilio_CA_CKPT_1");
    expect(call).toEqual(expect.objectContaining({ status: "in_progress", source: "live", fromNumber: "+15145550111" }));
    expect(call?.provenance?.checkpointAt).toBeTruthy();
    expect(call?.transcript).toHaveLength(2);
    expect(call?.intelligence).toBeUndefined();
    expect(await store.listActions("comp_belair", "call_twilio_CA_CKPT_1")).toHaveLength(0);
  });

  it("retry et flushs cumulés : un seul appel, dernier état gagnant, audit unique", async () => {
    baseEnv();
    const store = await storeWithTwilioNumbers();

    const { POST } = await import("@/app/api/voice/checkpoint/route");
    await POST(jsonRequest("/api/voice/checkpoint", checkpointBody("CA_CKPT_RETRY", TURNS.slice(0, 1))));
    await POST(jsonRequest("/api/voice/checkpoint", checkpointBody("CA_CKPT_RETRY", TURNS.slice(0, 1)))); // retry du même batch
    await POST(jsonRequest("/api/voice/checkpoint", checkpointBody("CA_CKPT_RETRY", TURNS))); // flush cumulé suivant

    const calls = (await store.listCalls("comp_belair")).filter((c) => c.provenance?.externalId === "CA_CKPT_RETRY");
    expect(calls).toHaveLength(1);
    expect(calls[0].transcript).toHaveLength(2);
    const audits = (await store.getAuditLog(50)).filter((a) => a.event === "transcript_checkpoint_ouvert");
    expect(audits).toHaveLength(1);
  });

  it("refuse un secret invalide, un corps incomplet et une entreprise inconnue", async () => {
    baseEnv();
    await storeWithTwilioNumbers();

    const { POST } = await import("@/app/api/voice/checkpoint/route");
    expect((await POST(jsonRequest("/api/voice/checkpoint", checkpointBody("CA_X"), "mauvais_secret"))).status).toBe(401);
    expect((await POST(jsonRequest("/api/voice/checkpoint", { companyId: "comp_belair", turns: TURNS }))).status).toBe(400);
    expect((await POST(jsonRequest("/api/voice/checkpoint", { ...checkpointBody("CA_X"), turns: [] }))).status).toBe(400);
    expect((await POST(jsonRequest("/api/voice/checkpoint", { ...checkpointBody("CA_X"), companyId: "comp_fantome" }))).status).toBe(404);
  });

  it("un flush tardif d'un pont zombie n'écrase JAMAIS un appel finalisé", async () => {
    baseEnv();
    const store = await storeWithTwilioNumbers();

    const checkpoint = (await import("@/app/api/voice/checkpoint/route")).POST;
    const complete = (await import("@/app/api/voice/complete/route")).POST;
    await checkpoint(jsonRequest("/api/voice/checkpoint", checkpointBody("CA_ZOMBIE", TURNS.slice(0, 1))));
    await complete(jsonRequest("/api/voice/complete", checkpointBody("CA_ZOMBIE")));
    const res = await checkpoint(jsonRequest("/api/voice/checkpoint", checkpointBody("CA_ZOMBIE", TURNS.slice(0, 1))));

    expect((await res.json()).ignored).toBe(true);
    const call = (await store.listCalls("comp_belair")).find((c) => c.provenance?.externalId === "CA_ZOMBIE");
    expect(call?.status).toBe("completed");
    expect(call?.transcript).toHaveLength(2);
  });
});

describe("finalisation — le final et le repli fusionnent avec le brouillon", () => {
  it("complete après checkpoint : un seul Call, même id, statut completed, checkpointAt retiré", async () => {
    baseEnv();
    const store = await storeWithTwilioNumbers();

    const checkpoint = (await import("@/app/api/voice/checkpoint/route")).POST;
    const complete = (await import("@/app/api/voice/complete/route")).POST;
    await checkpoint(jsonRequest("/api/voice/checkpoint", checkpointBody("CA_MERGE", TURNS.slice(0, 1))));
    const res = await complete(jsonRequest("/api/voice/complete", checkpointBody("CA_MERGE")));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.callId).toBe("call_twilio_CA_MERGE");
    const calls = (await store.listCalls("comp_belair")).filter((c) => c.provenance?.externalId === "CA_MERGE");
    expect(calls).toHaveLength(1);
    expect(calls[0].status).toBe("completed");
    expect(calls[0].transcript).toHaveLength(2);
    expect(calls[0].provenance?.checkpointAt).toBeUndefined();
    expect(calls[0].intelligence?.summary).toBeTruthy();

    // Retry du final : idempotent, ne recrée rien.
    const retry = await complete(jsonRequest("/api/voice/complete", checkpointBody("CA_MERGE")));
    expect((await retry.json()).idempotent).toBe(true);
    expect((await store.listCalls("comp_belair")).filter((c) => c.provenance?.externalId === "CA_MERGE")).toHaveLength(1);
  });

  it("CRASH avant final : le repli humain préserve le transcript partiel réel et produit un résumé exploitable", async () => {
    baseEnv();
    const store = await storeWithTwilioNumbers();

    const checkpoint = (await import("@/app/api/voice/checkpoint/route")).POST;
    const fallback = (await import("@/app/api/voice/fallback/route")).POST;
    await checkpoint(jsonRequest("/api/voice/checkpoint", checkpointBody("CA_CRASH")));
    // Le pont meurt → Twilio requête l'action <Connect> avec l'appel encore actif.
    const res = await fallback(twilioRequest("/api/voice/fallback", {
      CallSid: "CA_CRASH",
      From: "+15145550111",
      To: "+15145550001",
      Called: "+15145550001",
      CallStatus: "in-progress",
      StreamError: "WebSocket - Connection error",
    }));
    const xml = await res.text();

    expect(xml).toContain("<Dial>+15145550991</Dial>");
    const calls = (await store.listCalls("comp_belair")).filter((c) => c.provenance?.externalId === "CA_CRASH");
    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call.status).toBe("transferred");
    expect(call.provenance?.checkpointAt).toBeUndefined();
    // Les vrais tours checkpointés sont préservés, la ligne de transfert est ajoutée.
    expect(call.transcript.length).toBe(3);
    expect(call.transcript[1].text).toContain("chauffe-eau");
    // Résumé exploitable pour le propriétaire, malgré le crash.
    expect(call.intelligence?.summary).toBeTruthy();
    expect(call.intelligence?.transferReason).toContain("stream realtime interrompu");

    // Retry du callback action : idempotent.
    await fallback(twilioRequest("/api/voice/fallback", {
      CallSid: "CA_CRASH",
      From: "+15145550111",
      To: "+15145550001",
      Called: "+15145550001",
      CallStatus: "in-progress",
    }));
    expect((await store.listCalls("comp_belair")).filter((c) => c.provenance?.externalId === "CA_CRASH")).toHaveLength(1);
  });
});

describe("createCheckpointer — flush par tour stable, coalescé, jamais bloquant", () => {
  const LOG = () => ({
    callSid: "CA_CP",
    from: "+15145550111",
    companyId: "comp_belair",
    startedAt: "2026-07-01T12:00:00.000Z",
    turns: [{ speaker: "agent", text: "Bonjour", atMs: 100 }] as { speaker: "agent" | "caller"; text: string; atMs: number }[],
  });

  it("coalesce : tours ajoutés pendant un envoi → exactement UN re-flush avec l'état cumulé", async () => {
    const bodies: { turns: unknown[] }[] = [];
    const release: (() => void)[] = [];
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      await new Promise<void>((r) => release.push(r));
      return new Response("{}", { status: 200 });
    });
    const cp = createCheckpointer({ appUrl: "https://scaly.test", secret: "s", fetchImpl: fetchImpl as unknown as typeof fetch });

    const log = LOG();
    cp.onTurn(log); // envoi 1 part (1 tour)
    log.turns.push({ speaker: "caller", text: "Fuite d'eau", atMs: 4000 });
    cp.onTurn(log); // pendant l'envoi → dirty
    log.turns.push({ speaker: "agent", text: "Je note", atMs: 7000 });
    cp.onTurn(log); // toujours dirty, pas de 3e requête
    await vi.waitFor(() => expect(release).toHaveLength(1));
    release[0]();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
    release[1]();
    await cp.idle();

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(bodies[0].turns).toHaveLength(1);
    expect(bodies[1].turns).toHaveLength(3); // l'état le plus récent, pas un batch périmé
  });

  it("un 404 (app sans la route) désactive les checkpoints au lieu de marteler", async () => {
    const fetchImpl = vi.fn(async () => new Response("introuvable", { status: 404 }));
    const cp = createCheckpointer({ appUrl: "https://scaly.test", fetchImpl: fetchImpl as unknown as typeof fetch });

    const log = LOG();
    cp.onTurn(log);
    await cp.idle();
    cp.onTurn(log);
    await cp.idle();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("un échec réseau ne se propage jamais (l'audio temps réel reste intouché)", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const cp = createCheckpointer({ appUrl: "https://scaly.test", fetchImpl: fetchImpl as unknown as typeof fetch });

    const log = LOG();
    expect(() => cp.onTurn(log)).not.toThrow();
    await cp.idle();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
