import { describe, expect, it } from "vitest";
import {
  detectsFrustration,
  detectsHumanRequest,
  detectsSpam,
  extractFields,
  isAffirmative,
  isNegative,
  isUnintelligible,
  type ExtractionContext,
} from "@/services/voice-extraction";
import { detectTurnLanguage, dominantLanguage } from "@/services/voice-language";

const fr: ExtractionContext = { lang: "fr" };
const en: ExtractionContext = { lang: "en" };

function field(text: string, key: string, ctx: ExtractionContext = fr) {
  return extractFields(text, ctx).find((x) => x.key === key);
}

describe("extraction — champs", () => {
  it("nom explicite FR : « je m'appelle X »", () => {
    const f = field("Bonjour, je m'appelle Martin Leblanc.", "callerName");
    expect(f?.value).toBe("Martin Leblanc");
    expect(f?.confidence).toBeGreaterThanOrEqual(0.9);
    expect(f?.evidence).toContain("je m'appelle");
  });

  it("nom explicite EN : « my name is X »", () => {
    const f = field("Hi, my name is Sarah Thompson and my water heater is leaking.", "callerName", en);
    expect(f?.value).toBe("Sarah Thompson");
  });

  it("nom en réponse directe à la question — confiance réduite (inferred)", () => {
    const f = field("Stéphane Bergeron.", "callerName", { lang: "fr", askedField: "callerName" });
    expect(f?.value).toBe("Stéphane Bergeron");
    expect(f?.confidence).toBeLessThan(0.9);
  });

  it("pas de faux nom depuis un début de phrase banal", () => {
    expect(field("Bonjour Madame, comment allez-vous ?", "callerName")).toBeUndefined();
  });

  it("téléphone : formats 514-555-0182, (819) 555 0167, normalisés en XXX-XXX-XXXX", () => {
    expect(field("C'est le 514-555-0182.", "phone")?.value).toBe("514-555-0182");
    expect(field("You can reach him at (819) 555 0167 anytime.", "phone", en)?.value).toBe("819-555-0167");
  });

  it("courriel normalisé en minuscules", () => {
    expect(field("Mon courriel c'est Martin.Leblanc@Exemple.CA merci", "email")?.value).toBe("martin.leblanc@exemple.ca");
  });

  it("adresse FR avec ville après « à »", () => {
    const f = field("Au 88 rue Principale à Longueuil.", "address");
    expect(f?.value).toContain("88 rue Principale");
    expect(f?.value).toContain("Longueuil");
  });

  it("adresse EN avec ville après « in »", () => {
    const f = field("210 Lakeshore Drive in Pointe-Claire.", "address", en);
    expect(f?.value).toContain("210 Lakeshore Drive");
    expect(f?.value).toContain("Pointe-Claire");
  });

  it("moment souhaité : demain matin / asap / mercredi", () => {
    expect(field("Demain matin si possible.", "preferredTime")?.value).toBe("demain matin");
    expect(field("As soon as possible please!", "preferredTime", en)?.value).toBe("as soon as possible");
    expect(field("Cette semaine, mercredi matin idéalement.", "preferredTime")?.value).toBeTruthy();
  });

  it("service demandé : « j'appelle pour X » et symptôme direct", () => {
    expect(field("J'appelle pour un robinet qui coule dans la cuisine.", "requestedService")?.value).toContain("robinet");
    expect(field("My water heater is leaking everywhere.", "requestedService", en)?.value).toContain("water heater");
  });

  it("plusieurs champs extraits du même tour", () => {
    const all = extractFields("Je m'appelle Karine Dupuis, vous pouvez me joindre au 819-555-0167.", fr);
    const keys = all.map((x) => x.key);
    expect(keys).toContain("callerName");
    expect(keys).toContain("phone");
  });
});

describe("extraction — signaux conversationnels", () => {
  it("demande d'humain FR/EN", () => {
    expect(detectsHumanRequest("Je veux parler à un humain, pas à un robot !")).toBe(true);
    expect(detectsHumanRequest("Can I speak to a human please?")).toBe(true);
    expect(detectsHumanRequest("J'aimerais un rendez-vous demain.")).toBe(false);
  });

  it("frustration", () => {
    expect(detectsFrustration("Ça fait trois fois que j'appelle, c'est inacceptable.")).toBe(true);
    expect(detectsFrustration("Merci beaucoup, c'est parfait.")).toBe(false);
  });

  it("spam / sollicitation", () => {
    expect(detectsSpam("Bonjour, on offre des services de référencement web…")).toBe(true);
    expect(detectsSpam("J'ai un dégât d'eau au sous-sol.")).toBe(false);
  });

  it("affirmation / négation", () => {
    expect(isAffirmative("Oui, c'est exact.")).toBe(true);
    expect(isAffirmative("Yes, that's right!")).toBe(true);
    expect(isNegative("Non, pas du tout.")).toBe(true);
    expect(isNegative("Oui oui.")).toBe(false);
  });

  it("tours inaudibles : vide, points, hésitations", () => {
    expect(isUnintelligible("...")).toBe(true);
    expect(isUnintelligible("euh")).toBe(true);
    expect(isUnintelligible("J'ai besoin d'un plombier.")).toBe(false);
  });
});

describe("détection de langue", () => {
  it("FR québécois parlé (pis, là, ben)", () => {
    expect(detectTurnLanguage("Ben là, j'appelle pour ma fournaise pis personne rappelle.", "en")).toBe("fr");
  });

  it("EN courant", () => {
    expect(detectTurnLanguage("Hi, sorry — do you speak English? My water heater is leaking.", "fr")).toBe("en");
  });

  it("les accents départagent un tour court", () => {
    expect(detectTurnLanguage("Une soumission, s'il vous plaît, ça presse.", "en")).toBe("fr");
  });

  it("tour ambigu → langue de repli", () => {
    expect(detectTurnLanguage("OK.", "fr")).toBe("fr");
    expect(detectTurnLanguage("OK.", "en")).toBe("en");
  });

  it("langue dominante : majorité, et la dernière l'emporte à égalité", () => {
    expect(dominantLanguage(["fr", "en", "fr"], "en")).toBe("fr");
    expect(dominantLanguage(["fr", "en"], "fr")).toBe("en");
    expect(dominantLanguage([], "fr")).toBe("fr");
  });
});
