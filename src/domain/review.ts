export type ReviewReason =
  | "low_confidence"
  | "missing_required_field"
  | "field_conflict"
  | "unanswered_question"
  | "abandoned_call"
  | "uncertain_transfer"
  | "owner_correction";

export type ReviewStatus = "open" | "resolved" | "ignored";

export interface ReviewItem {
  id: string;
  companyId: string;
  callId: string;
  reason: ReviewReason;
  evidence: string;
  status: ReviewStatus;
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
}
