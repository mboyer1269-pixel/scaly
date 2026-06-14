/**
 * scaly-relay — prototype Twilio ConversationRelay ↔ LLM texte (A/B fr-CA).
 * Service Node LONG-LIVED, EN PARALLÈLE du champion (realtime/server.ts:8081)
 * — il ne le remplace pas, il se compare à lui À L'OREILLE (docs/VOICE.md).
 * Usage : npm run relay  · bascule côté app : SCALY_VOICE_ENGINE=relay.
 *
 * Ici Twilio porte l'ASR et la TTS (vraie voix fr-CA native — l'hypothèse du
 * test) : le relais ne voit que du texte. HONNÊTETÉ : sans OPENAI_API_KEY le
 * service démarre, l'annonce sur /health et refuse les sessions — il ne
 * simule RIEN. Le webhook Next garde son repli <Dial> : le téléphone ne
 * casse jamais.
 *
 * Chaîne par appel :
 *  ConversationRelay "setup" → contexte via GET /api/voice/context (app Next)
 *  → prompt champion + règles TTS (withRelayTtsRules — MÊMES objets que le lab)
 *  → "prompt" (transcript) → Chat Completions en streaming → jetons "text"
 *  → barge-in : Twilio coupe la TTS lui-même, nous on avorte le flux LLM
 *  → latence cerveau RÉELLE par tour (RelayLatencyMeter — partielle, assumée)
 *  → fermeture → POST /api/voice/complete → Call source:"live" analysé.
 */
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { buildRealtimePrompt } from "../src/services/voice-prompt";
import type { Company } from "../src/domain/company";
import type { VoiceAgentConfig } from "../src/domain/agent";
import type { IndustryScript } from "../src/domain/script";
import type { VoiceTurnLatency } from "../src/domain/voice";
import {
  ChatStreamAccumulator,
  chatCompletionBody,
  parseRelayMessage,
  RelayLatencyMeter,
  relayTextToken,
  withRelayTtsRules,
} from "./relay-protocol";

const PORT = Number(process.env.REALTIME_RELAY_PORT ?? 8082);
const APP_URL = process.env.SCALY_APP_URL ?? "http://localhost:3000";
const SECRET = process.env.REALTIME_SHARED_SECRET;
// Cerveau texte du prototype : un modèle RAPIDE d'abord — au téléphone, la
// latence prime sur l'éloquence (leçon des appels n° 4-5 côté champion).
const MODEL = process.env.SCALY_RELAY_LLM_MODEL ?? "gpt-4.1-mini";

const configured = Boolean(process.env.OPENAI_API_KEY);

interface SessionLog {
  callSid: string;
  from: string;
  companyId: string;
  startedAt: string;
  turns: { speaker: "agent" | "caller"; text: string; atMs: number; lang?: string; latency?: VoiceTurnLatency }[];
  transferred: boolean;
  transferReason?: string;
}

async function fetchContext(
  companyId: string,
  from: string,
): Promise<{ company: Company; agent: VoiceAgentConfig; script: IndustryScript; knownCaller?: { callCount: number; name?: string; address?: string; lastCallAt?: string } }> {
  const qs = `companyId=${encodeURIComponent(companyId)}&from=${encodeURIComponent(from)}`;
  const res = await fetch(`${APP_URL}/api/voice/context?${qs}`, {
    headers: SECRET ? { "x-scaly-secret": SECRET } : {},
  });
  if (!res.ok) throw new Error(`Contexte introuvable (${res.status}) — l'app Next tourne-t-elle sur ${APP_URL} ?`);
  return (await res.json()) as Awaited<ReturnType<typeof fetchContext>>;
}

async function postComplete(log: SessionLog): Promise<void> {
  const res = await fetch(`${APP_URL}/api/voice/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(SECRET ? { "x-scaly-secret": SECRET } : {}) },
    body: JSON.stringify(log),
  });
  if (!res.ok) {
    console.error(`[relay] /api/voice/complete a refusé l'appel ${log.callSid} : ${res.status} ${await res.text()}`);
  } else {
    const data = (await res.json()) as { callId?: string };
    console.log(`[relay] Appel ${log.callSid} persisté → ${data.callId}`);
  }
}

/** Transfert humain : redirige l'appel via l'API REST Twilio (TwiML <Dial>). */
async function redirectToHuman(callSid: string, phone: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    console.error("[relay] Transfert demandé mais TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN absents — impossible de rediriger.");
    return false;
  }
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Dial>${phone}</Dial></Response>`;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls/${encodeURIComponent(callSid)}.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ Twiml: twiml }).toString(),
  });
  if (!res.ok) console.error(`[relay] Échec de redirection Twilio : ${res.status} ${await res.text()}`);
  return res.ok;
}

/**
 * Un tour LLM en streaming : jetons → Twilio au fil de l'eau (la TTS commence
 * à parler avant la fin), appel d'outil → transfert humain. Retourne le texte
 * complet du tour (transcript de l'agente) ou null si avorté (barge-in).
 */
async function streamLlmTurn(opts: {
  ws: WebSocket;
  messages: { role: string; content: string }[];
  signal: AbortSignal;
  meter: RelayLatencyMeter;
  atMs: () => number;
  onToolCall: (name: string, args: Record<string, unknown>) => void;
}): Promise<{ text: string; latency: VoiceTurnLatency | null } | null> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(chatCompletionBody(MODEL, opts.messages)),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) throw new Error(`Chat Completions : ${res.status} ${await res.text()}`);

  const acc = new ChatStreamAccumulator();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let latency: VoiceTurnLatency | null = null;

  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE : les lignes peuvent arriver coupées — on ne donne à l'accumulateur
    // (pur, testé) que des lignes COMPLÈTES, le reste attend le prochain chunk.
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      for (const action of acc.feedLine(line)) {
        if (action.type === "token") {
          if (text === "") {
            latency = opts.meter.onFirstToken(opts.atMs());
            if (latency) console.log(`[relay] Latence cerveau : ${latency.brainMs} ms (réelle, PARTIELLE — ASR/TTS Twilio non incluses)`);
          }
          text += action.text;
          opts.ws.send(relayTextToken(action.text, false));
        } else if (action.type === "tool_call") {
          opts.onToolCall(action.name, action.args);
        }
      }
    }
  }
  // Sans un last:true final, Twilio ne joue JAMAIS l'audio accumulé.
  opts.ws.send(relayTextToken("", true));
  return { text, latency };
}

function handleRelayConnection(relayWs: WebSocket): void {
  let log: SessionLog | null = null;
  let messages: { role: string; content: string }[] = [];
  let inflight: AbortController | null = null;
  let transferPhone = "";
  const meter = new RelayLatencyMeter();
  const t0 = Date.now();
  const atMs = () => Date.now() - t0;

  relayWs.on("message", (raw: Buffer) => {
    const msg = parseRelayMessage(raw.toString());
    if (!msg) return;

    if (msg.type === "setup") {
      const p = msg.customParameters ?? {};
      log = {
        callSid: msg.callSid,
        from: msg.from ?? p.from ?? "inconnu",
        companyId: p.companyId ?? "",
        startedAt: new Date().toISOString(),
        turns: [],
        transferred: false,
      };
      if (!configured) {
        console.error("[relay] OPENAI_API_KEY absent — session refusée (le webhook aurait dû servir le repli <Dial>).");
        relayWs.close();
        return;
      }
      void (async () => {
        try {
          const ctx = await fetchContext(log!.companyId, log!.from);
          transferPhone = ctx.company.transferPhone;
          const prompt = withRelayTtsRules(buildRealtimePrompt({ ...ctx, callerNumber: log!.from }));
          messages = [{ role: "system", content: prompt }];
          // L'accueil est déjà parlé par Twilio (welcomeGreeting du TwiML) :
          // on l'inscrit dans l'historique pour que le LLM sache qu'il a
          // DÉJÀ salué — sinon il salue deux fois (robot certain).
          const greeting = p.greeting;
          if (greeting) {
            messages.push({ role: "assistant", content: greeting });
            log!.turns.push({ speaker: "agent", text: greeting, atMs: atMs() });
          }
          console.log(`[relay] Session ouverte pour ${log!.callSid} (${ctx.company.name}, modèle ${MODEL})`);
        } catch (err) {
          console.error(`[relay] ${err instanceof Error ? err.message : String(err)}`);
          relayWs.close();
        }
      })();
      return;
    }

    if (msg.type === "prompt") {
      // Transcriptions partielles éventuelles : seul le transcript FINAL parle.
      if (msg.last === false) return;
      const said = msg.voicePrompt.trim();
      if (!said || !log) return;
      log.turns.push({ speaker: "caller", text: said, atMs: atMs(), lang: msg.lang?.toLowerCase().startsWith("en") ? "en" : undefined });
      messages.push({ role: "user", content: said });
      meter.onPromptReceived(atMs());

      inflight?.abort();
      const controller = new AbortController();
      inflight = controller;
      void (async () => {
        try {
          const turn = await streamLlmTurn({
            ws: relayWs,
            messages,
            signal: controller.signal,
            meter,
            atMs,
            onToolCall: (name, args) => {
              if (name !== "transfer_to_human" || !log) return;
              const reason = typeof args.reason === "string" && args.reason ? args.reason : "Transfert demandé par l'agente";
              log.transferred = true;
              log.transferReason = reason;
              // L'annonce part AVANT la redirection — jamais de silence mort.
              relayWs.send(relayTextToken("Je vous transfère tout de suite, restez en ligne.", true));
              void (async () => {
                const ok = await redirectToHuman(log!.callSid, transferPhone);
                console.log(`[relay] Transfert humain (${reason}) : ${ok ? "OK" : "ÉCHEC"}`);
              })();
            },
          });
          if (turn && turn.text && log) {
            messages.push({ role: "assistant", content: turn.text });
            log.turns.push({ speaker: "agent", text: turn.text, atMs: atMs(), latency: turn.latency ?? undefined });
          }
        } catch (err) {
          if (controller.signal.aborted) return; // barge-in ou nouveau tour : avortement voulu
          console.error(`[relay] LLM : ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          if (inflight === controller) inflight = null;
        }
      })();
      return;
    }

    if (msg.type === "interrupt") {
      // Twilio a DÉJÀ coupé la TTS (barge-in géré par ConversationRelay) —
      // nous, on arrête de payer des jetons pour une réponse que plus
      // personne n'écoute, et le transcript garde ce qui a VRAIMENT été dit.
      inflight?.abort();
      inflight = null;
      if (log && msg.utteranceUntilInterrupt) {
        const lastAgent = [...log.turns].reverse().find((t) => t.speaker === "agent");
        if (lastAgent && lastAgent.text.includes(msg.utteranceUntilInterrupt)) {
          lastAgent.text = msg.utteranceUntilInterrupt;
        }
      }
      return;
    }

    if (msg.type === "error") {
      console.error(`[relay] ConversationRelay : ${msg.description ?? "erreur sans description"}`);
    }
  });

  relayWs.on("close", () => {
    inflight?.abort();
    if (log && log.turns.length > 0) void postComplete(log);
    else if (log) console.log(`[relay] Appel ${log.callSid} sans transcript — rien à persister.`);
  });
}

const server = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        service: "scaly-relay",
        configured,
        detail: configured
          ? `Prêt — prototype ConversationRelay, modèle ${MODEL}, app ${APP_URL}`
          : "OPENAI_API_KEY absent : les sessions sont refusées (aucune simulation). Le webhook sert le repli <Dial>.",
      }),
    );
    return;
  }
  res.writeHead(404).end();
});

const wss = new WebSocketServer({ server, path: "/relay" });
wss.on("connection", handleRelayConnection);

server.listen(PORT, () => {
  console.log(`[relay] scaly-relay sur :${PORT} (ws /relay, http /health) — configuré : ${configured}`);
});
