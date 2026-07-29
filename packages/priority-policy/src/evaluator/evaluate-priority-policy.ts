import type {
  CanonicalReason,
  EvaluatedOutcome,
  PriorityPolicyEvaluationOutcome,
  PriorityTier,
  ReasonCode,
  ReasonRole
} from "../domain/evaluation.js";
import type { ProviderStarEvidence } from "../domain/evidence.js";
import type { PriorityPolicyEvaluatorInput } from "./contract.js";

export class PriorityPolicyEvaluatorNotImplementedError extends Error {
  readonly code = "PRIORITY_POLICY_EVALUATOR_NOT_IMPLEMENTED";

  constructor() {
    super("Priority Policy evaluation is not implemented for this input.");
    this.name = "PriorityPolicyEvaluatorNotImplementedError";
  }
}

type ProviderStarState = ProviderStarEvidence["state"];
type ProviderStarEvaluator = (
  input: PriorityPolicyEvaluatorInput
) => EvaluatedOutcome;

function createEvaluatedOutcome(
  input: PriorityPolicyEvaluatorInput,
  tier: PriorityTier,
  reasonCodes: readonly ReasonCode[],
  reasons: readonly CanonicalReason[],
  reasonRoles: readonly ReasonRole[]
): EvaluatedOutcome {
  return {
    kind: "EVALUATED",
    threadId: input.candidate.threadId,
    tier,
    reasonCodes,
    reasons,
    reasonRoles,
    policyVersion: input.context.policyVersion,
    evaluatedAt: input.context.evaluatedAt
  };
}

function evaluateProviderStarPresent(
  input: PriorityPolicyEvaluatorInput
): EvaluatedOutcome {
  return createEvaluatedOutcome(
    input,
    "REVIEW_LATER",
    ["PROVIDER_STAR"],
    ["Starred in your email provider."],
    ["DETERMINING"]
  );
}

function evaluateProviderStarAbsent(
  input: PriorityPolicyEvaluatorInput
): EvaluatedOutcome {
  return createEvaluatedOutcome(input, "NO_IMMEDIATE_SIGNALS", [], [], []);
}

function evaluateProviderStarUnknown(
  input: PriorityPolicyEvaluatorInput
): EvaluatedOutcome {
  return createEvaluatedOutcome(input, "NO_IMMEDIATE_SIGNALS", [], [], []);
}

const PROVIDER_STAR_EVALUATORS: Readonly<
  Record<ProviderStarState, ProviderStarEvaluator>
> = Object.freeze({
  VERIFIED_PRESENT: evaluateProviderStarPresent,
  VERIFIED_ABSENT: evaluateProviderStarAbsent,
  UNKNOWN: evaluateProviderStarUnknown
});

function assertSupportedMilestone4BInput(
  input: PriorityPolicyEvaluatorInput
): void {
  if (input.candidate.correction.state !== "VERIFIED_ABSENT") {
    throw new PriorityPolicyEvaluatorNotImplementedError();
  }

  const locationState = [
    input.candidate.location.inbox.state,
    input.candidate.location.spam.state,
    input.candidate.location.trash.state
  ].join("|");

  if (
    locationState !== "VERIFIED_PRESENT|VERIFIED_ABSENT|VERIFIED_ABSENT"
  ) {
    throw new PriorityPolicyEvaluatorNotImplementedError();
  }
}

export function evaluatePriorityPolicy(
  input: PriorityPolicyEvaluatorInput
): PriorityPolicyEvaluationOutcome {
  assertSupportedMilestone4BInput(input);

  return PROVIDER_STAR_EVALUATORS[input.candidate.providerStar.state](input);
}
