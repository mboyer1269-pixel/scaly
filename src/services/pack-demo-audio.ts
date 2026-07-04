/**
 * Résolution de la disponibilité audio des démos — SERVER ONLY (fs).
 * Vérifie sur disque si les clips attendus par le callScript existent réellement
 * sous /public. La page n'affiche JAMAIS un bouton « Écouter » brisé : si les
 * clips manquent, elle bascule sur un état propre « Audio premium à générer ».
 *
 * HONNÊTETÉ : la vérité, c'est le fichier sur disque — pas une promesse dans les
 * données. Le manifest (écrit par scripts/generate-demo-audio.ts) n'apporte que
 * les métadonnées (générateur, date) ; l'existence des clips prime.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { PackDemoReport } from "./pack-demo";

export type AudioDemoStatus = "available" | "missing" | "generated-later";

export interface ResolvedAudioDemo {
  status: AudioDemoStatus;
  /** URLs publiques des clips, dans l'ordre de lecture (vide si non disponible). */
  clips: string[];
  durationEstimateSec: number;
  disclosureLabel: string;
  generatedBy?: string;
  lastGeneratedAt?: string;
}

interface AudioManifest {
  generatedBy?: string;
  generatedAt?: string;
  scenarios?: Record<string, { clips?: string[]; durationEstimateSec?: number }>;
}

const PUBLIC_DIR = join(process.cwd(), "public");
const MANIFEST_PATH = join(PUBLIC_DIR, "demo-audio", "manifest.json");

function readManifest(): AudioManifest | null {
  try {
    if (!existsSync(MANIFEST_PATH)) return null;
    return JSON.parse(readFileSync(MANIFEST_PATH, "utf-8")) as AudioManifest;
  } catch {
    return null; // manifest illisible → traité comme absent (jamais une erreur de page)
  }
}

/** ~14 caractères/seconde en FR parlé + les pauses inter-clips. */
function estimateDurationSec(report: PackDemoReport): number {
  const speechMs = report.callScript.reduce((sum, t) => sum + (t.text.length / 14) * 1000 + t.pauseAfterMs, 0);
  return Math.max(1, Math.round(speechMs / 1000));
}

/** Un clip est présent si le fichier existe réellement sous /public. */
function clipExists(publicUrl: string): boolean {
  const segments = publicUrl.replace(/^\//, "").split("/");
  return existsSync(join(PUBLIC_DIR, ...segments));
}

/** Résout l'état audio réel d'une démo (vérification disque). */
export function resolveAudioDemo(report: PackDemoReport): ResolvedAudioDemo {
  const expected = report.callScript.map((t) => t.audioPath);
  const manifest = readManifest();
  const meta = manifest?.scenarios?.[report.scenarioId];

  const present = expected.filter(clipExists);
  const durationEstimateSec = meta?.durationEstimateSec ?? estimateDurationSec(report);

  const base = {
    clips: [] as string[],
    durationEstimateSec,
    disclosureLabel: report.disclosureLabel,
    generatedBy: manifest?.generatedBy,
    lastGeneratedAt: manifest?.generatedAt,
  };

  if (expected.length > 0 && present.length === expected.length) {
    return { ...base, status: "available", clips: expected };
  }
  if (present.length > 0) {
    // Jeu partiel (génération interrompue / clips supprimés) → ne pas jouer.
    return { ...base, status: "missing" };
  }
  return { ...base, status: "generated-later" };
}
