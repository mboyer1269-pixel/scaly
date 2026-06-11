/**
 * scaly-realtime — pont Twilio Media Streams ↔ OpenAI Realtime (P2B).
 * Service Node LONG-LIVED (jamais de Lambda pour l'audio — ADR-005).
 * Usage : npm run realtime  (voir docs/VOICE.md pour le runbook complet).
 *
 * HONNÊTETÉ : sans OPENAI_API_KEY le service démarre, l'annonce sur /health,
 * et refuse les sessions — il ne simule RIEN. Le webhook Next garde de toute
 * façon son repli <Dial> : le téléphone ne casse jamais.
 *
 * Chaîne par appel :
 *  Twilio "start" → contexte via GET /api/voice/context (app Next)
 *  → session OpenAI (prompt construit des MÊMES objets que le Voice Lab)
 *  → audio µ-law passthrough dans les deux sens (zéro transcodage)
 *  → barge-in : VAD speech_started → response.cancel + clear Twilio
 *  → latences RÉELLES par tour (TurnLatencyMeter)
 *  → "stop" → POST /api/voice/complete → Call source:"live" analysé.
 */
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { buildRealtimePrompt } from "../src/services/voice-prompt";
import type { Company } from "../src/domain/company";
import type { VoiceAgentConfig } from "../src/domain/agent";
import type { IndustryScript } from "../src/domain/script";
import type { VoiceTurnLatency } from "../src/domain/voice";
import {
  mapOpenAiEvent,
  openAiAudioAppend,
  openAiSessionUpdate,
  parseTwilioMessage,
  twilioClearFrame,
  twilioMediaFrame,
  TurnLatencyMeter,
} from "./protocol";

const PORT = Number(process.env.REALTIME_PORT ?? 8081);
const APP_URL = process.env.SCALY_APP_URL ?? "http://localhost:3000";
const SECRET = process.env.REALTIME_SHARED_SECRET;
const MODEL = process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime";
const VOICE = process.env.SCALY_REALTIME_VOICE ?? "marin";

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

async function fetchContext(companyId: string): Promise<{ company: Company; agent: VoiceAgentConfig; script: IndustryScript }> {
  const res = await fetch(`${APP_URL}/api/voice/context?companyId=${encodeURIComponent(companyId)}`, {
    headers: SECRET ? { "x-scaly-secret": SECRET } : {},
  });
  if (!res.ok) throw new Error(`Contexte introuvable (${res.status}) — l'app Next tourne-t-elle sur ${APP_URL} ?`);
  return (await res.json()) as { company: Company; agent: VoiceAgentConfig; script: IndustryScript };
}

async function postComplete(log: SessionLog): Promise<void> {
  const res = await fetch(`${APP_URL}/api/voice/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(SECRET ? { "x-scaly-secret": SECRET } : {}) },
    body: JSON.stringify(log),
  });
  if (!res.ok) {
    console.error(`[realtime] /api/voice/complete a refusé l'appel ${log.callSid} : ${res.status} ${await res.text()}`);
  } else {
    const data = (await res.json()) as { callId?: string };
    console.log(`[realtime] Appel ${log.callSid} persisté → ${data.callId}`);
  }
}

/** Transfert humain : redirige l'appel via l'API REST Twilio (TwiML <Dial>). */
async function redirectToHuman(callSid: string, phone: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    console.error("[realtime] Transfert demandé mais TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN absents — impossible de rediriger.");
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
  if (!res.ok) console.error(`[realtime] Échec de redirection Twilio : ${res.status} ${await res.text()}`);
  return res.ok;
}

function handleTwilioConnection(twilioWs: WebSocket): void {
  let streamSid = "";
  let openaiWs: WebSocket | null = null;
  let log: SessionLog | null = null;
  let agentSpeaking = false;
  const meter = new TurnLatencyMeter();
  let pendingLatency: VoiceTurnLatency | null = null;
  const t0 = Date.now();
  const atMs = () => Date.now() - t0;

  twilioWs.on("message", (raw: Buffer) => {
    const msg = parseTwilioMessage(raw.toString());
    if (!msg) return;

    if (msg.event === "start") {
      streamSid = msg.start.streamSid;
      const p = msg.start.customParameters ?? {};
      log = {
        callSid: msg.start.callSid,
        from: p.from ?? "inconnu",
        companyId: p.companyId ?? "",
        startedAt: new Date().toISOString(),
        turns: [],
        transferred: false,
      };
      if (!configured) {
        console.error("[realtime] OPENAI_API_KEY absent — session refusée (le webhook aurait dû servir le repli <Dial>).");
        twilioWs.close();
        return;
      }
      void (async () => {
        try {
          const ctx = await fetchContext(log!.companyId);
          // Le numéro de l'afficheur entre dans le prompt : on CONFIRME le
          // numéro au lieu de le faire dicter (échec observé à l'appel n° 2).
          const prompt = buildRealtimePrompt({ ...ctx, callerNumber: log!.from });
          // API GA : pas de header OpenAI-Beta (rejeté par le GA).
          openaiWs = new WebSocket(`wss://api.openai.com/v1/realtime?model=${encodeURIComponent(MODEL)}`, {
            headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
          });
          openaiWs.on("open", () => {
            openaiWs!.send(JSON.stringify(openAiSessionUpdate(prompt, VOICE, MODEL)));
            // L'agente parle en premier (accueil) : on déclenche la première réponse.
            openaiWs!.send(JSON.stringify({ type: "response.create" }));
            console.log(`[realtime] Session ouverte pour ${log!.callSid} (${ctx.company.name}, modèle ${MODEL})`);
          });
          openaiWs.on("message", (data: Buffer) => {
            const action = mapOpenAiEvent(data.toString());
            switch (action.type) {
              case "agent_audio": {
                const latency = meter.onFirstAudioDelta(atMs());
                if (latency) {
                  pendingLatency = latency;
                  console.log(`[realtime] Latence perçue : ${latency.perceivedMs} ms (réelle, mesurée)`);
                }
                agentSpeaking = true;
                twilioWs.send(twilioMediaFrame(streamSid, action.b64));
                break;
              }
              case "caller_speech_started":
                if (agentSpeaking && openaiWs) {
                  // Barge-in : on coupe la réponse en cours et on vide le tampon Twilio.
                  openaiWs.send(JSON.stringify({ type: "response.cancel" }));
                  twilioWs.send(twilioClearFrame(streamSid));
                  agentSpeaking = false;
                }
                break;
              case "caller_speech_stopped":
                meter.onCallerSpeechStopped(atMs());
                break;
              case "caller_transcript":
                if (action.text && log) log.turns.push({ speaker: "caller", text: action.text, atMs: atMs() });
                break;
              case "agent_transcript":
                if (action.text && log) {
                  log.turns.push({ speaker: "agent", text: action.text, atMs: atMs(), latency: pendingLatency ?? undefined });
                  pendingLatency = null;
                }
                break;
              case "transfer_requested":
                if (log) {
                  log.transferred = true;
                  log.transferReason = action.reason;
                }
                void (async () => {
                  const ok = await redirectToHuman(log!.callSid, ctx.company.transferPhone);
                  console.log(`[realtime] Transfert humain (${action.reason}) : ${ok ? "OK" : "ÉCHEC"}`);
                })();
                break;
              case "response_done":
                agentSpeaking = false;
                break;
              case "error":
                console.error(`[realtime] OpenAI : ${action.message}`);
                break;
            }
          });
          openaiWs.on("close", () => console.log(`[realtime] Session OpenAI fermée (${log?.callSid})`));
          openaiWs.on("error", (err: Error) => console.error(`[realtime] WebSocket OpenAI : ${err.message}`));
        } catch (err) {
          console.error(`[realtime] ${err instanceof Error ? err.message : String(err)}`);
          twilioWs.close();
        }
      })();
      return;
    }

    if (msg.event === "media" && openaiWs?.readyState === WebSocket.OPEN) {
      openaiWs.send(openAiAudioAppend(msg.media.payload));
      return;
    }

    if (msg.event === "stop") {
      openaiWs?.close();
      if (log && log.turns.length > 0) void postComplete(log);
      else if (log) console.log(`[realtime] Appel ${log.callSid} sans transcript — rien à persister.`);
    }
  });

  twilioWs.on("close", () => {
    openaiWs?.close();
  });
}

const server = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        service: "scaly-realtime",
        configured,
        detail: configured
          ? `Prêt — modèle ${MODEL}, voix ${VOICE}, app ${APP_URL}`
          : "OPENAI_API_KEY absent : les sessions sont refusées (aucune simulation). Le webhook sert le repli <Dial>.",
      }),
    );
    return;
  }
  res.writeHead(404).end();
});

const wss = new WebSocketServer({ server, path: "/twilio" });
wss.on("connection", handleTwilioConnection);

server.listen(PORT, () => {
  console.log(`[realtime] scaly-realtime sur :${PORT} (ws /twilio, http /health) — configuré : ${configured}`);
});
