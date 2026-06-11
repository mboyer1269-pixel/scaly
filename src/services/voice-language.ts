/**
 * Détection de langue FR/EN par tour — heuristique déterministe.
 * Conçue pour le français québécois parlé (pis, là, ben…) et l'anglais courant.
 * En P2B, le STT fournira sa propre détection ; ce module restera l'arbitre
 * de la « langue dominante » et des événements de switch.
 */
import type { LanguageCode } from "@/domain/company";

const FR_MARKERS = [
  "bonjour", "allô", "oui", "merci", "s'il vous plaît", "svp", "je", "j'ai", "c'est", "pour", "une", "le ", "la ", "les ",
  "besoin", "vite", "urgent", "demain", "aujourd'hui", "semaine", "monsieur", "madame", "pis", "là", "ben", "ça",
  "votre", "vous", "chez", "rue", "boulevard", "rendez-vous", "soumission", "prix", "combien", "appelle", "numéro",
];

const EN_MARKERS = [
  "hello", "hi ", "yes", "thanks", "thank you", "please", "i ", "i'm", "it's", "the ", "my ", "need", "quote",
  "today", "tomorrow", "week", "appointment", "how much", "price", "name is", "phone", "street", "drive", "road",
  "can you", "do you", "speak english", "sorry", "leaking", "broken", "asap",
];

function score(text: string, markers: string[]): number {
  let s = 0;
  for (const m of markers) if (text.includes(m)) s += 1;
  return s;
}

/** Détecte la langue d'un tour. `fallback` départage les tours ambigus (ex. « OK »). */
export function detectTurnLanguage(text: string, fallback: LanguageCode): LanguageCode {
  const t = ` ${text.toLowerCase()} `;
  const fr = score(t, FR_MARKERS);
  const en = score(t, EN_MARKERS);
  // Les accents français sont un signal fort à eux seuls.
  const accents = (text.match(/[àâçéèêëîïôûù]/gi) ?? []).length;
  if (fr + accents === en) return fallback;
  return fr + accents > en ? "fr" : "en";
}

/** Langue dominante = majorité des tours appelant (la dernière l'emporte à égalité). */
export function dominantLanguage(callerLangs: LanguageCode[], fallback: LanguageCode): LanguageCode {
  if (callerLangs.length === 0) return fallback;
  const fr = callerLangs.filter((l) => l === "fr").length;
  const en = callerLangs.length - fr;
  if (fr === en) return callerLangs[callerLangs.length - 1];
  return fr > en ? "fr" : "en";
}
