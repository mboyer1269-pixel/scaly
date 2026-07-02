/**
 * /api/voice/fallback — le filet quand le pont realtime meurt PENDANT l'appel.
 * Promesse produit : le téléphone ne casse JAMAIS. Si <Connect> se termine
 * alors que l'appel est actif, Twilio requête l'action et l'appelant est
 * transféré à l'humain au lieu de tomber dans le vide.
 */
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryStore } from "@/server/store";

const ORIGINAL_ENV = { ...process.env };

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
  process.env.TWILIO_AUTH_TOKEN = "twilio_test_token";
  process.env.SCALY_PUBLIC_URL = "https://scaly.test";
}

afterEach(() => {
  restoreEnv();
  vi.resetModules();
  delete (globalThis as { __scalyStore?: unknown }).__scalyStore;
});

describe("POST /api/voice/fallback — pont realtime mort en plein appel", () => {
  it("appel encore actif + stream terminé → <Dial> humain, appel persisté, audit du StreamError", async () => {
    baseEnv();
    const store = await storeWithTwilioNumbers();

    const { POST } = await import("@/app/api/voice/fallback/route");
    const res = await POST(twilioRequest("/api/voice/fallback", {
      CallSid: "CA_BRIDGE_DOWN",
      From: "+15145550111",
      To: "+15145550001",
      Called: "+15145550001",
      CallStatus: "in-progress",
      StreamError: "WebSocket - Connection error",
    }));
    const xml = await res.text();

    expect(res.status).toBe(200);
    expect(xml).toContain("<Dial>+15145550991</Dial>");
    expect(xml).toContain("Plomberie Bélair");

    const call = (await store.listCalls("comp_belair")).find((c) => c.id === "call_twilio_CA_BRIDGE_DOWN");
    expect(call).toEqual(expect.objectContaining({ status: "transferred", source: "live", fromNumber: "+15145550111" }));
    const audit = await store.getAuditLog(10);
    expect(audit).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: "repli_pont_indisponible",
        detail: expect.stringContaining("WebSocket - Connection error"),
      }),
    ]));
  });

  it("appel déjà terminé (l'appelant a raccroché) → <Hangup/> sans faux appel de repli", async () => {
    baseEnv();
    const store = await storeWithTwilioNumbers();

    const { POST } = await import("@/app/api/voice/fallback/route");
    const res = await POST(twilioRequest("/api/voice/fallback", {
      CallSid: "CA_NORMAL_END",
      From: "+15145550111",
      To: "+15145550001",
      Called: "+15145550001",
      CallStatus: "completed",
    }));
    const xml = await res.text();

    expect(res.status).toBe(200);
    expect(xml).toContain("<Hangup />");
    expect(xml).not.toContain("<Dial>");
    expect((await store.listCalls()).some((c) => c.id === "call_twilio_CA_NORMAL_END")).toBe(false);
  });

  it("retry Twilio sur le même CallSid → idempotent, un seul appel persisté", async () => {
    baseEnv();
    const store = await storeWithTwilioNumbers();

    const { POST } = await import("@/app/api/voice/fallback/route");
    const params = {
      CallSid: "CA_RETRY",
      From: "+15145550111",
      To: "+15145550001",
      Called: "+15145550001",
      CallStatus: "in-progress",
    };
    const first = await POST(twilioRequest("/api/voice/fallback", params));
    const second = await POST(twilioRequest("/api/voice/fallback", params));

    expect(await first.text()).toContain("<Dial>+15145550991</Dial>");
    expect(await second.text()).toContain("<Dial>+15145550991</Dial>");
    const calls = (await store.listCalls("comp_belair")).filter((c) => c.provenance?.externalId === "CA_RETRY");
    expect(calls).toHaveLength(1);
  });

  it("refuse une signature Twilio invalide", async () => {
    baseEnv();
    await storeWithTwilioNumbers();

    const { POST } = await import("@/app/api/voice/fallback/route");
    const res = await POST(twilioRequest("/api/voice/fallback", {
      CallSid: "CA_FORGED",
      To: "+15145550001",
      CallStatus: "in-progress",
    }, "mauvais_token"));

    expect(res.status).toBe(403);
  });

  it("numéro appelé non mappé → <Hangup/> plutôt qu'un transfert vers un tenant arbitraire", async () => {
    baseEnv();
    await storeWithTwilioNumbers();

    const { POST } = await import("@/app/api/voice/fallback/route");
    const res = await POST(twilioRequest("/api/voice/fallback", {
      CallSid: "CA_NO_TENANT",
      To: "+15145559999",
      CallStatus: "in-progress",
    }));

    expect(await res.text()).toContain("<Hangup />");
  });
});

describe("POST /api/voice/incoming — le TwiML <Connect> porte toujours l'action de repli", () => {
  it("chemin Media Stream : action=/api/voice/fallback présent", async () => {
    baseEnv();
    process.env.SCALY_REALTIME_WS_URL = "wss://realtime.scaly.test/twilio";
    await storeWithTwilioNumbers();

    const { POST } = await import("@/app/api/voice/incoming/route");
    const res = await POST(twilioRequest("/api/voice/incoming", {
      CallSid: "CA_ACTION_STREAM",
      From: "+15145550111",
      To: "+15145550001",
      Called: "+15145550001",
    }));
    const xml = await res.text();

    expect(res.status).toBe(200);
    expect(xml).toContain(`<Connect action="/api/voice/fallback"><Stream`);
  });

  it("chemin ConversationRelay : action=/api/voice/fallback présent", async () => {
    baseEnv();
    process.env.SCALY_VOICE_ENGINE = "relay";
    process.env.SCALY_RELAY_WS_URL = "wss://relay.scaly.test/relay";
    await storeWithTwilioNumbers();

    const { POST } = await import("@/app/api/voice/incoming/route");
    const res = await POST(twilioRequest("/api/voice/incoming", {
      CallSid: "CA_ACTION_RELAY",
      From: "+15145550111",
      To: "+15145550001",
      Called: "+15145550001",
    }));
    const xml = await res.text();

    expect(res.status).toBe(200);
    expect(xml).toContain(`<Connect action="/api/voice/fallback"><ConversationRelay`);
  });
});
