/**
 * Service — Onboarding magique (P3.4) : URL du site + 2 phrases → brouillon
 * de profil d'entreprise et de persona, ÉDITABLE, jamais actif sans
 * approbation explicite du propriétaire (une IA qui parle au nom d'une
 * entreprise sans validation = incident de confiance garanti).
 *
 * Parties pures (testées) : extraction de texte du HTML, validation du
 * brouillon. Partie IO : fetch du site + appel LLM structured output —
 * NotConfigured explicite sans clé, jamais de faux brouillon.
 */
import type { Company, Industry, LanguageCode } from "@/domain/company";
import type { VoiceAgentConfig } from "@/domain/agent";
import { INDUSTRY_LABELS } from "@/domain/company";

export interface OnboardingDraft {
  name: string;
  industry: Industry;
  city: string;
  services: string[];
  serviceAreas: string[];
  languages: LanguageCode[];
  tone: "chaleureux" | "professionnel" | "energique";
  persona: string;
  /** Ce que le LLM a compris du commerce — affiché pour validation humaine. */
  understanding: string;
}

export interface CoachingDraft {
  businessDescription: string;
  tone: Company["tone"];
  services: string[];
  serviceAreas: string[];
  essentialQuestions: string[];
  policies: string[];
  persona: string;
  style: string;
  greetingScript: string;
  closingScript: string;
  allowedPhrases: string[];
  forbiddenPhrases: string[];
  answerLimits: string[];
  transferPolicy: string;
  ownerInstructions: string[];
  understanding: string;
  changedFields: string[];
}

export class OnboardingNotConfiguredError extends Error {
  constructor() {
    super("OPENAI_API_KEY absente — l'onboarding magique exige le moteur LLM (le formulaire manuel reste disponible).");
    this.name = "OnboardingNotConfiguredError";
  }
}

const INDUSTRIES = Object.keys(INDUSTRY_LABELS) as Industry[];
const TONES = ["chaleureux", "professionnel", "energique"] as const;
const COACHING_TONES: Company["tone"][] = ["chaleureux", "professionnel", "energique", "calme"];

function cleanString(value: unknown, fallback = "", max = 2000): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
}

function cleanList(value: unknown, fallback: string[], max: number): string[] {
  if (!Array.isArray(value)) return [...fallback];
  return [...new Set(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 1),
  )].slice(0, max);
}

function addUnique(base: string[], values: string[], max: number): string[] {
  return [...new Set([...base, ...values].map((item) => item.trim()).filter((item) => item.length > 1))].slice(0, max);
}

function parseInlineList(text: string, pattern: RegExp): string[] {
  const match = text.match(pattern);
  if (!match?.[1]) return [];
  return match[1]
    .split(/\s*(?:,|;|\bet\b)\s*/i)
    .map((item) => item.trim().replace(/[.?!]+$/, ""))
    .filter((item) => item.length > 1);
}

/**
 * Interpréteur local et déterministe des consignes du propriétaire.
 * Toute la consigne est préservée mot pour mot; seules les structures
 * explicitement reconnues sont proposées comme modifications additionnelles.
 */
export function buildCoachingDraft(
  company: Company,
  agent: VoiceAgentConfig,
  rawInstruction: string,
): CoachingDraft {
  const instruction = cleanString(rawInstruction, "", 2000);
  if (instruction.length < 10) throw new Error("Décrivez la consigne en au moins 10 caractères.");

  const draft: CoachingDraft = {
    businessDescription: instruction,
    tone: company.tone,
    services: [...company.services],
    serviceAreas: [...company.serviceAreas],
    essentialQuestions: [...company.essentialQuestions],
    policies: [...company.policies],
    persona: agent.persona,
    style: agent.style,
    greetingScript: agent.greetingScript,
    closingScript: agent.closingScript,
    allowedPhrases: [...agent.allowedPhrases],
    forbiddenPhrases: [...agent.forbiddenPhrases],
    answerLimits: [...agent.answerLimits],
    transferPolicy: agent.transferPolicy,
    ownerInstructions: addUnique(agent.ownerInstructions ?? [], [instruction], 20),
    understanding: "La consigne exacte sera conservée. Les éléments reconnus ci-dessous sont des propositions à vérifier avant application.",
    changedFields: ["businessDescription", "ownerInstructions"],
  };

  const lower = instruction.toLocaleLowerCase("fr-CA");
  const tone = COACHING_TONES.find((candidate) => lower.includes(candidate));
  if (tone) {
    draft.tone = tone;
    draft.changedFields.push("tone");
  }

  const services = parseInlineList(instruction, /nous offrons\s*:?\s*([^.!?]+)/i);
  if (services.length) {
    draft.services = addUnique(draft.services, services, 12);
    draft.changedFields.push("services");
  }

  const areas = parseInlineList(instruction, /nous desservons\s*:?\s*([^.!?]+)/i);
  if (areas.length) {
    draft.serviceAreas = addUnique(draft.serviceAreas, areas, 12);
    draft.changedFields.push("serviceAreas");
  }

  const question = instruction.match(/(?:demande|demander)\s+toujours\s+([^.!?]+)/i)?.[1]?.trim();
  if (question) {
    draft.essentialQuestions = addUnique(draft.essentialQuestions, [question], 12);
    draft.changedFields.push("essentialQuestions");
  }

  const forbidden = instruction.match(/ne\s+jamais\s+([^.!?]+)/i)?.[1]?.trim();
  if (forbidden) {
    draft.forbiddenPhrases = addUnique(draft.forbiddenPhrases, [forbidden], 16);
    draft.changedFields.push("forbiddenPhrases");
  }

  const greeting = instruction.match(/(?:commence|accueille)[^«"]*[«"]([^»"]+)[»"]/i)?.[1]?.trim();
  if (greeting) {
    draft.greetingScript = greeting;
    draft.changedFields.push("greetingScript");
  }

  const transfer = instruction.match(/((?:transfère|transférer)[^.!?]+)/i)?.[1]?.trim();
  if (transfer) {
    draft.transferPolicy = addUnique(
      draft.transferPolicy.split(/\s*\|\s*/),
      [`Consigne du propriétaire : ${transfer}`],
      8,
    ).join(" | ");
    draft.changedFields.push("transferPolicy");
  }

  draft.changedFields = [...new Set(draft.changedFields)];
  return draft;
}

/** Revalide un brouillon de coaching envoyé par le navigateur avant application. */
export function validateCoachingDraft(
  raw: Record<string, unknown>,
  company: Company,
  agent: VoiceAgentConfig,
): CoachingDraft {
  const requestedTone = raw.tone as Company["tone"];
  return {
    businessDescription: cleanString(raw.businessDescription, company.businessDescription ?? "", 2000),
    tone: COACHING_TONES.includes(requestedTone) ? requestedTone : company.tone,
    services: cleanList(raw.services, company.services, 12),
    serviceAreas: cleanList(raw.serviceAreas, company.serviceAreas, 12),
    essentialQuestions: cleanList(raw.essentialQuestions, company.essentialQuestions, 12),
    policies: cleanList(raw.policies, company.policies, 12),
    persona: cleanString(raw.persona, agent.persona, 1000),
    style: cleanString(raw.style, agent.style, 1000),
    greetingScript: cleanString(raw.greetingScript, agent.greetingScript, 500),
    closingScript: cleanString(raw.closingScript, agent.closingScript, 500),
    allowedPhrases: cleanList(raw.allowedPhrases, agent.allowedPhrases, 16),
    forbiddenPhrases: cleanList(raw.forbiddenPhrases, agent.forbiddenPhrases, 16),
    answerLimits: cleanList(raw.answerLimits, agent.answerLimits, 16),
    transferPolicy: cleanString(raw.transferPolicy, agent.transferPolicy, 1200),
    ownerInstructions: cleanList(raw.ownerInstructions, agent.ownerInstructions ?? [], 20),
    understanding: cleanString(
      raw.understanding,
      "Brouillon de coaching à vérifier avant application.",
      1000,
    ),
    changedFields: cleanList(raw.changedFields, [], 20),
  };
}

/** Extrait le texte utile d'une page HTML (pur, testé) : sans scripts/styles/balises. */
export function extractWebsiteText(html: string, maxChars = 6000): string {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, maxChars);
}

/** Valide et normalise la sortie LLM (pur, testé) — enums forcés, listes bornées. */
export function validateDraft(raw: Record<string, unknown>, fallbackName: string): OnboardingDraft {
  const str = (v: unknown, fb = ""): string => (typeof v === "string" && v.trim() ? v.trim() : fb);
  const list = (v: unknown, max: number): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 1).map((x) => x.trim()).slice(0, max) : [];
  const industry = INDUSTRIES.includes(raw.industry as Industry) ? (raw.industry as Industry) : "services_professionnels";
  const tone = TONES.includes(raw.tone as (typeof TONES)[number]) ? (raw.tone as OnboardingDraft["tone"]) : "chaleureux";
  const langs = list(raw.languages, 2).filter((l): l is LanguageCode => l === "fr" || l === "en");
  return {
    name: str(raw.name, fallbackName),
    industry,
    city: str(raw.city, "à préciser"),
    services: list(raw.services, 8),
    serviceAreas: list(raw.serviceAreas, 8),
    languages: langs.length ? langs : ["fr"],
    tone,
    persona: str(raw.persona, "Chaleureuse, efficace et claire. Vouvoiement."),
    understanding: str(raw.understanding, "—"),
  };
}

const DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", description: "Nom commercial de l'entreprise." },
    industry: { enum: INDUSTRIES },
    city: { type: "string", description: "Ville principale (Québec/Canada)." },
    services: { type: "array", items: { type: "string" }, description: "Services offerts, 3-8 éléments courts en français." },
    serviceAreas: { type: "array", items: { type: "string" }, description: "Villes/régions desservies." },
    languages: { type: "array", items: { enum: ["fr", "en"] } },
    tone: { enum: [...TONES] },
    persona: { type: "string", description: "Personnalité de la réceptionniste en 1-2 phrases, en français." },
    understanding: { type: "string", description: "Ce que tu as compris du commerce en 2 phrases (pour validation par le propriétaire)." },
  },
  required: ["name", "industry", "city", "services", "serviceAreas", "languages", "tone", "persona", "understanding"],
} as const;

/**
 * Garde SSRF (pur, testé) : refuse loopback, réseaux privés, link-local et
 * hôtes internes — ce fetch part du serveur, il ne doit jamais atteindre le
 * réseau interne ni les métadonnées cloud. (Limite connue : ne résout pas le
 * DNS — un domaine public pointant vers une IP privée passerait ; proportionné
 * au pilote, à durcir avec une résolution préalable si besoin.)
 */
export function isForbiddenHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, ""); // IPv6 entre crochets
  if (h.startsWith("::ffff:")) return isForbiddenHost(h.slice("::ffff:".length));
  // Le fetch d'onboarding n'a pas besoin d'IPv6 littérale pour les PME ciblées.
  // Refuser toute IPv6 directe évite les variantes loopback/link-local abrégées.
  if (h.includes(":")) return true;
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || !h.includes(".")) return true;
  if (h === "::1" || h === "0.0.0.0" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local / métadonnées cloud
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/** Récupère la page (10 s, 500 ko max) et la réduit en texte. */
export async function fetchWebsiteText(url: string): Promise<string> {
  const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("URL invalide.");
  if (isForbiddenHost(parsed.hostname)) throw new Error("Cette adresse n'est pas un site web public.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    // Redirections suivies à la main : la garde SSRF s'applique à CHAQUE saut.
    let target = parsed;
    let res: Response;
    for (let hop = 0; ; hop++) {
      res = await fetch(target.toString(), {
        signal: controller.signal,
        headers: { "User-Agent": "ScalyOnboarding/1.0 (+https://scaly.ca)" },
        redirect: "manual",
      });
      if (res.status < 300 || res.status >= 400) break;
      const location = res.headers.get("location");
      if (!location || hop >= 3) throw new Error("Trop de redirections — vérifiez l'URL.");
      target = new URL(location, target);
      if (!["http:", "https:"].includes(target.protocol) || isForbiddenHost(target.hostname)) {
        throw new Error("Cette adresse n'est pas un site web public.");
      }
    }
    if (!res.ok) throw new Error(`Le site répond ${res.status} — vérifiez l'URL.`);
    const html = (await res.text()).slice(0, 500_000);
    const text = extractWebsiteText(html);
    if (text.length < 80) throw new Error("Page presque vide (site en JavaScript pur ?) — décrivez votre entreprise dans le champ texte, le brouillon se basera dessus.");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/** Génère le brouillon via LLM (structured output strict, temperature 0). */
export async function draftFromWebsite(url: string, blurb: string): Promise<{ draft: OnboardingDraft; sourceChars: number }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new OnboardingNotConfiguredError();

  let siteText = "";
  let fetchNote = "";
  try {
    siteText = await fetchWebsiteText(url);
  } catch (err) {
    // Site illisible : on continue avec le blurb seul, honnêtement signalé.
    fetchNote = err instanceof Error ? err.message : String(err);
    if (!blurb.trim()) throw new Error(`Site illisible (${fetchNote}) et aucune description fournie — impossible de générer un brouillon.`);
  }

  const model = process.env.SCALY_LLM_MODEL ?? "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "Tu prépares le profil d'une réceptionniste IA pour une PME québécoise. À partir du texte du site web et de la description du propriétaire, produis un brouillon FACTUEL en français : n'invente JAMAIS un service ou une ville non mentionnés. En cas de doute, omets.",
        },
        {
          role: "user",
          content: `Description du propriétaire : ${blurb || "(aucune)"}\n\nTexte du site (${url}) :\n${siteText || "(site illisible)"}`,
        },
      ],
      response_format: { type: "json_schema", json_schema: { name: "onboarding_draft", strict: true, schema: DRAFT_SCHEMA } },
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status} : ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  const raw = JSON.parse(data.choices[0].message.content) as Record<string, unknown>;
  const draft = validateDraft(raw, new URL(url.startsWith("http") ? url : `https://${url}`).hostname);
  if (fetchNote) draft.understanding = `${draft.understanding} (NB : ${fetchNote})`;
  return { draft, sourceChars: siteText.length };
}
