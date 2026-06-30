import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryStore } from "@/server/store";
import { verifyRelaySessionToken } from "@/server/twilio";

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
  await store.updateCompany("comp_rivnord", {
    twilioPhoneNumber: "+15145550002",
    transferPhone: "+15145550992",
  });
  setStore(store);
  return store;
}

afterEach(() => {
  restoreEnv();
  vi.resetModules();
  delete (globalThis as { __scalyStore?: unknown }).__scalyStore;
});

describe("PR3 Twilio tenant routing", () => {
  it("route un appel voix par numéro Twilio appelé, persiste l'appel live et la preuve", async () => {
    process.env.STORE_PROVIDER = "memory";
    process.env.TWILIO_AUTH_TOKEN = "twilio_test_token";
    process.env.SCALY_PUBLIC_URL = "https://scaly.test";
    delete process.env.SCALY_REALTIME_WS_URL;
    const store = await storeWithTwilioNumbers();

    const { POST } = await import("@/app/api/voice/incoming/route");
    const res = await POST(twilioRequest("/api/voice/incoming", {
      CallSid: "CA_PR3_RIVNORD",
      From: "+15145550111",
      To: "+15145550002",
      Called: "+15145550002",
    }));
    const xml = await res.text();

    expect(res.status).toBe(200);
    expect(xml).toContain("Construction Riv-Nord");
    expect(xml).toContain("<Dial>+15145550992</Dial>");

    const rivnordCalls = await store.listCalls("comp_rivnord");
    const belairCalls = await store.listCalls("comp_belair");
    const live = rivnordCalls.find((call) => call.id === "call_twilio_CA_PR3_RIVNORD");
    expect(live).toEqual(expect.objectContaining({
      companyId: "comp_rivnord",
      source: "live",
      status: "transferred",
      fromNumber: "+15145550111",
    }));
    expect(belairCalls.some((call) => call.id === "call_twilio_CA_PR3_RIVNORD")).toBe(false);
    await expect(store.listReadinessEvidence("comp_rivnord", "live_call")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          callId: "call_twilio_CA_PR3_RIVNORD",
          externalId: "CA_PR3_RIVNORD",
          status: "verified",
        }),
      ]),
    );
  });

  it("refuse en TwiML un numéro voix non mappé au lieu de retomber sur le tenant démo", async () => {
    process.env.STORE_PROVIDER = "memory";
    process.env.TWILIO_AUTH_TOKEN = "twilio_test_token";
    process.env.SCALY_PUBLIC_URL = "https://scaly.test";
    const store = await storeWithTwilioNumbers();

    const { POST } = await import("@/app/api/voice/incoming/route");
    const res = await POST(twilioRequest("/api/voice/incoming", {
      CallSid: "CA_PR3_UNKNOWN",
      From: "+15145550111",
      To: "+15145559999",
    }));
    const xml = await res.text();

    expect(res.status).toBe(200);
    expect(xml).toContain("<Reject />");
    expect((await store.listCalls()).some((call) => call.id === "call_twilio_CA_PR3_UNKNOWN")).toBe(false);
  });

  it("refuse un numéro Twilio ambigu plutôt que de choisir un tenant arbitraire", async () => {
    process.env.STORE_PROVIDER = "memory";
    process.env.TWILIO_AUTH_TOKEN = "twilio_test_token";
    process.env.SCALY_PUBLIC_URL = "https://scaly.test";
    const store = new InMemoryStore();
    await store.updateCompany("comp_belair", { twilioPhoneNumber: "+15145550001" });
    await store.updateCompany("comp_rivnord", { twilioPhoneNumber: "+1 (514) 555-0001" });
    setStore(store);

    const { POST } = await import("@/app/api/voice/incoming/route");
    const res = await POST(twilioRequest("/api/voice/incoming", {
      CallSid: "CA_PR3_AMBIGUOUS",
      From: "+15145550111",
      To: "+15145550001",
    }));

    expect(await res.text()).toContain("<Reject />");
    expect((await store.listCalls()).some((call) => call.id === "call_twilio_CA_PR3_AMBIGUOUS")).toBe(false);
  });

  it("route un SMS entrant par numéro Twilio appelé avant d'exposer le digest propriétaire", async () => {
    process.env.STORE_PROVIDER = "memory";
    process.env.TWILIO_AUTH_TOKEN = "twilio_test_token";
    process.env.SCALY_PUBLIC_URL = "https://scaly.test";
    const store = await storeWithTwilioNumbers();

    const { POST } = await import("@/app/api/sms/incoming/route");
    const res = await POST(twilioRequest("/api/sms/incoming", {
      MessageSid: "SM_PR3_RIVNORD",
      From: "+15145550992",
      To: "+15145550002",
      Body: "CHAUDS",
    }));
    const xml = await res.text();

    expect(res.status).toBe(200);
    expect(xml).toContain("client(s) chaud");
    const audit = await store.getAuditLog(5);
    expect(audit).toEqual(expect.arrayContaining([
      expect.objectContaining({ companyId: "comp_rivnord", event: "dialogue_proprietaire" }),
    ]));
  });

  it("signe la session ConversationRelay avec le tenant, l'appel et l'appelant", async () => {
    process.env.STORE_PROVIDER = "memory";
    process.env.TWILIO_AUTH_TOKEN = "twilio_test_token";
    process.env.SCALY_PUBLIC_URL = "https://scaly.test";
    process.env.SCALY_VOICE_ENGINE = "relay";
    process.env.SCALY_RELAY_WS_URL = "wss://relay.scaly.test/relay";
    process.env.REALTIME_SHARED_SECRET = "relay_shared_secret";
    await storeWithTwilioNumbers();

    const { POST } = await import("@/app/api/voice/incoming/route");
    const res = await POST(twilioRequest("/api/voice/incoming", {
      CallSid: "CA_RELAY_SIGNED",
      From: "+15145550111",
      To: "+15145550002",
      Called: "+15145550002",
    }));
    const xml = await res.text();
    const token = xml.match(/<Parameter name="relayToken" value="([^"]+)" \/>/)?.[1];

    expect(res.status).toBe(200);
    expect(xml).toContain("<ConversationRelay");
    expect(token).toBeTruthy();
    expect(verifyRelaySessionToken(
      "relay_shared_secret",
      { companyId: "comp_rivnord", callSid: "CA_RELAY_SIGNED", from: "+15145550111" },
      token ?? "",
    )).toBe(true);
  });
});
