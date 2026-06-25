import type { Call } from "@/domain/call";
import type { ReviewItem, ReviewReason } from "@/domain/review";

interface ReviewInput {
  call: Call;
  requiredFields: string[];
  now?: Date;
  confidenceThreshold?: number;
}

function reviewId(callId: string, reason: ReviewReason, suffix = "general"): string {
  return `review_${callId}_${reason}_${suffix}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function item(call: Call, reason: ReviewReason, evidence: string, now: Date, suffix?: string): ReviewItem {
  return {
    id: reviewId(call.id, reason, suffix),
    companyId: call.companyId,
    callId: call.id,
    reason,
    evidence,
    status: "open",
    createdAt: now.toISOString(),
  };
}

export function createReviewItems({
  call,
  requiredFields,
  now = new Date(),
  confidenceThreshold = 0.7,
}: ReviewInput): ReviewItem[] {
  const reviews: ReviewItem[] = [];
  const fields = call.intelligence?.collectedFields ?? {};

  for (const field of requiredFields) {
    if (!String(fields[field] ?? "").trim()) {
      reviews.push(item(call, "missing_required_field", `Champ requis manquant : ${field}.`, now, field));
    }
  }

  if (call.intelligence && call.intelligence.confidence < confidenceThreshold) {
    reviews.push(
      item(
        call,
        "low_confidence",
        `Confiance globale ${Math.round(call.intelligence.confidence * 100)} %, sous le seuil ${Math.round(confidenceThreshold * 100)} %.`,
        now,
      ),
    );
  }

  if (call.status === "abandoned") {
    reviews.push(item(call, "abandoned_call", "L'appel s'est terminé avant un résultat exploitable.", now));
  }

  return reviews;
}
