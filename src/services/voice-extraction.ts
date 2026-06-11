/**
 * NLU déterministe — extraction progressive de champs depuis du texte libre
 * FR-QC / EN. Chaque extraction retourne une valeur + confiance + evidence.
 *
 * HONNÊTETÉ : c'est un NLU à règles, pas un LLM. Il est délibérément
 * déterministe (testable en CI, zéro coût, zéro latence). Le port est conçu
 * pour qu'un LLM puisse produire les mêmes `VoiceFieldExtraction` en P2B.
 */
import type { LanguageCode } from "@/domain/company";
import type { VoiceFieldKey } from "@/domain/voice";

export interface VoiceFieldExtraction {
  key: VoiceFieldKey;
  value: string;
  confidence: number; // 0..1
  evidence: string;
}

export interface ExtractionContext {
  /** Champ que l'agent vient de demander — augmente la confiance contextuelle. */
  askedField?: VoiceFieldKey;
  lang: LanguageCode;
}

const NAME_STOPWORDS = new Set([
  "Bonjour", "Allô", "Hello", "Merci", "Thanks", "Oui", "Yes", "Non", "No", "Monsieur", "Madame",
  "Rue", "Boulevard", "Avenue", "Laval", "Montréal", "Gatineau", "Ottawa", "Québec", "Sherbrooke",
]);

/** Nom propre : « je m'appelle X », « my name is X », ou réponse directe à la question du nom. */
function extractName(text: string, ctx: ExtractionContext): VoiceFieldExtraction | null {
  // Déclencheurs insensibles à la casse (début de phrase), mais le NOM doit rester capitalisé.
  const explicit = text.match(
    /(?:[Jj]e m'appelle|[Mm]on nom est|[Ii]ci|[Cc]'est|[Mm]y name is|[Tt]his is|[Nn]ame's)\s+([A-ZÀ-Ž][\wÀ-ž'-]+(?:\s+[A-ZÀ-Ž][\wÀ-ž'-]+)+)/u,
  );
  if (explicit) {
    return { key: "callerName", value: explicit[1].trim(), confidence: 0.95, evidence: explicit[0] };
  }
  if (ctx.askedField === "callerName") {
    // Réponse directe : « Prénom Nom » (éventuellement seule dans le tour).
    const direct = text.match(/\b([A-ZÀ-Ž][\wÀ-ž'-]+\s+[A-ZÀ-Ž][\wÀ-ž'-]+)\b/u);
    if (direct && !NAME_STOPWORDS.has(direct[1].split(" ")[0])) {
      return { key: "callerName", value: direct[1].trim(), confidence: 0.8, evidence: direct[0] };
    }
  }
  return null;
}

/** Téléphone nord-américain : 514-555-0123, (819) 555-0142, 514 555 0123… */
function extractPhone(text: string): VoiceFieldExtraction | null {
  const m = text.match(/\(?(\d{3})\)?[\s.-]*(\d{3})[\s.-]*(\d{4})\b/);
  if (!m) return null;
  return { key: "phone", value: `${m[1]}-${m[2]}-${m[3]}`, confidence: 0.97, evidence: m[0] };
}

function extractEmail(text: string): VoiceFieldExtraction | null {
  const m = text.match(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/);
  if (!m) return null;
  return { key: "email", value: m[0].toLowerCase(), confidence: 0.97, evidence: m[0] };
}

/** Adresse civique FR/EN : « 1224 rue De Castille à Laval », « 210 Lakeshore Drive in Pointe-Claire ». */
function extractAddress(text: string, ctx: ExtractionContext): VoiceFieldExtraction | null {
  const m = text.match(
    /\b(\d{1,5}(?:,)?\s+(?:rue|boulevard|boul\.?|avenue|av\.?|chemin|montée|place|côte|[\wÀ-ž'-]+\s+(?:Street|Drive|Road|Avenue|Boulevard|Lane|Crescent))\s*[\wÀ-ž' .-]*)/iu,
  );
  if (!m) return null;
  let value = m[1].trim().replace(/[.,!?]+$/, "").replace(/\s+(?:à|in|at)\s+.*$/iu, "");
  // Ville après « à / in / at » si présente dans le même tour.
  // Pas de \b devant « à » : \b est ASCII en JS et ne matche jamais avant un caractère accentué.
  const city = text.slice(text.indexOf(m[1])).match(/(?:^|\s)(?:à|in|at)\s+([A-ZÀ-Ž][\wÀ-ž-]+(?:-[A-ZÀ-Ž][\wÀ-ž-]+)*)/u);
  if (city) value += `, ${city[1]}`;
  const conf = ctx.askedField === "address" ? 0.9 : 0.8;
  return { key: "address", value, confidence: conf, evidence: m[0] };
}

/** Moment souhaité : aujourd'hui/demain/cette semaine/lundi…/tonight/asap/« vers 14 h ». */
const TIME_PATTERNS: { re: RegExp; conf: number }[] = [
  { re: /\b(là là,? maintenant|maintenant|tout de suite|right now|immediately|asap|le plus (?:vite|tôt) possible|as soon as possible)\b/iu, conf: 0.9 },
  { re: /\b(aujourd'hui|ce soir|cette nuit|today|tonight)\b/iu, conf: 0.9 },
  { re: /\b(demain(?:\s+(?:matin|après-midi|soir))?|tomorrow(?:\s+(?:morning|afternoon|evening))?)\b/iu, conf: 0.9 },
  { re: /\b(cette semaine|la semaine prochaine|this week|next week|d'ici (?:la fin du mois|un mois)|fin du mois)\b/iu, conf: 0.85 },
  { re: /\b((?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:matin|après-midi|soir|morning|afternoon|evening))?)\b/iu, conf: 0.85 },
  { re: /\b(vers \d{1,2}\s?h(?:\s?\d{2})?|à \d{1,2}\s?h(?:\s?\d{2})?|at \d{1,2}(?::\d{2})?\s?(?:am|pm)?)\b/iu, conf: 0.85 },
];

function extractTime(text: string): VoiceFieldExtraction | null {
  for (const { re, conf } of TIME_PATTERNS) {
    const m = text.match(re);
    if (m) return { key: "preferredTime", value: m[1].toLowerCase(), confidence: conf, evidence: m[0] };
  }
  return null;
}

/** Service demandé : « pour un/une X », « j'ai besoin de X », « my X is leaking »… */
function extractService(text: string, ctx: ExtractionContext): VoiceFieldExtraction | null {
  const patterns = [
    /(?:c'est pour|j'appelle pour|j'ai besoin (?:de|d'une?)|j'aurais besoin (?:de|d'une?)|on a besoin de)\s+([^,.!?]{6,90})/iu,
    /(?:calling about|i need|i'd like|looking for|i want)\s+([^,.!?]{6,90})/iu,
    /(?:problème avec|problem with|issue with)\s+([^,.!?]{4,90})/iu,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return { key: "requestedService", value: m[1].trim(), confidence: 0.85, evidence: m[0] };
  }
  // Symptômes exprimés directement : « my water heater is leaking », « j'ai un tuyau qui a pété ».
  const symptom = text.match(/\b((?:my|our|mon|ma|notre|un|une)\s+[\wÀ-ž' -]{3,40}\s+(?:is leaking|is broken|won't start|qui (?:goutte|coule|refoule|a pété|ne (?:fonctionne|démarre) plus)|qui fuit))/iu);
  if (symptom) return { key: "requestedService", value: symptom[1].trim(), confidence: 0.8, evidence: symptom[0] };
  if (ctx.askedField === "requestedService" && text.trim().length >= 8) {
    return { key: "requestedService", value: text.trim().replace(/[.!?]+$/, ""), confidence: 0.7, evidence: text.trim() };
  }
  return null;
}

/** Extrait tous les champs détectables dans un tour appelant. */
export function extractFields(text: string, ctx: ExtractionContext): VoiceFieldExtraction[] {
  const out: VoiceFieldExtraction[] = [];
  const name = extractName(text, ctx);
  if (name) out.push(name);
  const phone = extractPhone(text);
  if (phone) out.push(phone);
  const email = extractEmail(text);
  if (email) out.push(email);
  const address = extractAddress(text, ctx);
  if (address) out.push(address);
  const time = extractTime(text);
  if (time) out.push(time);
  const service = extractService(text, ctx);
  if (service) out.push(service);
  return out;
}

// ---------------------------------------------------------------------------
// Signaux conversationnels (urgence, humain, spam, confirmation)
// ---------------------------------------------------------------------------

const HUMAN_REQUEST = [
  "parler à un humain", "parler à quelqu'un", "une vraie personne", "un vrai humain", "le propriétaire", "le patron",
  "speak to a human", "talk to a person", "real person", "speak to someone", "the owner", "your manager", "transfère-moi", "transfer me",
];

const FRUSTRATION = [
  "pas content", "inacceptable", "ridicule", "frustré", "en colère", "ça fait trois fois", "personne ne me rappelle",
  "fed up", "unacceptable", "ridiculous", "frustrated", "angry", "third time",
];

const SPAM_SIGNALS = ["référencement", "offre exclusive", "promotion", "télémarketing", "responsable des télécommunications", "seo services", "special offer"];

const AFFIRMATIVE = ["oui", "exact", "c'est ça", "c'est bien ça", "parfait", "correct", "yes", "that's right", "yep", "exactly", "oui oui"];
const NEGATIVE = ["non", "pas du tout", "no", "nope", "pas ça", "not that"];

export function detectsHumanRequest(text: string): boolean {
  const t = text.toLowerCase();
  return HUMAN_REQUEST.some((k) => t.includes(k));
}

export function detectsFrustration(text: string): boolean {
  const t = text.toLowerCase();
  return FRUSTRATION.some((k) => t.includes(k));
}

export function detectsSpam(text: string): boolean {
  const t = text.toLowerCase();
  return SPAM_SIGNALS.some((k) => t.includes(k));
}

export function isAffirmative(text: string): boolean {
  const t = text.toLowerCase().trim();
  return AFFIRMATIVE.some((k) => t.startsWith(k) || t.includes(` ${k}`));
}

export function isNegative(text: string): boolean {
  const t = text.toLowerCase().trim();
  return NEGATIVE.some((k) => t.startsWith(k));
}

/** Tour incompréhensible : vide, trop court, ou bruit pur (« … », « euh »). */
export function isUnintelligible(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/[.…\s]+/g, " ").trim();
  if (t.length < 2) return true;
  return ["euh", "uh", "um", "hum", "hmm", "allo?", "allô?"].includes(t);
}
