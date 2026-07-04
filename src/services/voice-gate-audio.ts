/**
 * Résolution de la disponibilité audio du Voice Gate — SERVER ONLY (fs).
 * Pour chaque candidate, vérifie sur disque si les clips du script verrouillé
 * existent réellement sous /public. La page A/B n'affiche jamais un bouton brisé :
 * une candidate sans clips est marquée « non générée » (ou « verrouillée »).
 *
 * HONNÊTETÉ : la vérité, c'est le fichier sur disque, pas une promesse dans le
 * manifest. Le manifest n'apporte que des métadonnées (date, modèle).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  VOICE_GATE_CANDIDATES,
  VOICE_GATE_SCRIPT,
  voiceGateAudioPath,
  type VoiceGateCandidate,
  type VoiceGateManifest,
} from "@/data/voice-gate";

const PUBLIC_DIR = join(process.cwd(), "public");
const MANIFEST_PATH = join(PUBLIC_DIR, "voice-gate", "manifest.json");

export interface ResolvedGateCandidate {
  candidate: VoiceGateCandidate;
  /** true si tous les clips attendus existent sur disque. */
  hasAudio: boolean;
  /** URLs publiques des clips (vide si absent). */
  clips: string[];
  model?: string;
  generatedAt?: string;
}

function readManifest(): VoiceGateManifest | null {
  try {
    if (!existsSync(MANIFEST_PATH)) return null;
    return JSON.parse(readFileSync(MANIFEST_PATH, "utf-8")) as VoiceGateManifest;
  } catch {
    return null;
  }
}

function clipExists(publicUrl: string): boolean {
  return existsSync(join(PUBLIC_DIR, ...publicUrl.replace(/^\//, "").split("/")));
}

/** Résout l'état audio de toutes les candidates (vérification disque). */
export function resolveVoiceGate(): { resolved: ResolvedGateCandidate[]; generatedAt?: string } {
  const manifest = readManifest();
  const resolved = VOICE_GATE_CANDIDATES.map((candidate): ResolvedGateCandidate => {
    const expected = VOICE_GATE_SCRIPT.map((turn, i) => voiceGateAudioPath(candidate.id, i, turn.speaker));
    const present = expected.filter(clipExists);
    const hasAudio = expected.length > 0 && present.length === expected.length;
    return {
      candidate,
      hasAudio,
      clips: hasAudio ? expected : [],
      model: manifest?.candidates?.[candidate.id]?.model,
      generatedAt: manifest?.generatedAt,
    };
  });
  return { resolved, generatedAt: manifest?.generatedAt };
}
