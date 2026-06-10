/**
 * Domaine — Personas d'appelants (simulateur)
 * Un persona définit le comportement d'un appelant fictif : archétype, langue,
 * coopération, valeur potentielle, formulations d'ouverture et réponses types.
 */
import type { LanguageCode } from "./company";
import type { FieldKey } from "./script";

export type PersonaArchetype =
  | "urgence"
  | "magasineur"
  | "client_regulier"
  | "presse"
  | "frustre"
  | "anglophone"
  | "spam_fournisseur";

export const ARCHETYPE_LABELS: Record<PersonaArchetype, string> = {
  urgence: "Urgence réelle",
  magasineur: "Magasineur (compare les prix)",
  client_regulier: "Client régulier",
  presse: "Pressé, peu patient",
  frustre: "Client frustré / plainte",
  anglophone: "Anglophone (test bascule EN)",
  spam_fournisseur: "Spam / fournisseur",
};

export interface CallerPersona {
  id: string;
  label: string;
  archetype: PersonaArchetype;
  language: LanguageCode;
  valueTier: "haut" | "moyen" | "bas" | "nul";
  /** Donne ses informations facilement. */
  cooperative: boolean;
  /** Probabilité d'émettre une objection (0..1). */
  objectionChance: number;
  /** Phrases d'ouverture — {service} est interpolé avec un service de l'entreprise. */
  openers: string[];
  fieldAnswers: Partial<Record<FieldKey, string[]>>;
  names: string[];
  phones: string[];
}
