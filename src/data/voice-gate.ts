/**
 * Voice Gate — sélection de LA voix d'Allô Maude (persona « Maude »).
 * Source unique partagée par le générateur (scripts/generate-voice-gate.ts) et la
 * page A/B (/allo-maude/voice-gate). Script VERROUILLÉ, identique pour chaque
 * candidate : on ne compare que la voix, jamais le texte.
 *
 * Décision produit : vitrine « démonstrateur » — scénario contrôlé, propre,
 * complet. Naming verrouillé : produit = Allô Maude, persona = Maude,
 * entreprise fictive = AutoHorizon, client = Éric Tremblay, RAV4 hybride 2024.
 *
 * RÉALITÉ VÉRIFIÉE (2026-07-03, après abonnement ElevenLabs payant) : le TTS
 * direct sur les voix de la bibliothèque partagée (voix QUÉBÉCOISES réelles)
 * fonctionne (plus de blocage forfait). On les synthétise directement par leur
 * voice_id public — aucun « ajout au compte » requis.
 *
 * HONNÊTETÉ : aucun score de « naturel » n'est inventé. Le verdict final se juge
 * À L'OREILLE (Michael). Les accents sont décrits sans embellissement.
 */

export type VoiceGateSpeaker = "maude" | "caller";

export interface VoiceGateTurn {
  speaker: VoiceGateSpeaker;
  who: string;
  text: string;
}

/** Script verrouillé (exact) — ne pas modifier sans décision produit. */
export const VOICE_GATE_SCRIPT: VoiceGateTurn[] = [
  {
    speaker: "maude",
    who: "Maude",
    text: "Bonjour, merci d'appeler chez AutoHorizon, ici Maude. Comment puis-je vous aider aujourd'hui?",
  },
  {
    speaker: "caller",
    who: "Éric Tremblay",
    text: "Bonjour, je m'appelle Éric Tremblay. J'appelle pour le RAV4 hybride 2024 que j'ai vu sur votre site. Je suis prêt à l'acheter.",
  },
  {
    speaker: "maude",
    who: "Maude",
    text: "Parfait, monsieur Tremblay. Je vais m'assurer qu'un conseiller vous rappelle rapidement pour le RAV4 hybride 2024. Quel est le meilleur numéro pour vous joindre?",
  },
];

/** Divulgation honnête pour la page A/B (outil interne de sélection). */
export const VOICE_GATE_DISCLOSURE =
  "Voix de synthèse comparées sur un même script. Outil de sélection interne — ce n'est pas un appel client réel.";

export interface ElevenSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

export const MAUDE_ELEVEN_SETTINGS: ElevenSettings = {
  stability: 0.5,
  similarity_boost: 0.8,
  style: 0.15,
  use_speaker_boost: true,
};

export const CALLER_ELEVEN_SETTINGS: ElevenSettings = {
  stability: 0.45,
  similarity_boost: 0.75,
  style: 0.2,
  use_speaker_boost: true,
};

/** Voix québécoises (bibliothèque partagée ElevenLabs) — TTS direct par voice_id. */
export const QC_VOICES = {
  amelie: "UJCi4DDncuo0VJDSIegj", // femme, québécois, pro/avenant → Maude
  caroline: "bBRsDJSAcL1ubkrtJ3hM", // femme, québécois, doux/calme
  claudia: "WW0JfNPk5DgcQdM0d6X6", // femme, québécois, chaleureux/énergique
  adam: "93nuHbke4dTER9x2pDwE", // homme, québécois, chaleureux → client Éric
} as const;

export type VoiceProvider = "eleven" | "openai";

/**
 * Source TTS pour un locuteur. Pour ElevenLabs, `voiceId` est utilisé
 * directement (voix « premade » du compte OU voix de bibliothèque partagée —
 * le TTS direct fonctionne pour les deux avec un forfait payant).
 */
export type VoiceSource =
  | { provider: "eleven"; model: string; settings: ElevenSettings; voiceId: string }
  | { provider: "openai"; voice: string; instructions: string };

export interface VoiceGateCandidate {
  id: string;
  label: string;
  provider: VoiceProvider;
  providerLabel: string;
  accent: string;
  role: "vitrine" | "live" | "baseline";
  /** true = générable maintenant. */
  available: boolean;
  /** Note d'action quand `available` est false (inutilisé depuis l'abonnement). */
  unlockNote?: string;
  verdict: string;
  maude: VoiceSource;
  caller: VoiceSource;
}

const ELEVEN_V2 = "eleven_multilingual_v2";
const ELEVEN_V3 = "eleven_v3";

/**
 * PEAUFINAGE d'Amélie (voix retenue) — objectif : plus humain, plus de fluidité,
 * un peu plus d'enthousiasme, moins robotique. Leviers ElevenLabs :
 *   - stability BASSE  → plus de variation, moins monotone/robotique
 *   - style HAUT       → plus d'expressivité/enthousiasme
 *   - v3               → modèle le plus expressif/humain (style ignoré)
 * Le naturel final se juge À L'OREILLE (Michael) — jamais scoré ici.
 */
// Réglages peaufinés (A→Z) — la continuité inter-répliques est gérée par le
// stitching dans le générateur ; ici on verrouille le timbre québécois (similarity
// haute) et on garde de l'expressivité sans dérive.
const AMELIE_NATURAL: ElevenSettings = { stability: 0.36, similarity_boost: 0.85, style: 0.42, use_speaker_boost: true };
const AMELIE_V3: ElevenSettings = { stability: 0.5, similarity_boost: 0.92, style: 0, use_speaker_boost: true };

const eleven = (voiceId: string, model: string, settings: ElevenSettings): VoiceSource => ({ provider: "eleven", model, settings, voiceId });
const adam = (settings: ElevenSettings): VoiceSource => eleven(QC_VOICES.adam, ELEVEN_V2, settings);
const amelie = (id: string, label: string, providerLabel: string, verdict: string, model: string, settings: ElevenSettings): VoiceGateCandidate => ({
  id,
  label,
  provider: "eleven",
  providerLabel,
  accent: "Québécois (réel)",
  role: "vitrine",
  available: true,
  verdict,
  maude: eleven(QC_VOICES.amelie, model, settings),
  caller: adam(CALLER_ELEVEN_SETTINGS),
});

export const VOICE_GATE_CANDIDATES: VoiceGateCandidate[] = [
  // --- Amélie peaufinée A→Z (avec continuité/stitching) : à départager ---------
  amelie(
    "amelie-natural",
    "Amélie — naturelle A→Z (ma reco)",
    "ElevenLabs · Multilingual v2 · continuité",
    "Corrige le côté robotique de fin : continuité entre les répliques + timbre québécois verrouillé dès le premier mot. Bon début (que tu aimais) conservé. Ma reco pour « humaine de A à Z ».",
    ELEVEN_V2,
    AMELIE_NATURAL,
  ),
  amelie(
    "amelie-v3",
    "Amélie — v3 (timbre verrouillé)",
    "ElevenLabs · v3 (expressif)",
    "Corrige l'ouverture « France » : timbre québécois verrouillé dès le premier mot (similarity 0.92). Modèle le plus expressif. (v3 ne supporte pas encore la continuité inter-répliques.)",
    ELEVEN_V3,
    AMELIE_V3,
  ),
  // --- Référence « avant » (pour entendre le progrès) -------------------------
  amelie(
    "amelie-qc-v2",
    "Amélie — version initiale (avant peaufinage)",
    "ElevenLabs · Multilingual v2",
    "Réglage de départ, sans continuité — le point de comparaison « avant » (début correct, fin qui se robotise).",
    ELEVEN_V2,
    MAUDE_ELEVEN_SETTINGS,
  ),
];

/** Chemin d'asset audio — SOURCE UNIQUE (générateur + page). */
export function voiceGateAudioPath(candidateId: string, index: number, speaker: VoiceGateSpeaker): string {
  return `/voice-gate/${candidateId}/${String(index + 1).padStart(2, "0")}-${speaker}.mp3`;
}

export interface VoiceGateManifest {
  generatedAt: string;
  candidates: Record<string, { clips: string[]; provider: string; model: string }>;
}
