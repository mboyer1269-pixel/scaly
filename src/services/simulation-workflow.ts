import type { ReadinessEvidence, RealityLabel } from "@/domain/readiness";
import type { ReviewItem } from "@/domain/review";
import type { ScalyAction } from "@/domain/action";
import type { Call } from "@/domain/call";
import type { ScalyRepository } from "@/server/store";
import { consentFromCall } from "./consent";
import { validateCallOutcome } from "./outcome";
import { deriveCallReality } from "./reality";
import { createReviewItems } from "./review";
import { simulateCall, type SimulationInput } from "./simulator";

export interface SimulationWorkflowResult {
  call: Call;
  actions: ScalyAction[];
  reviewItems: ReviewItem[];
  reality: RealityLabel;
  auditRecorded: boolean;
}

export async function runSimulationWorkflow(
  repository: ScalyRepository,
  input: SimulationInput,
): Promise<SimulationWorkflowResult> {
  const result = simulateCall(input);
  const outcome = validateCallOutcome(result.call);
  if (!outcome.valid) {
    throw new Error(`Le scénario se termine sans résultat exploitable : ${outcome.reason}`);
  }

  await repository.addCall(result.call, result.actions);

  const consent = consentFromCall(result.call, input.at ?? new Date());
  if (consent) await repository.saveConsent(consent);

  const requiredFields = input.script.questions
    .filter((question) => question.required)
    .map((question) => question.fieldKey);
  const reviewItems = createReviewItems({
    call: result.call,
    requiredFields,
    now: input.at ?? new Date(),
    confidenceThreshold: 0.9,
  });
  for (const review of reviewItems) {
    await repository.saveReviewItem(review);
  }

  const reality = deriveCallReality(result.call, repository.info());
  const evidence: ReadinessEvidence = {
    id: `evidence_demo_${result.call.id}`,
    companyId: result.call.companyId,
    kind: "demo",
    status: reality.state,
    label: reality.label,
    detail: `Appel ${result.call.id}, ${result.actions.length} action(s) et ${reviewItems.length} révision(s) relus dans le repository partagé.`,
    callId: result.call.id,
    createdAt: (input.at ?? new Date()).toISOString(),
  };
  await repository.saveReadinessEvidence(evidence);
  await repository.recordAudit({
    companyId: result.call.companyId,
    actor: "allo-maude",
    event: "preuve_verticale_enregistrée",
    detail: `${result.call.id}: ${outcome.reason}`,
  });

  return {
    ...result,
    reviewItems,
    reality,
    auditRecorded: true,
  };
}
