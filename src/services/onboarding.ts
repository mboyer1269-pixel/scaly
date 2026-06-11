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
import type { Industry, LanguageCode } from "@/domain/company";
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

export class OnboardingNotConfiguredError extends Error {
  constructor() {
    super("OPENAI_API_KEY absente — l'onboarding magique exige le moteur LLM (le formulaire manuel reste disponible).");
    this.name = "OnboardingNotConfiguredError";
  }
}

const INDUSTRIES = Object.keys(INDUSTRY_LABELS) as Industry[];
const TONES = ["chaleureux", "professionnel", "energique"] as const;

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

/** Récupère la page (10 s, 500 ko max) et la réduit en texte. */
export async function fetchWebsiteText(url: string): Promise<string> {
  const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("URL invalide.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: { "User-Agent": "ScalyOnboarding/1.0 (+https://scaly.ca)" },
      redirect: "follow",
    });
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
