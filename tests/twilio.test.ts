import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { twimlConnectRelay, twimlConnectStream, twimlDial, twimlFallbackTransfer, validateTwilioSignature, xmlEscape } from "@/server/twilio";

describe("TwiML", () => {
  it("échappe le XML (jamais d'injection via nom d'entreprise ou paramètre)", () => {
    expect(xmlEscape(`<Plomberie "Bélair" & Fils>`)).toBe("&lt;Plomberie &quot;Bélair&quot; &amp; Fils&gt;");
  });

  it("Connect/Stream pointe vers le WebSocket realtime avec les paramètres", () => {
    const xml = twimlConnectStream("wss://realtime.scaly.ca/twilio", { companyId: "comp_belair", callSid: "CA123" });
    expect(xml).toContain(`<Connect><Stream url="wss://realtime.scaly.ca/twilio">`);
    expect(xml).toContain(`<Parameter name="companyId" value="comp_belair" />`);
    expect(xml).toContain(`<Parameter name="callSid" value="CA123" />`);
    expect(xml.startsWith(`<?xml version="1.0" encoding="UTF-8"?>`)).toBe(true);
  });

  it("Connect/ConversationRelay pointe vers le prototype A/B avec voix fr-CA et paramètres échappés", () => {
    const xml = twimlConnectRelay(
      "wss://relay.scaly.ca/relay",
      {
        welcomeGreeting: `Plomberie "Bélair", bonjour !`,
        language: "fr-CA",
        ttsProvider: "Amazon",
        voice: "Gabrielle-Neural",
        transcriptionProvider: "Google",
      },
      { companyId: "comp_belair", callSid: "CA123" },
    );
    expect(xml).toContain(`<Connect><ConversationRelay url="wss://relay.scaly.ca/relay"`);
    expect(xml).toContain(`welcomeGreeting="Plomberie &quot;Bélair&quot;, bonjour !"`);
    expect(xml).toContain(`language="fr-CA"`);
    expect(xml).toContain(`ttsProvider="Amazon"`);
    expect(xml).toContain(`voice="Gabrielle-Neural"`);
    expect(xml).toContain(`transcriptionProvider="Google"`);
    expect(xml).not.toContain("speechModel");
    expect(xml).toContain(`<Parameter name="companyId" value="comp_belair" />`);
  });

  it("repli : message FR-CA puis <Dial> vers l'humain — le téléphone ne casse jamais", () => {
    const xml = twimlFallbackTransfer({ to: "514-555-0001", lang: "fr", companyName: "Plomberie Bélair" });
    expect(xml).toContain(`language="fr-CA"`);
    expect(xml).toContain("Plomberie Bélair");
    expect(xml).toContain("<Dial>514-555-0001</Dial>");
  });

  it("repli EN pour une entreprise anglophone", () => {
    const xml = twimlFallbackTransfer({ to: "613-555-0002", lang: "en", companyName: "Ottawa Plumbing" });
    expect(xml).toContain(`language="en-CA"`);
    expect(xml).toContain("<Dial>613-555-0002</Dial>");
  });

  it("twimlDial transfère sans fioritures", () => {
    expect(twimlDial("514-555-0001")).toContain("<Dial>514-555-0001</Dial>");
  });
});

describe("signature Twilio", () => {
  const token = "auth_token_test";
  const url = "https://scaly.example.com/api/voice/incoming";
  const params = { CallSid: "CA42", From: "+15145550182", To: "+15145550001" };

  function sign(t: string, u: string, p: Record<string, string>): string {
    const data = u + Object.keys(p).sort().map((k) => k + p[k]).join("");
    return createHmac("sha1", t).update(Buffer.from(data, "utf-8")).digest("base64");
  }

  it("accepte une signature valide", () => {
    expect(validateTwilioSignature(token, url, params, sign(token, url, params))).toBe(true);
  });

  it("refuse une signature falsifiée, un mauvais token ou des paramètres altérés", () => {
    expect(validateTwilioSignature(token, url, params, "fausse_signature")).toBe(false);
    expect(validateTwilioSignature("autre_token", url, params, sign(token, url, params))).toBe(false);
    expect(validateTwilioSignature(token, url, { ...params, From: "+10000000000" }, sign(token, url, params))).toBe(false);
  });
});
