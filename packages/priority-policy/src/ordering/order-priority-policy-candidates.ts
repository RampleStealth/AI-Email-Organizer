import type { PriorityPolicyAdmissionCandidate } from "../admission/contract.js";
import type {
  CanonicalReason,
  EvaluatedOutcome,
  PriorityTier,
  ReasonCode,
  ReasonRole
} from "../domain/evaluation.js";
import type { ThreadId } from "../domain/identifiers.js";
import { isPriorityPolicyCandidateEligible } from "../evaluator/candidate-eligibility.js";
import {
  comparePriorityTiers,
  compareThreadIds,
  effectiveCandidateTimestamp,
  isCanonicalUuid,
  parseCanonicalTimestamp
} from "../internal/ordering-primitives.js";
import type {
  PriorityPolicyCollectionOrderingInput,
  PriorityPolicyOrderedEvaluatedCandidate,
  PriorityPolicyScopedEvaluation
} from "./contract.js";

interface RuntimeRecord {
  readonly [key: string]: unknown;
}

interface ValidatedCandidate {
  readonly candidate: PriorityPolicyAdmissionCandidate;
  readonly effectiveTimestamp: number | undefined;
}

interface BoundEvaluatedCandidate {
  readonly candidate: PriorityPolicyAdmissionCandidate;
  readonly evaluation: EvaluatedOutcome;
  readonly effectiveTimestamp: number | undefined;
  readonly identityOrder: number;
}

const CANONICAL_REASON_BY_CODE: Readonly<Record<ReasonCode, CanonicalReason>> =
  Object.freeze({
    USER_PRIORITIZE: "You prioritized this conversation.",
    USER_NOT_IMPORTANT: "You marked this conversation as not important.",
    PROVIDER_STAR: "Starred in your email provider.",
    RECENCY: "Received recently."
  });

function isRecord(value: unknown): value is RuntimeRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidInput(): never {
  throw new TypeError("Invalid Priority Policy collection ordering input.");
}

function isDeepFrozen(value: unknown): boolean {
  if (!isRecord(value)) {
    return true;
  }

  return Object.isFrozen(value) && Object.values(value).every(isDeepFrozen);
}

function isProviderStarState(value: unknown): boolean {
  return (
    value === "VERIFIED_PRESENT" ||
    value === "VERIFIED_ABSENT" ||
    value === "UNKNOWN"
  );
}

function isCorrectionEvidence(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  if (value.state === "VERIFIED_ABSENT" || value.state === "UNKNOWN") {
    return true;
  }

  return (
    value.state === "VERIFIED_ACTIVE" &&
    (value.kind === "PRIORITIZE" || value.kind === "NOT_IMPORTANT") &&
    isCanonicalUuid(value.transitionId)
  );
}

function isReasonRole(value: unknown): value is ReasonRole {
  return value === "DETERMINING" || value === "SUPPORTING";
}

function isReasonCode(value: unknown): value is ReasonCode {
  return (
    value === "USER_PRIORITIZE" ||
    value === "USER_NOT_IMPORTANT" ||
    value === "PROVIDER_STAR" ||
    value === "RECENCY"
  );
}

function validateReasonArrays(evaluation: RuntimeRecord): void {
  const reasonCodes = evaluation.reasonCodes;
  const reasons = evaluation.reasons;
  const reasonRoles = evaluation.reasonRoles;

  if (
    !Array.isArray(reasonCodes) ||
    !Array.isArray(reasons) ||
    !Array.isArray(reasonRoles) ||
    reasonCodes.length !== reasons.length ||
    reasonCodes.length !== reasonRoles.length
  ) {
    return invalidInput();
  }

  const seenReasonCodes = new Set<ReasonCode>();
  for (let index = 0; index < reasonCodes.length; index += 1) {
    const reasonCode = reasonCodes[index];
    if (
      !isReasonCode(reasonCode) ||
      reasons[index] !== CANONICAL_REASON_BY_CODE[reasonCode] ||
      !isReasonRole(reasonRoles[index]) ||
      seenReasonCodes.has(reasonCode)
    ) {
      return invalidInput();
    }
    seenReasonCodes.add(reasonCode);
  }
}

function validateCandidate(
  value: unknown,
  ownerId: string,
  mailboxId: string,
  evaluatedAt: number
): ValidatedCandidate {
  if (
    !isRecord(value) ||
    !isRecord(value.scope) ||
    value.scope.ownerId !== ownerId ||
    value.scope.mailboxId !== mailboxId ||
    !isCanonicalUuid(value.threadId) ||
    !isRecord(value.providerBinding) ||
    !isCanonicalUuid(value.providerBinding.transitionId) ||
    !isRecord(value.providerStar) ||
    !isProviderStarState(value.providerStar.state) ||
    !isCorrectionEvidence(value.correction) ||
    !isPriorityPolicyCandidateEligible(
      value.location as PriorityPolicyAdmissionCandidate["location"]
    ) ||
    !isDeepFrozen(value)
  ) {
    return invalidInput();
  }

  let effectiveTimestamp: number | undefined;
  try {
    effectiveTimestamp = effectiveCandidateTimestamp(
      value.candidateTimestamp as PriorityPolicyAdmissionCandidate["candidateTimestamp"],
      evaluatedAt
    );
  } catch {
    return invalidInput();
  }

  return {
    candidate: value as unknown as PriorityPolicyAdmissionCandidate,
    effectiveTimestamp
  };
}

function validateScopedEvaluation(
  value: unknown,
  ownerId: string,
  mailboxId: string,
  policyVersion: string,
  evaluatedAt: string
): PriorityPolicyScopedEvaluation {
  if (
    !isRecord(value) ||
    !isRecord(value.scope) ||
    value.scope.ownerId !== ownerId ||
    value.scope.mailboxId !== mailboxId ||
    !isRecord(value.evaluation)
  ) {
    return invalidInput();
  }

  const evaluation = value.evaluation;
  if (
    evaluation.kind !== "EVALUATED" ||
    !isCanonicalUuid(evaluation.threadId) ||
    evaluation.policyVersion !== policyVersion ||
    evaluation.evaluatedAt !== evaluatedAt ||
    parseCanonicalTimestamp(evaluation.evaluatedAt) === undefined
  ) {
    return invalidInput();
  }

  try {
    comparePriorityTiers(
      evaluation.tier as PriorityTier,
      evaluation.tier as PriorityTier
    );
  } catch {
    return invalidInput();
  }

  validateReasonArrays(evaluation);
  return value as unknown as PriorityPolicyScopedEvaluation;
}

function copyEvaluation(evaluation: EvaluatedOutcome): EvaluatedOutcome {
  const reasonCodes = Object.freeze([...evaluation.reasonCodes]);
  const reasons = Object.freeze([...evaluation.reasons]);
  const reasonRoles = Object.freeze([...evaluation.reasonRoles]);

  return Object.freeze({
    kind: "EVALUATED",
    threadId: evaluation.threadId,
    tier: evaluation.tier,
    reasonCodes,
    reasons,
    reasonRoles,
    policyVersion: evaluation.policyVersion,
    evaluatedAt: evaluation.evaluatedAt
  });
}

function compareBoundCandidates(
  left: BoundEvaluatedCandidate,
  right: BoundEvaluatedCandidate
): number {
  const tierDifference = comparePriorityTiers(
    left.evaluation.tier,
    right.evaluation.tier
  );
  if (tierDifference !== 0) {
    return tierDifference;
  }

  if (
    left.effectiveTimestamp !== undefined &&
    right.effectiveTimestamp === undefined
  ) {
    return -1;
  }

  if (
    left.effectiveTimestamp === undefined &&
    right.effectiveTimestamp !== undefined
  ) {
    return 1;
  }

  if (
    left.effectiveTimestamp !== undefined &&
    right.effectiveTimestamp !== undefined
  ) {
    const timestampDifference =
      right.effectiveTimestamp - left.effectiveTimestamp;
    if (timestampDifference !== 0) {
      return timestampDifference;
    }
  }

  return left.identityOrder - right.identityOrder;
}

function validateInput(input: PriorityPolicyCollectionOrderingInput): {
  readonly candidates: readonly ValidatedCandidate[];
  readonly evaluationsByThreadId: ReadonlyMap<ThreadId, EvaluatedOutcome>;
} {
  const runtimeInput = input as unknown;
  if (!isRecord(runtimeInput)) {
    return invalidInput();
  }

  const scope = runtimeInput.scope;
  const context = runtimeInput.context;
  const admittedCandidates = runtimeInput.admittedCandidates;
  const evaluations = runtimeInput.evaluations;
  if (
    !isRecord(scope) ||
    !isRecord(context) ||
    !Array.isArray(admittedCandidates) ||
    !Array.isArray(evaluations) ||
    admittedCandidates.length > 100 ||
    evaluations.length > 100 ||
    !isCanonicalUuid(scope.ownerId) ||
    !isCanonicalUuid(scope.mailboxId)
  ) {
    return invalidInput();
  }

  const parameters = context.parameters;
  const evaluatedAt = parseCanonicalTimestamp(context.evaluatedAt);
  if (
    context.policyVersion !== "1.0" ||
    evaluatedAt === undefined ||
    !isRecord(parameters) ||
    parameters.futureSkewTolerance !== "PT5M"
  ) {
    return invalidInput();
  }

  const seenCandidateIds = new Set<string>();
  const candidates = admittedCandidates.map((candidate) => {
    const validated = validateCandidate(
      candidate,
      scope.ownerId as string,
      scope.mailboxId as string,
      evaluatedAt
    );
    if (seenCandidateIds.has(validated.candidate.threadId)) {
      return invalidInput();
    }
    seenCandidateIds.add(validated.candidate.threadId);
    return validated;
  });

  const evaluationsByThreadId = new Map<ThreadId, EvaluatedOutcome>();
  for (const evaluation of evaluations) {
    const validated = validateScopedEvaluation(
      evaluation,
      scope.ownerId as string,
      scope.mailboxId as string,
      context.policyVersion as string,
      context.evaluatedAt as string
    );
    const threadId = validated.evaluation.threadId;
    if (evaluationsByThreadId.has(threadId)) {
      return invalidInput();
    }
    evaluationsByThreadId.set(threadId, validated.evaluation);
  }

  if (
    candidates.length !== evaluationsByThreadId.size ||
    candidates.some(
      ({ candidate }) => !evaluationsByThreadId.has(candidate.threadId)
    )
  ) {
    return invalidInput();
  }

  return { candidates, evaluationsByThreadId };
}

export function orderPriorityPolicyCandidates(
  input: PriorityPolicyCollectionOrderingInput
): readonly PriorityPolicyOrderedEvaluatedCandidate[] {
  const validated = validateInput(input);
  const orderedThreadIds = validated.candidates
    .map(({ candidate }) => candidate.threadId)
    .sort(compareThreadIds);
  const identityOrderByThreadId = new Map(
    orderedThreadIds.map((threadId, index) => [threadId, index])
  );
  const bound: BoundEvaluatedCandidate[] = validated.candidates.map(
    ({ candidate, effectiveTimestamp }) => ({
      candidate,
      evaluation: copyEvaluation(
        validated.evaluationsByThreadId.get(candidate.threadId)!
      ),
      effectiveTimestamp,
      identityOrder: identityOrderByThreadId.get(candidate.threadId)!
    })
  );

  bound.sort(compareBoundCandidates);

  return Object.freeze(
    bound.map(({ candidate, evaluation }) =>
      Object.freeze({ candidate, evaluation })
    )
  );
}
