import { describe, expect, it } from "vitest";
import type { Company } from "@/domain/company";
import { DEFAULT_COMPANY_ID, SEED_COMPANIES } from "@/data/companies";
import {
  InMemoryBusinessKnowledgeRepository,
  answerBusinessQuestion,
  approveKnowledgeItem,
  archiveKnowledgeItem,
  companyConfigKnowledge,
  createKnowledgeDraft,
  listBusinessKnowledgeItems,
} from "@/services/business-brain";

const NOW = new Date("2026-07-01T12:00:00.000Z");

function seedCompany(): Company {
  const company = SEED_COMPANIES.find((c) => c.id === DEFAULT_COMPANY_ID);
  if (!company) throw new Error("fixture: compagnie seed introuvable");
  return company;
}

describe("companyConfigKnowledge (seed depuis config existante)", () => {
  it("derive uniquement des champs de config approuves, sans rien inventer", () => {
    const company = seedCompany();
    const items = companyConfigKnowledge(company);

    // Toutes les sources config sont approuvees et etiquetees company_config.
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.status === "approved")).toBe(true);
    expect(items.every((item) => item.sourceType === "company_config")).toBe(true);
    expect(items.every((item) => item.companyId === company.id)).toBe(true);

    // Le contenu reflete la config reelle : aucun prix/horaire/service invente.
    const services = items.find((item) => item.title === "Services offerts");
    expect(services?.content).toBe(company.services.join(", "));
    const territory = items.find((item) => item.title === "Territoire desservi");
    expect(territory?.content).toBe(company.serviceAreas.join(", "));
  });
});

describe("answerBusinessQuestion (retrieval deterministe approved-only)", () => {
  it("utilise une connaissance approuvee et retourne une citation avec sourceLabel", () => {
    const company = seedCompany();
    const items = companyConfigKnowledge(company);

    const answer = answerBusinessQuestion("Quel territoire desservez-vous a Laval ?", items, NOW);

    expect(answer.status).toBe("answered");
    expect(answer.citations.length).toBeGreaterThan(0);
    const [citation] = answer.citations;
    expect(citation.sourceLabel).toBeTruthy();
    expect(citation.title).toBeTruthy();
    expect(citation.excerpt).toContain("Laval");
    expect(answer.refusedReason).toBeUndefined();
  });

  it("ignore les brouillons : ils ne sont jamais utilises dans les appels", () => {
    const draft = {
      id: "know_draft",
      companyId: "comp_test",
      title: "Politique de stationnement",
      content: "Le stationnement est gratuit pour les clients pendant les rendez-vous.",
      sourceLabel: "Proprietaire",
      sourceType: "owner_manual" as const,
      status: "draft" as const,
      createdAt: NOW.toISOString(),
    };

    const answer = answerBusinessQuestion("Le stationnement est-il gratuit ?", [draft], NOW);

    expect(answer.status).toBe("unknown");
    expect(answer.citations).toHaveLength(0);
    expect(answer.refusedReason).toBe("no_approved_source");
  });

  it("ignore les connaissances archivees", () => {
    const archived = {
      id: "know_archived",
      companyId: "comp_test",
      title: "Ancienne promotion",
      content: "Rabais saisonnier de printemps sur le deneigement.",
      sourceLabel: "Proprietaire",
      sourceType: "owner_manual" as const,
      status: "archived" as const,
      createdAt: NOW.toISOString(),
      approvedAt: NOW.toISOString(),
    };

    const answer = answerBusinessQuestion("Avez-vous un rabais de deneigement ?", [archived], NOW);

    expect(answer.status).toBe("unknown");
    expect(answer.citations).toHaveLength(0);
    expect(answer.refusedReason).toBe("no_approved_source");
  });

  it("refuse proprement quand aucune source approuvee ne repond", () => {
    const company = seedCompany();
    const items = companyConfigKnowledge(company);

    const answer = answerBusinessQuestion("Quelle est votre position sur la cryptomonnaie ?", items, NOW);

    expect(answer.status).toBe("unknown");
    expect(answer.citations).toHaveLength(0);
    expect(answer.refusedReason).toBe("no_approved_source");
    expect(answer.answer.length).toBeGreaterThan(0);
  });

  it("refuse quand la question est trop courte pour chercher", () => {
    const company = seedCompany();
    const items = companyConfigKnowledge(company);

    const answer = answerBusinessQuestion("?", items, NOW);

    expect(answer.status).toBe("unknown");
    expect(answer.refusedReason).toBe("question_too_short");
    expect(answer.citations).toHaveLength(0);
  });
});

describe("cycle de vie owner : draft -> approved -> archived", () => {
  it("une connaissance devient utilisable seulement apres approbation, puis redevient inerte apres archivage", async () => {
    const repo = new InMemoryBusinessKnowledgeRepository();
    const companyId = "comp_test";
    const question = "Le stationnement est-il gratuit ?";

    const draft = await createKnowledgeDraft(
      companyId,
      {
        title: "Politique de stationnement",
        content: "Le stationnement est gratuit pour les clients pendant les rendez-vous.",
        sourceLabel: "Proprietaire",
      },
      NOW,
      repo,
    );
    expect(draft.status).toBe("draft");
    expect(draft.approvedAt).toBeUndefined();

    // Draft en base : toujours refuse.
    let items = await repo.list(companyId);
    expect(answerBusinessQuestion(question, items, NOW).status).toBe("unknown");

    // Approbation : maintenant utilise + cite.
    const approved = await approveKnowledgeItem(companyId, draft.id, NOW, repo);
    expect(approved.status).toBe("approved");
    expect(approved.approvedAt).toBe(NOW.toISOString());

    items = await repo.list(companyId);
    const usable = answerBusinessQuestion(question, items, NOW);
    expect(usable.status).toBe("answered");
    expect(usable.citations[0]?.sourceLabel).toBe("Proprietaire");

    // Archivage : de nouveau ignore.
    const archived = await archiveKnowledgeItem(companyId, draft.id, repo);
    expect(archived.status).toBe("archived");

    items = await repo.list(companyId);
    expect(answerBusinessQuestion(question, items, NOW).status).toBe("unknown");
  });

  it("rejette un titre ou un contenu insuffisant", async () => {
    const repo = new InMemoryBusinessKnowledgeRepository();
    await expect(createKnowledgeDraft("comp_test", { title: "x", content: "trop court" }, NOW, repo)).rejects.toThrow();
    await expect(
      createKnowledgeDraft("comp_test", { title: "Titre valide", content: "court" }, NOW, repo),
    ).rejects.toThrow();
  });
});

describe("isolation multi-tenant", () => {
  it("un tenant ne voit pas les connaissances d'un autre tenant", async () => {
    const repo = new InMemoryBusinessKnowledgeRepository();
    await createKnowledgeDraft(
      "comp_a",
      { title: "Secret A", content: "Contenu confidentiel du tenant A pour test de scoping." },
      NOW,
      repo,
    );

    expect(await repo.list("comp_a")).toHaveLength(1);
    expect(await repo.list("comp_b")).toHaveLength(0);
  });

  it("empeche un tenant d'approuver ou d'archiver la connaissance d'un autre", async () => {
    const repo = new InMemoryBusinessKnowledgeRepository();
    const draft = await createKnowledgeDraft(
      "comp_a",
      { title: "Secret A", content: "Contenu confidentiel du tenant A pour test de scoping." },
      NOW,
      repo,
    );

    await expect(approveKnowledgeItem("comp_b", draft.id, NOW, repo)).rejects.toThrow();
    await expect(archiveKnowledgeItem("comp_b", draft.id, repo)).rejects.toThrow();

    // La connaissance du tenant A n'a pas ete alteree.
    const untouched = await repo.get(draft.id);
    expect(untouched?.status).toBe("draft");
  });

  it("protege la config approuvee : elle ne s'approuve ni ne s'archive via l'API owner", async () => {
    const repo = new InMemoryBusinessKnowledgeRepository();
    const company = seedCompany();
    const [configItem] = companyConfigKnowledge(company);
    await repo.save(configItem);

    await expect(approveKnowledgeItem(company.id, configItem.id, NOW, repo)).rejects.toThrow();
    await expect(archiveKnowledgeItem(company.id, configItem.id, repo)).rejects.toThrow();
  });
});

describe("listBusinessKnowledgeItems (fusion config + manuel)", () => {
  it("combine la config approuvee et les ajouts owner, config approuvee en tete", async () => {
    const repo = new InMemoryBusinessKnowledgeRepository();
    const company = seedCompany();
    await createKnowledgeDraft(
      company.id,
      { title: "Note owner", content: "Une note manuelle en attente d'approbation par le proprietaire." },
      NOW,
      repo,
    );

    const items = await listBusinessKnowledgeItems(company, repo);

    const configCount = companyConfigKnowledge(company).length;
    expect(items.length).toBe(configCount + 1);
    // Le tri stable place l'approuve avant le brouillon.
    expect(items[0]?.status).toBe("approved");
    expect(items.some((item) => item.title === "Note owner" && item.status === "draft")).toBe(true);
  });
});
