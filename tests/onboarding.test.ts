import { describe, expect, it } from "vitest";
import { SEED_AGENTS, SEED_COMPANIES } from "@/data/companies";
import { buildRealtimePrompt } from "@/services/voice-prompt";
import { getScriptByIndustry } from "@/data/industry-scripts";
import {
  buildCoachingDraft,
  extractWebsiteText,
  isForbiddenHost,
  validateCoachingDraft,
  validateDraft,
} from "@/services/onboarding";

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

describe("isForbiddenHost (garde SSRF)", () => {
  it("refuse loopback, privé, link-local, métadonnées cloud et hôtes internes", () => {
    for (const h of [
      "localhost", "api.localhost", "intranet.local", "db.internal", "serveur-sans-point",
      "127.0.0.1", "10.0.0.5", "172.16.0.1", "172.31.255.255", "192.168.1.1",
      "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "::ffff:127.0.0.1", "fe80::1", "fd00::1",
    ]) {
      expect(isForbiddenHost(h), h).toBe(true);
    }
  });

  it("accepte les sites publics", () => {
    for (const h of ["plomberiebelair.ca", "www.example.com", "8.8.8.8", "172.32.0.1", "100.128.0.1"]) {
      expect(isForbiddenHost(h), h).toBe(false);
    }
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

describe("coaching de Maude", () => {
  const company = SEED_COMPANIES[0];
  const agent = SEED_AGENTS[0];

  it("conserve la consigne exacte du propriétaire et la description de l'entreprise", () => {
    const instruction =
      "Nous sommes une plomberie familiale. Maude doit rester calme et transférer immédiatement les urgences.";
    const draft = buildCoachingDraft(company, agent, instruction);

    expect(draft.businessDescription).toBe(instruction);
    expect(draft.ownerInstructions).toContain(instruction);
    expect(draft.changedFields).toContain("businessDescription");
    expect(draft.changedFields).toContain("ownerInstructions");
  });

  it("structure les consignes reconnues sans inventer le reste", () => {
    const draft = buildCoachingDraft(
      company,
      agent,
      [
        "Nous offrons : débouchage commercial, inspection par caméra.",
        "Nous desservons : Laval, Terrebonne.",
        "Ton calme.",
        "Demande toujours si l'entrée d'eau est fermée.",
        "Ne jamais promettre une heure d'arrivée.",
        "Commence par « Bonjour, Plomberie Bélair, ici Maude. Comment puis-je vous aider? »",
        "Transfère toute urgence critique au propriétaire.",
      ].join(" "),
    );

    expect(draft.tone).toBe("calme");
    expect(draft.services).toEqual(expect.arrayContaining(["débouchage commercial", "inspection par caméra"]));
    expect(draft.serviceAreas).toEqual(expect.arrayContaining(["Laval", "Terrebonne"]));
    expect(draft.essentialQuestions).toContain("si l'entrée d'eau est fermée");
    expect(draft.forbiddenPhrases).toContain("promettre une heure d'arrivée");
    expect(draft.greetingScript).toBe("Bonjour, Plomberie Bélair, ici Maude. Comment puis-je vous aider?");
    expect(draft.transferPolicy).toContain("urgence critique");
  });

  it("revalide et borne un brouillon de coaching reçu du client", () => {
    const draft = validateCoachingDraft(
      {
        businessDescription: "  Une entreprise locale.  ",
        tone: "agressif",
        services: Array.from({ length: 20 }, (_, i) => `Service ${i}`),
        ownerInstructions: ["  Toujours confirmer le numéro.  ", "", 42],
        style: "  Bref et clair.  ",
      },
      company,
      agent,
    );

    expect(draft.businessDescription).toBe("Une entreprise locale.");
    expect(draft.tone).toBe(company.tone);
    expect(draft.services).toHaveLength(12);
    expect(draft.ownerInstructions).toEqual(["Toujours confirmer le numéro."]);
    expect(draft.style).toBe("Bref et clair.");
  });

  it("injecte la description et les consignes approuvées dans le vrai prompt vocal", () => {
    const script = getScriptByIndustry(company.industry);
    const prompt = buildRealtimePrompt({
      company: { ...company, businessDescription: "Plomberie familiale spécialisée en urgences résidentielles." },
      agent: {
        ...agent,
        ownerInstructions: [
          "Toujours confirmer si l'entrée d'eau principale est fermée.",
          "Ne jamais promettre une heure d'arrivée.",
        ],
      },
      script,
    });

    expect(prompt).toContain("Plomberie familiale spécialisée en urgences résidentielles.");
    expect(prompt).toContain("Toujours confirmer si l'entrée d'eau principale est fermée.");
    expect(prompt).toContain("Ne jamais promettre une heure d'arrivée.");
  });
});
