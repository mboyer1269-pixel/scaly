/**
 * Garde ANTI-BS de la page publique /allo-maude/demos (Audio Proof v1).
 * Vérifie le wording rendu, PAS les commentaires de code : on retire les blocs
 * de commentaire (qui contiennent des négations honnêtes du type « ce n'est pas
 * un vrai appel ») avant de chercher des affirmations trompeuses.
 *
 * 100 % offline : lecture de fichiers locaux, aucun appel externe.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PUBLIC_DISCLOSURE } from "@/data/pack-demo-scenarios";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const stripBlockComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "");

const PAGE = "src/app/allo-maude/demos/page.tsx";
const PLAYER = "src/components/AudioCallPlayer.tsx";

describe("anti-BS — page Audio Proof publique", () => {
  it("la divulgation « simulation » est honnête et non trompeuse", () => {
    expect(PUBLIC_DISCLOSURE.toLowerCase()).toContain("simulation");
    expect(PUBLIC_DISCLOSURE.toLowerCase()).toContain("représentatif");
  });

  it("la page rend la divulgation publique", () => {
    const src = read(PAGE);
    expect(src).toContain("PUBLIC_DISCLOSURE");
  });

  it("le lecteur audio affiche toujours la divulgation sous l'appel", () => {
    const src = read(PLAYER);
    expect(src).toContain("{disclosure}");
  });

  it("le wording visible ne prétend jamais un vrai appel, ni claims absolus, ni jargon de dev", () => {
    const visible = stripBlockComments(read(PAGE)).toLowerCase();
    // Interdits = (a) prétention d'appel réel, (b) claims absolus, (c) jargon interne
    // qui donne un feeling « console de dev » à un prospect non technique.
    const banned = [
      "vrai appel", "appel réel", "appel en direct", "real call", // prétention d'appel réel
      "zéro erreur", "aucune erreur", "100 % autom", "100% autom", "garanti", "preuve terrain", // claims
      "vrai cerveau", "déterministe", "verrouillé en ci", "nlu", "latence", "champs confirmés", "p95", "budget tenu", // jargon
    ];
    for (const phrase of banned) expect(visible, `wording interdit trouvé : « ${phrase} »`).not.toContain(phrase);
  });

  it("le numéro de transfert interne n'est jamais affiché publiquement", () => {
    const src = read(PAGE);
    // La page n'affiche que la RAISON d'escalade, jamais outcome.transferTo (le numéro).
    expect(src).not.toContain("transferTo");
  });
});
