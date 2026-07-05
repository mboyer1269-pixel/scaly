/** Domaine — Business Brain approuvé (Phase 4). */

export type BusinessKnowledgeStatus = "draft" | "approved" | "archived";
export type BusinessKnowledgeSourceType = "company_config" | "owner_manual" | "website" | "onboarding";

export interface BusinessKnowledgeItem {
  id: string;
  companyId: string;
  title: string;
  content: string;
  sourceLabel: string;
  sourceType: BusinessKnowledgeSourceType;
  status: BusinessKnowledgeStatus;
  createdAt: string;
  approvedAt?: string;
  expiresAt?: string;
}

export interface BusinessBrainCitation {
  itemId: string;
  title: string;
  sourceLabel: string;
  excerpt: string;
}

export interface BusinessBrainAnswer {
  status: "answered" | "unknown";
  answer: string;
  citations: BusinessBrainCitation[];
  refusedReason?: string;
}
