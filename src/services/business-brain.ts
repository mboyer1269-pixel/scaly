/**
 * Service — Business Brain approuve, cite et refuse proprement.
 *
 * Cette premiere tranche est volontairement deterministe : pas de vecteurs, pas
 * de LLM, pas de Prisma. Les connaissances approuvees depuis la config tenant
 * sont toujours disponibles; les brouillons owner restent inactifs tant qu'ils
 * ne sont pas approuves.
 */
import type { BusinessBrainAnswer, BusinessBrainCitation, BusinessKnowledgeItem } from "@/domain/business-brain";
import type { Company } from "@/domain/company";
import { newId } from "@/lib/format";

export interface BusinessKnowledgeRepository {
  list(companyId: string): Promise<BusinessKnowledgeItem[]>;
  get(id: string): Promise<BusinessKnowledgeItem | undefined>;
  save(item: BusinessKnowledgeItem): Promise<BusinessKnowledgeItem>;
  /** Supprime toutes les connaissances du tenant (droit à l'effacement — Loi 25). Retourne le nombre supprimé. */
  deleteByCompany(companyId: string): Promise<number>;
}

export class InMemoryBusinessKnowledgeRepository implements BusinessKnowledgeRepository {
  private items = new Map<string, BusinessKnowledgeItem>();

  async list(companyId: string): Promise<BusinessKnowledgeItem[]> {
    return [...this.items.values()]
      .filter((item) => item.companyId === companyId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(id: string): Promise<BusinessKnowledgeItem | undefined> {
    return this.items.get(id);
  }

  async save(item: BusinessKnowledgeItem): Promise<BusinessKnowledgeItem> {
    this.items.set(item.id, item);
    return item;
  }

  async deleteByCompany(companyId: string): Promise<number> {
    let count = 0;
    for (const [id, item] of [...this.items]) {
      if (item.companyId === companyId) {
        this.items.delete(id);
        count += 1;
      }
    }
    return count;
  }
}

export function getBusinessKnowledgeRepository(): BusinessKnowledgeRepository {
  const g = globalThis as { __scalyBusinessKnowledge?: BusinessKnowledgeRepository };
  if (g.__scalyBusinessKnowledge) return g.__scalyBusinessKnowledge;
  const repo: BusinessKnowledgeRepository =
    process.env.STORE_PROVIDER === "prisma"
      ? new (require("../server/prisma-phase4-repos").PrismaBusinessKnowledgeRepository)()
      : new InMemoryBusinessKnowledgeRepository();
  g.__scalyBusinessKnowledge = repo;
  return repo;
}

function cleanText(value: unknown, max = 4000): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function source(id: string, company: Company, title: string, content: string): BusinessKnowledgeItem {
  return {
    id: `config_${company.id}_${id}`,
    companyId: company.id,
    title,
    content,
    sourceLabel: "Configuration approuvee",
    sourceType: "company_config",
    status: "approved",
    createdAt: company.createdAt,
    approvedAt: company.createdAt,
  };
}

export function companyConfigKnowledge(company: Company): BusinessKnowledgeItem[] {
  const items: BusinessKnowledgeItem[] = [];
  if (company.businessDescription) {
    items.push(source("description", company, "Description de l'entreprise", company.businessDescription));
  }
  if (company.services.length) {
    items.push(source("services", company, "Services offerts", company.services.join(", ")));
  }
  if (company.serviceAreas.length) {
    items.push(source("territory", company, "Territoire desservi", company.serviceAreas.join(", ")));
  }
  if (company.policies.length) {
    items.push(source("policies", company, "Politiques approuvees", company.policies.join(" ")));
  }
  if (company.essentialQuestions.length) {
    items.push(source("questions", company, "Questions essentielles", company.essentialQuestions.join(" ")));
  }
  return items;
}

export async function listBusinessKnowledgeItems(
  company: Company,
  repo: BusinessKnowledgeRepository = getBusinessKnowledgeRepository(),
): Promise<BusinessKnowledgeItem[]> {
  const manual = await repo.list(company.id);
  return [...companyConfigKnowledge(company), ...manual].sort((a, b) => {
    if (a.status !== b.status) return a.status === "approved" ? -1 : b.status === "approved" ? 1 : 0;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export async function createKnowledgeDraft(
  companyId: string,
  input: { title: string; content: string; sourceLabel?: string },
  now = new Date(),
  repo: BusinessKnowledgeRepository = getBusinessKnowledgeRepository(),
): Promise<BusinessKnowledgeItem> {
  const title = cleanText(input.title, 120);
  const content = cleanText(input.content, 4000);
  if (title.length < 3) throw new Error("Titre requis.");
  if (content.length < 20) throw new Error("Contenu requis (20 caracteres minimum).");
  return repo.save({
    id: newId("knowledge"),
    companyId,
    title,
    content,
    sourceLabel: cleanText(input.sourceLabel, 120) || "Ajout manuel proprietaire",
    sourceType: "owner_manual",
    status: "draft",
    createdAt: now.toISOString(),
  });
}

export async function approveKnowledgeItem(
  companyId: string,
  itemId: string,
  now = new Date(),
  repo: BusinessKnowledgeRepository = getBusinessKnowledgeRepository(),
): Promise<BusinessKnowledgeItem> {
  const item = await repo.get(itemId);
  if (!item || item.companyId !== companyId) throw new Error("Connaissance introuvable.");
  if (item.sourceType === "company_config") throw new Error("La configuration approuvee est deja active.");
  const approved: BusinessKnowledgeItem = { ...item, status: "approved", approvedAt: now.toISOString() };
  return repo.save(approved);
}

export async function archiveKnowledgeItem(
  companyId: string,
  itemId: string,
  repo: BusinessKnowledgeRepository = getBusinessKnowledgeRepository(),
): Promise<BusinessKnowledgeItem> {
  const item = await repo.get(itemId);
  if (!item || item.companyId !== companyId) throw new Error("Connaissance introuvable.");
  if (item.sourceType === "company_config") throw new Error("La configuration approuvee se modifie dans Reglages.");
  return repo.save({ ...item, status: "archived" });
}

function normalize(text: string): string[] {
  return text
    .toLocaleLowerCase("fr-CA")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 3)
    .filter((token) => !["avec", "dans", "pour", "des", "les", "une", "est", "sur", "vous", "nous", "notre", "votre"].includes(token));
}

function score(questionTokens: string[], item: BusinessKnowledgeItem): number {
  const haystack = new Set(normalize(`${item.title} ${item.content}`));
  return questionTokens.reduce((sum, token) => sum + (haystack.has(token) ? 1 : 0), 0);
}

function active(item: BusinessKnowledgeItem, now: Date): boolean {
  if (item.status !== "approved") return false;
  if (!item.expiresAt) return true;
  return new Date(item.expiresAt).getTime() > now.getTime();
}

function excerpt(content: string, tokens: string[]): string {
  const sentences = content.split(/(?<=[.!?])\s+/).filter(Boolean);
  const hit = sentences.find((sentence) => {
    const sentenceTokens = new Set(normalize(sentence));
    return tokens.some((token) => sentenceTokens.has(token));
  });
  return (hit ?? content).slice(0, 220);
}

export function answerBusinessQuestion(
  question: string,
  items: BusinessKnowledgeItem[],
  now = new Date(),
): BusinessBrainAnswer {
  const tokens = normalize(question);
  if (tokens.length === 0) {
    return {
      status: "unknown",
      answer: "Je ne sais pas encore: la question est trop courte pour trouver une connaissance approuvee.",
      citations: [],
      refusedReason: "question_too_short",
    };
  }

  const ranked = items
    .filter((item) => active(item, now))
    .map((item) => ({ item, score: score(tokens, item) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, "fr-CA"));

  if (!ranked.length) {
    return {
      status: "unknown",
      answer: "Je ne sais pas encore avec les connaissances approuvees. Maude doit demander une validation humaine au lieu d'inventer.",
      citations: [],
      refusedReason: "no_approved_source",
    };
  }

  const citations: BusinessBrainCitation[] = ranked.slice(0, 3).map(({ item }) => ({
    itemId: item.id,
    title: item.title,
    sourceLabel: item.sourceLabel,
    excerpt: excerpt(item.content, tokens),
  }));
  const lead = citations[0];
  return {
    status: "answered",
    answer: `Selon "${lead.title}", ${lead.excerpt}`,
    citations,
  };
}
