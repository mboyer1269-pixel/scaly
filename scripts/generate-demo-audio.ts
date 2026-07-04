/**
 * Générateur audio des démos — OPTIONNEL, jamais appelé en CI.
 * Produit un clip MP3 par tour d'appel (voix TTS), à partir du callScript dérivé
 * du VRAI cerveau (src/services/pack-demo) → ce qu'on entend = ce que le cerveau
 * produit. Écrit aussi public/demo-audio/manifest.json.
 *
 * Usage :
 *   npm run demo:audio                       # toutes les verticales
 *   npm run demo:audio -- demo_concessionnaire   # une seule (démo héro d'abord)
 *
 * Génération INCRÉMENTALE : le manifest est fusionné, pas écrasé — générer le
 * héro puis les autres plus tard n'efface jamais ce qui existe déjà.
 *
 * Exigences :
 *   - OPENAI_API_KEY dans .env.local / .env (jamais dans le repo).
 *   - Aucune dépendance : appel REST direct (fetch), sortie MP3, zéro ffmpeg.
 *   - Sans clé → échec propre (exit 1), rien généré.
 *
 * Les fichiers générés (public/demo-audio/**.mp3 + manifest.json) sont ignorés
 * par git (.gitignore) : ne pas committer d'audio lourd sans accord explicite.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildAllPackDemoReports } from "../src/services/pack-demo";

// tsx ne charge pas .env — chargement minimal, sans dépendance.
for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
}

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error(
    [
      "✗ OPENAI_API_KEY absente — aucun audio généré.",
      "  Ajoute OPENAI_API_KEY à .env.local puis relance : npm run demo:audio",
      "  (La page /allo-maude/demos reste fonctionnelle : elle affiche un état « Audio premium à générer ».)",
    ].join("\n"),
  );
  process.exit(1);
}

const MODEL = process.env.DEMO_TTS_MODEL ?? "gpt-4o-mini-tts";
const PUBLIC_DIR = join(process.cwd(), "public");

async function synthesize(text: string, voice: string, instructions: string): Promise<Buffer> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, voice, input: text, instructions, response_format: "mp3" }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status} — ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

function estimateDurationSec(texts: { text: string; pauseAfterMs: number }[]): number {
  const ms = texts.reduce((sum, t) => sum + (t.text.length / 14) * 1000 + t.pauseAfterMs, 0);
  return Math.max(1, Math.round(ms / 1000));
}

interface Manifest {
  generatedBy: string;
  generatedAt: string;
  scenarios: Record<string, { clips: string[]; durationEstimateSec: number }>;
}

function readExistingManifest(path: string): Manifest["scenarios"] {
  try {
    if (!existsSync(path)) return {};
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Manifest;
    return parsed.scenarios ?? {};
  } catch {
    return {};
  }
}

async function main(): Promise<void> {
  const only = process.argv[2]?.trim();
  const all = buildAllPackDemoReports();
  const reports = only ? all.filter((r) => r.scenarioId === only) : all;
  if (only && reports.length === 0) {
    console.error(`✗ Scénario inconnu : « ${only} ». Disponibles : ${all.map((r) => r.scenarioId).join(", ")}`);
    process.exit(1);
  }
  console.log(only ? `Génération ciblée : ${only}` : `Génération complète : ${reports.length} verticales`);

  const manifestPath = join(PUBLIC_DIR, "demo-audio", "manifest.json");
  const manifest: Manifest = {
    generatedBy: `openai:${MODEL}`,
    generatedAt: new Date().toISOString(),
    scenarios: readExistingManifest(manifestPath), // fusion : on garde ce qui existe déjà
  };

  for (const report of reports) {
    console.log(`\n▶ ${report.packLabel} (${report.scenarioId}) — ${report.callScript.length} tours`);
    const clips: string[] = [];
    for (const turn of report.callScript) {
      const outPath = join(PUBLIC_DIR, ...turn.audioPath.replace(/^\//, "").split("/"));
      mkdirSync(dirname(outPath), { recursive: true });
      const buf = await synthesize(turn.text, turn.voiceHint, turn.tone);
      writeFileSync(outPath, buf);
      clips.push(turn.audioPath);
      console.log(`  ✓ ${turn.audioPath} (${(buf.length / 1024).toFixed(0)} Ko, voix ${turn.voiceHint})`);
    }
    manifest.scenarios[report.scenarioId] = {
      clips,
      durationEstimateSec: estimateDurationSec(report.callScript),
    };
  }

  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\n✓ Manifest écrit : ${manifestPath}`);
  console.log("  Ouvre /allo-maude/demos — les lecteurs audio sont maintenant actifs.");
}

main().catch((err) => {
  console.error(`\n✗ Génération interrompue : ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
