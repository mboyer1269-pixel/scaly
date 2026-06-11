import { describe, expect, it } from "vitest";
import type { VoiceSession } from "@/domain/voice";
import { advanceVoiceSession, createVoiceSession } from "@/services/voice-runtime";
import { buildVoiceContext } from "@/services/voice-lab";
import { voiceSessionToCall } from "@/services/voice-convert";
import { DEFAULT_COMPANY_ID } from "@/data/companies";

const ctx = buildVoiceContext(DEFAULT_COMPANY_ID, "script_domicile");

function start(seed = 123): VoiceSession {
  return createVoiceSession(ctx, { seed });
}

function say(session: VoiceSession, text: string, opts?: { lang?: "fr" | "en"; interrupt?: boolean }): VoiceSession {
  return advanceVoiceSession(ctx, session, { text, ...opts });
}

/** Empreinte sémantique : tout sauf les ids et horodatages (aléatoires par conception). */
function fingerprint(s: VoiceSession) {
  return {
    state: s.state,
    turns: s.turns.map((t) => ({ speaker: t.speaker, text: t.text, lang: t.lang, atMs: t.atMs, latency: t.latency, interrupted: t.interrupted })),
    fields: s.fields.map((f) => ({ key: f.key, value: f.value, status: f.status, confidence: f.confidence })),
    decisions: s.events.filter((e) => e.type === "decision"),
    detectedUrgency: s.detectedUrgency,
    detectedIntent: s.detectedIntent,
    telemetry: s.telemetry,
  };
}

describe("voice runtime — comportements", () => {
  it("démarre par l'accueil du script dans la langue par défaut", () => {
    const s = start();
    expect(s.turns).toHaveLength(1);
    expect(s.turns[0].speaker).toBe("agent");
    expect(s.turns[0].text).toContain(ctx.company.name);
    expect(s.turns[0].lang).toBe("fr");
    expect(s.state).toBe("greeting");
  });

  it("est déterministe : même seed + mêmes tours → même empreinte", () => {
    const turns = [
      "Bonjour ! J'appelle pour un robinet qui coule. Je m'appelle Martin Leblanc.",
      "C'est le 514-555-0182.",
      "Au 88 rue Principale à Longueuil.",
      "Cette semaine, mercredi matin.",
      "Oui, parfait !",
    ];
    const run = () => turns.reduce((s, t) => say(s, t), start(777));
    expect(fingerprint(run())).toEqual(fingerprint(run()));
  });

  it("les latences simulées sont marquées simulated et restent dans le budget", () => {
    const s = say(say(start(), "Bonjour, c'est pour une prise électrique."), "Je m'appelle Paul Tremblay.");
    const latencies = s.turns.filter((t) => t.speaker === "agent" && t.latency).map((t) => t.latency!);
    expect(latencies.length).toBeGreaterThan(0);
    for (const l of latencies) {
      expect(l.simulated).toBe(true);
      expect(l.perceivedMs).toBe(l.sttMs + l.brainMs + l.ttsMs);
    }
    expect(s.telemetry.latencyBudgetMet).toBe(true);
  });

  it("demande d'humain → transfert immédiat avec raison d'escalade tracée", () => {
    const s = say(start(), "Je veux parler à un humain tout de suite !");
    expect(s.state).toBe("completed");
    expect(s.transfer?.to).toBe(ctx.company.transferPhone);
    expect(s.fields.find((f) => f.key === "escalationReason")?.value).toBeTruthy();
    expect(s.events.some((e) => e.type === "transfer_requested")).toBe(true);
  });

  it("urgence critique : fast-track adresse + téléphone puis transfert", () => {
    let s = start();
    s = say(s, "C'est une urgence, j'ai un dégât d'eau, l'eau monte !");
    expect(s.detectedUrgency).toBe("critique");
    // L'agent ne demande QUE l'essentiel (adresse ou téléphone), pas le nom.
    expect(["address", "phone"]).toContain(s.lastDecision?.targetField);
    s = say(s, "Au 112 rue Lavigne à Brossard !");
    s = say(s, "Le 450-555-0123 !");
    expect(s.transfer).toBeTruthy();
    expect(s.state).toBe("completed");
    expect(s.detectedIntent).toBe("urgence");
  });

  it("spam → refus poli et fin de session sans qualification", () => {
    const s = say(start(), "Bonjour, offre exclusive de référencement pour votre site web !");
    expect(s.state).toBe("completed");
    expect(s.detectedIntent).toBe("spam");
    expect(s.telemetry.fieldsConfirmed).toBe(0);
  });

  it("valeur contradictoire → conflit explicite puis clarification tranchée", () => {
    let s = start();
    s = say(s, "Je m'appelle Luc Gagnon, c'est pour un chauffe-eau.");
    s = say(s, "Mon numéro c'est le 514-555-0001.");
    // Nouvelle valeur contradictoire pour le téléphone.
    s = say(s, "En fait non, prenez plutôt le 438-555-0002.");
    const phone = s.fields.find((f) => f.key === "phone");
    expect(s.events.some((e) => e.type === "field_conflict")).toBe(true);
    expect(s.lastDecision?.action).toBe("clarify_conflict");
    // L'appelant tranche pour la seconde valeur.
    s = say(s, "Le 438-555-0002, c'est le bon.");
    const resolved = s.fields.find((f) => f.key === "phone");
    expect(resolved?.value).toBe("438-555-0002");
    expect(resolved?.status).toBe("confirmed");
    expect(phone).toBeTruthy();
  });

  it("deux tours inaudibles consécutifs → échec propre avec raison", () => {
    let s = say(start(), "Bonjour, c'est pour une prise électrique chez nous.");
    s = say(s, "...");
    expect(s.state).not.toBe("failed");
    s = say(s, "...");
    expect(s.state).toBe("failed");
    expect(s.telemetry.failureReason).toContain("inaudible");
    // La fiche dérivée existe quand même (résumé honnête de ce qu'on sait).
    expect(s.fields.find((f) => f.key === "summary")?.value).toBeTruthy();
  });

  it("barge-in : le tour agent coupé est marqué et l'événement tracé", () => {
    let s = say(start(), "Bonjour, j'ai besoin d'un plombier s'il vous plaît.");
    const agentTurnsBefore = s.turns.filter((t) => t.speaker === "agent").length;
    s = say(s, "Attendez, c'est une urgence là !", { interrupt: true });
    const interrupted = s.turns.filter((t) => t.speaker === "agent" && t.interrupted);
    expect(interrupted).toHaveLength(1);
    expect(s.events.some((e) => e.type === "interruption")).toBe(true);
    expect(s.telemetry.interruptions).toBe(1);
    expect(agentTurnsBefore).toBeGreaterThan(0);
  });

  it("switch de langue : l'agent répond dans la langue du dernier tour appelant", () => {
    let s = say(start(), "Bonjour, c'est pour un chauffe-eau. Je m'appelle Karine Dupuis.");
    s = say(s, "Sorry, can we continue in English?", { lang: "en" });
    const lastAgent = [...s.turns].reverse().find((t) => t.speaker === "agent");
    expect(lastAgent?.lang).toBe("en");
    expect(s.events.some((e) => e.type === "language_switch")).toBe(true);
  });

  it("session terminée = immuable : avancer ne change rien", () => {
    const done = say(start(), "Je veux parler à un humain !");
    expect(done.state).toBe("completed");
    const after = say(done, "Allô ?");
    expect(after).toBe(done);
  });
});

describe("voice → call (boucle de valeur)", () => {
  function fullSession(): VoiceSession {
    let s = start(4242);
    s = say(s, "Bonjour ! C'est pour un robinet qui coule. Je m'appelle Martin Leblanc.");
    s = say(s, "C'est le 514-555-0182.");
    s = say(s, "Au 88 rue Principale à Longueuil.");
    s = say(s, "Cette semaine, mercredi matin.");
    s = say(s, "Oui, c'est parfait, merci !");
    return s;
  }

  it("convertit une session complétée en Call analysé avec actions planifiées", () => {
    const session = fullSession();
    expect(session.state).toBe("completed");
    const { call, actions } = voiceSessionToCall(session, ctx.company, ctx.script);
    expect(call.source).toBe("simulator");
    expect(call.status).toBe("completed");
    expect(call.callerName).toBe("Martin Leblanc");
    expect(call.fromNumber).toBe("514-555-0182");
    expect(call.transcript.length).toBe(session.turns.length);
    expect(call.intelligence).toBeTruthy();
    expect(actions.length).toBeGreaterThan(0);
  });

  it("une session transférée devient un appel « transferred »", () => {
    const s = say(start(), "Je veux parler à un humain !");
    const { call } = voiceSessionToCall(s, ctx.company, ctx.script);
    expect(call.status).toBe("transferred");
  });

  it("un tour interrompu est marqué dans le transcript", () => {
    let s = say(start(), "Bonjour, j'ai besoin d'un plombier.");
    s = say(s, "Attendez, c'est une urgence là ! J'ai un dégât d'eau !", { interrupt: true });
    s = say(s, "Au 112 rue Lavigne à Brossard !");
    s = say(s, "Le 450-555-0123 !");
    const { call } = voiceSessionToCall(s, ctx.company, ctx.script);
    expect(call.transcript.some((t) => t.text.includes("[interrompu]"))).toBe(true);
  });
});
