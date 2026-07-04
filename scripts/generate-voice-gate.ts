/**
 * Générateur Voice Gate — OPTIONNEL, jamais appelé en CI.
 * Produit, pour chaque candidate, le MÊME script verrouillé (Maude / Éric / Maude)
 * en MP3 réels → écoute A/B sur /allo-maude/voice-gate. On ne compare que la voix.
 *
 * CONTINUITÉ (stitching) : chaque réplique ElevenLabs reçoit le texte précédent
 * et suivant (`previous_text`/`next_text`) et se chaîne aux requêtes de la MÊME
 * voix (`previous_request_ids`). Résultat : la prosodie et l'accent restent
 * constants du premier au dernier mot — plus de « fin robotique » ni d'« ouverture
 * qui se réchauffe ».
 *
 * Usage :
 *   npm run voice:gate                 # toutes les candidates
 *   npm run voice:gate -- amelie-natural
 *
 * Clés lues depuis .env.local / .env : ELEVENLABS_API_KEY, OPENAI_API_KEY.
 * Sortie ignorée par git : public/voice-gate/**.mp3 + manifest.json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  VOICE_GATE_CANDIDATES,
  VOICE_GATE_SCRIPT,
  voiceGateAudioPath,
  type ElevenSettings,
  type VoiceGateCandidate,
  type VoiceGateManifest,
} from "../src/data/voice-gate";

// tsx ne charge pas .env — chargement minimal, sans dépendance.
for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
}

const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.DEMO_TTS_MODEL ?? "gpt-4o-mini-tts";
const PUBLIC_DIR = join(process.cwd(), "public");

interface Stitch {
  previousText?: string;
  nextText?: string;
  previousRequestIds?: string[];
}

async function synthesizeEleven(
  text: string,
  voiceId: string,
  model: string,
  settings: ElevenSettings,
  stitch: Stitch,
): Promise<{ buf: Buffer; reqId?: string }> {
  // v3 ignore `style` (stabilité discrète 0/0.5/1) — on l'enlève pour éviter un rejet.
  const voiceSettings =
    model === "eleven_v3"
      ? { stability: settings.stability, similarity_boost: settings.similarity_boost, use_speaker_boost: settings.use_speaker_boost }
      : settings;
  const body: Record<string, unknown> = { text, model_id: model, voice_settings: voiceSettings };
  if (model.includes("flash") || model.includes("turbo")) body.language_code = "fr";
  // v3 ne supporte pas encore le stitching (previous_text/next_text/ids).
  if (model !== "eleven_v3") {
    if (stitch.previousText) body.previous_text = stitch.previousText;
    if (stitch.nextText) body.next_text = stitch.nextText;
    if (stitch.previousRequestIds && stitch.previousRequestIds.length) body.previous_request_ids = stitch.previousRequestIds;
  }

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": ELEVEN_KEY as string, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`TTS ElevenLabs ${res.status} — ${(await res.text()).slice(0, 200)}`);
  const reqId = res.headers.get("request-id") ?? res.headers.get("x-request-id") ?? undefined;
  return { buf: Buffer.from(await res.arrayBuffer()), reqId };
}

async function synthesizeOpenAI(text: string, voice: string, instructions: string): Promise<Buffer> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: OPENAI_MODEL, voice, input: text, instructions, response_format: "mp3" }),
  });
  if (!res.ok) throw new Error(`TTS OpenAI ${res.status} — ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

function keyPresentFor(candidate: VoiceGateCandidate): { ok: boolean; missing?: string } {
  if (candidate.provider === "eleven" && !ELEVEN_KEY) return { ok: false, missing: "ELEVENLABS_API_KEY" };
  if (candidate.provider === "openai" && !OPENAI_KEY) return { ok: false, missing: "OPENAI_API_KEY" };
  return { ok: true };
}

function readExistingManifest(path: string): VoiceGateManifest["candidates"] {
  try {
    if (!existsSync(path)) return {};
    return (JSON.parse(readFileSync(path, "utf8")) as VoiceGateManifest).candidates ?? {};
  } catch {
    return {};
  }
}

async function generateCandidate(candidate: VoiceGateCandidate): Promise<{ clips: string[]; model: string }> {
  const clips: string[] = [];
  let model = "openai";
  const idsByVoice = new Map<string, string[]>(); // chaînage par voix (même timbre)

  for (const [index, turn] of VOICE_GATE_SCRIPT.entries()) {
    const source = turn.speaker === "maude" ? candidate.maude : candidate.caller;
    const rel = voiceGateAudioPath(candidate.id, index, turn.speaker);
    const outPath = join(PUBLIC_DIR, ...rel.replace(/^\//, "").split("/"));
    mkdirSync(dirname(outPath), { recursive: true });

    const previousText = index > 0 ? VOICE_GATE_SCRIPT[index - 1].text : undefined;
    const nextText = index < VOICE_GATE_SCRIPT.length - 1 ? VOICE_GATE_SCRIPT[index + 1].text : undefined;

    let buf: Buffer;
    if (source.provider === "eleven") {
      model = source.model;
      const prevIds = idsByVoice.get(source.voiceId) ?? [];
      const out = await synthesizeEleven(turn.text, source.voiceId, source.model, source.settings, {
        previousText,
        nextText,
        previousRequestIds: prevIds,
      });
      buf = out.buf;
      if (out.reqId) idsByVoice.set(source.voiceId, [...prevIds, out.reqId].slice(-3));
    } else {
      buf = await synthesizeOpenAI(turn.text, source.voice, source.instructions);
    }

    writeFileSync(outPath, buf);
    clips.push(rel);
    console.log(`  ✓ ${rel} (${(buf.length / 1024).toFixed(0)} Ko)`);
  }
  return { clips, model };
}

async function main(): Promise<void> {
  const only = process.argv[2]?.trim();
  const candidates = only ? VOICE_GATE_CANDIDATES.filter((c) => c.id === only) : VOICE_GATE_CANDIDATES;
  if (only && candidates.length === 0) {
    console.error(`✗ Candidate inconnue : « ${only} ». Dispo : ${VOICE_GATE_CANDIDATES.map((c) => c.id).join(", ")}`);
    process.exit(1);
  }
  if (!ELEVEN_KEY) console.warn("! ELEVENLABS_API_KEY absente — candidates ElevenLabs ignorées.");
  if (!OPENAI_KEY) console.warn("! OPENAI_API_KEY absente — candidate baseline OpenAI ignorée.");

  const manifestPath = join(PUBLIC_DIR, "voice-gate", "manifest.json");
  const manifest: VoiceGateManifest = {
    generatedAt: new Date().toISOString(),
    candidates: readExistingManifest(manifestPath), // fusion : on garde ce qui existe déjà
  };

  let generated = 0;
  const skipped: string[] = [];
  for (const candidate of candidates) {
    if (!candidate.available) {
      skipped.push(`${candidate.id} (non dispo)`);
      continue;
    }
    const gate = keyPresentFor(candidate);
    if (!gate.ok) {
      console.warn(`⤳ ${candidate.id} ignorée — ${gate.missing} absente.`);
      skipped.push(`${candidate.id} (${gate.missing})`);
      continue;
    }
    console.log(`\n▶ ${candidate.label} (${candidate.id}) — ${candidate.providerLabel}`);
    try {
      const { clips, model } = await generateCandidate(candidate);
      manifest.candidates[candidate.id] = { clips, provider: candidate.provider, model };
      generated += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${candidate.id} échouée — ${msg}`);
      skipped.push(`${candidate.id} (${msg})`);
    }
  }

  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\n✓ ${generated} candidate(s) générée(s). Manifest : ${manifestPath}`);
  if (skipped.length) console.log(`⚠ Ignorées/échouées : ${skipped.join(" · ")}`);
  console.log("  Ouvre /allo-maude/voice-gate pour l'écoute A/B.");
}

main().catch((err) => {
  console.error(`\n✗ Génération interrompue : ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
