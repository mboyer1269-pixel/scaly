import { describe, expect, it } from "vitest";
import { extractWebsiteText, validateDraft } from "@/services/onboarding";

describe("extractWebsiteText", () => {
  it("retire scripts, styles, commentaires et balises", () => {
    const html = `<html><head><style>.a{color:red}</style><script>alert("x")</script></head>
      <body><!-- nav --><h1>Plomberie Bélair</h1><noscript>JS requis</noscript>
      <p>Urgences 24/7 sur la Rive-Sud.</p></body></html>`;
    const text = extractWebsiteText(html);
    expect(text).toBe("Plomberie Bélair Urgences 24/7 sur la Rive-Sud.");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("color");
    expect(text).not.toContain("JS requis");
  });

  it("décode &amp; et remplace les autres entités par des espaces", () => {
    expect(extractWebsiteText("<p>Toiture&nbsp;&amp;&nbsp;rev&ecirc;tement</p>")).toBe("Toiture & rev tement");
  });

  it("tronque au plafond demandé", () => {
    expect(extractWebsiteText(`<p>${"mot ".repeat(500)}</p>`, 100)).toHaveLength(100);
  });
});

describe("validateDraft", () => {
  it("normalise un brouillon valide sans le déformer", () => {
    const draft = validateDraft(
      {
        name: " Plomberie Bélair ",
        industry: "services_domicile",
        city: "Longueuil",
        services: ["Débouchage", "Chauffe-eau"],
        serviceAreas: ["Rive-Sud"],
        languages: ["fr", "en"],
        tone: "professionnel",
        persona: "Calme et précise.",
        understanding: "Plombier résidentiel.",
      },
      "fallback.ca",
    );
    expect(draft.name).toBe("Plomberie Bélair");
    expect(draft.industry).toBe("services_domicile");
    expect(draft.tone).toBe("professionnel");
    expect(draft.languages).toEqual(["fr", "en"]);
  });

  it("force les enums inconnus vers des valeurs sûres", () => {
    const draft = validateDraft({ industry: "crypto_trading", tone: "agressif", languages: ["es"] }, "site.ca");
    expect(draft.industry).toBe("services_professionnels");
    expect(draft.tone).toBe("chaleureux");
    expect(draft.languages).toEqual(["fr"]); // jamais une langue non supportée
  });

  it("borne les listes et rejette les entrées vides ou trop courtes", () => {
    const draft = validateDraft(
      { services: ["", " ", "x", ...Array.from({ length: 12 }, (_, i) => `Service ${i}`)], serviceAreas: "pas-une-liste" },
      "site.ca",
    );
    expect(draft.services).toHaveLength(8);
    expect(draft.services[0]).toBe("Service 0");
    expect(draft.serviceAreas).toEqual([]);
  });

  it("retombe sur le nom de domaine quand le LLM ne fournit pas de nom", () => {
    const draft = validateDraft({}, "plomberiebelair.ca");
    expect(draft.name).toBe("plomberiebelair.ca");
    expect(draft.city).toBe("à préciser");
    expect(draft.persona.length).toBeGreaterThan(10);
  });
});
