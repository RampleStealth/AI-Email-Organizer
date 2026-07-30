import type { PriorityPolicyAdmissionCandidate } from "../admission/contract.js";
import type { EvaluatedOutcome } from "../domain/evaluation.js";
import type {
  CanonicalTimestamp,
  MailboxId,
  OwnerId
} from "../domain/identifiers.js";
import {
  effectiveCandidateTimestamp,
  isCanonicalUuid,
  parseCanonicalTimestamp
} from "../internal/ordering-primitives.js";
import type {
  PriorityPolicyOrderedEvaluatedCandidate,
  PriorityPolicyScopedEvaluation
} from "../ordering/contract.js";
import { orderPriorityPolicyCandidates } from "../ordering/order-priority-policy-candidates.js";
import type {
  PriorityPolicyCandidateScope,
  PriorityPolicyCollectionDelivery,
  PriorityPolicyCollectionEvaluation,
  PriorityPolicyCollectionEvaluationInput,
  PriorityPolicyEvidenceCompleteness,
  PriorityPolicyIncompleteEvidence,
  PriorityPolicyIncompleteEvidenceKind,
  PriorityPolicySynchronizationCoverage
} from "./contract.js";

const EVALUATION_VALIDITY_MILLISECONDS = 5 * 60 * 1000;
const STALE_RETENTION_MILLISECONDS = 24 * 60 * 60 * 1000;

interface RuntimeRecord {
  readonly [key: string]: unknown;
}

interface ValidatedInput {
  readonly evaluatedAt: CanonicalTimestamp;
  readonly evaluatedAtMilliseconds: number;
  readonly coverage: PriorityPolicySynchronizationCoverage;
  readonly returnedCandidateCount: number;
  readonly continuationAvailable: boolean;
  readonly orderedCandidates:
    readonly PriorityPolicyOrderedEvaluatedCandidate[];
}

function isRecord(value: unknown): value is RuntimeRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidInput(): never {
  throw new TypeError("Invalid Priority Policy collection evaluation input.");
}

function canonicalBoundary(
  evaluatedAtMilliseconds: number,
  durationMilliseconds: number
): CanonicalTimestamp {
  const boundary = evaluatedAtMilliseconds + durationMilliseconds;
  const serialized = new Date(boundary).toISOString();

  return parseCanonicalTimestamp(serialized) === undefined
    ? invalidInput()
    : (serialized as CanonicalTimestamp);
}

function verifyCanonicalOrder(
  orderedCandidates: readonly PriorityPolicyOrderedEvaluatedCandidate[],
  ownerId: OwnerId,
  mailboxId: MailboxId,
  evaluatedAt: CanonicalTimestamp
): readonly PriorityPolicyOrderedEvaluatedCandidate[] {
  const admittedCandidates: PriorityPolicyAdmissionCandidate[] = [];
  const evaluations: PriorityPolicyScopedEvaluation[] = [];

  for (const value of orderedCandidates as readonly unknown[]) {
    if (!isRecord(value)) {
      return invalidInput();
    }

    admittedCandidates.push(
      value.candidate as PriorityPolicyAdmissionCandidate
    );
    evaluations.push({
      scope: { ownerId, mailboxId },
      evaluation: value.evaluation as EvaluatedOutcome
    });
  }

  let canonical: readonly PriorityPolicyOrderedEvaluatedCandidate[];
  try {
    canonical = orderPriorityPolicyCandidates({
      scope: { ownerId, mailboxId },
      admittedCandidates,
      evaluations,
      context: {
        policyVersion: "1.0",
        evaluatedAt,
        parameters: { futureSkewTolerance: "PT5M" }
      }
    });
  } catch {
    return invalidInput();
  }

  for (let index = 0; index < canonical.length; index += 1) {
    if (
      orderedCandidates[index]!.candidate.threadId !==
      canonical[index]!.candidate.threadId
    ) {
      return invalidInput();
    }
  }

  return canonical;
}

function validateInput(
  input: PriorityPolicyCollectionEvaluationInput
): ValidatedInput {
  const runtimeInput = input as unknown;
  if (!isRecord(runtimeInput)) {
    return invalidInput();
  }

  const scope = runtimeInput.scope;
  const context = runtimeInput.context;
  const synchronization = runtimeInput.synchronization;
  const delivery = runtimeInput.delivery;
  const orderedCandidates = runtimeInput.orderedCandidates;

  if (
    !isRecord(scope) ||
    !isRecord(context) ||
    !isRecord(synchronization) ||
    !isRecord(delivery) ||
    !Array.isArray(orderedCandidates) ||
    !isCanonicalUuid(scope.ownerId) ||
    !isCanonicalUuid(scope.mailboxId)
  ) {
    return invalidInput();
  }

  const evaluatedAtMilliseconds = parseCanonicalTimestamp(context.evaluatedAt);
  if (
    context.policyVersion !== "1.0" ||
    evaluatedAtMilliseconds === undefined ||
    (synchronization.coverage !== "READY" &&
      synchronization.coverage !== "PARTIAL") ||
    !Number.isSafeInteger(delivery.returnedCandidateCount) ||
    (delivery.returnedCandidateCount as number) < 0 ||
    typeof delivery.continuationAvailable !== "boolean"
  ) {
    return invalidInput();
  }

  const canonical = verifyCanonicalOrder(
    orderedCandidates as unknown as readonly PriorityPolicyOrderedEvaluatedCandidate[],
    scope.ownerId as OwnerId,
    scope.mailboxId as MailboxId,
    context.evaluatedAt as CanonicalTimestamp
  );

  const returnedCandidateCount = delivery.returnedCandidateCount as number;
  const continuationAvailable = delivery.continuationAvailable;
  if (
    returnedCandidateCount > canonical.length ||
    (returnedCandidateCount === canonical.length && continuationAvailable)
  ) {
    return invalidInput();
  }

  return {
    evaluatedAt: context.evaluatedAt as CanonicalTimestamp,
    evaluatedAtMilliseconds,
    coverage: synchronization.coverage,
    returnedCandidateCount,
    continuationAvailable,
    orderedCandidates: canonical
  };
}

function candidateScope(): PriorityPolicyCandidateScope {
  const requiredPresentLocations = Object.freeze(["INBOX"] as const);
  const requiredAbsentLocations = Object.freeze(["SPAM", "TRASH"] as const);

  return Object.freeze({
    entityType: "THREAD",
    ownerScope: "AUTHENTICATED_OWNER",
    mailboxScope: "REQUESTED_MAILBOX",
    locationKnowledge: "VERIFIED",
    requiredPresentLocations,
    requiredAbsentLocations,
    additionalLocationMembership: "DOES_NOT_DISQUALIFY",
    temporalLookback: "UNBOUNDED",
    candidateCountLimit: "UNBOUNDED"
  });
}

function incompleteEvidenceEntry(
  kind: PriorityPolicyIncompleteEvidenceKind,
  affectedCandidateCount: number
): PriorityPolicyIncompleteEvidence {
  return Object.freeze({ kind, affectedCandidateCount });
}

function evidenceCompleteness(
  orderedCandidates: readonly PriorityPolicyOrderedEvaluatedCandidate[],
  evaluatedAtMilliseconds: number
): PriorityPolicyEvidenceCompleteness {
  let candidateTimestampCount = 0;
  let policyLabelsCount = 0;
  let userCorrectionsCount = 0;

  for (const { candidate } of orderedCandidates) {
    if (
      effectiveCandidateTimestamp(
        candidate.candidateTimestamp,
        evaluatedAtMilliseconds
      ) === undefined
    ) {
      candidateTimestampCount += 1;
    }
    if (candidate.providerStar.state === "UNKNOWN") {
      policyLabelsCount += 1;
    }
    if (candidate.correction.state === "UNKNOWN") {
      userCorrectionsCount += 1;
    }
  }

  const incompleteEvidence: PriorityPolicyIncompleteEvidence[] = [];
  if (candidateTimestampCount > 0) {
    incompleteEvidence.push(
      incompleteEvidenceEntry(
        "CANDIDATE_TIMESTAMP",
        candidateTimestampCount
      )
    );
  }
  if (policyLabelsCount > 0) {
    incompleteEvidence.push(
      incompleteEvidenceEntry("POLICY_LABELS", policyLabelsCount)
    );
  }
  if (userCorrectionsCount > 0) {
    incompleteEvidence.push(
      incompleteEvidenceEntry("USER_CORRECTIONS", userCorrectionsCount)
    );
  }

  if (incompleteEvidence.length === 0) {
    return Object.freeze({
      state: "COMPLETE",
      incompleteEvidence: Object.freeze([] as const)
    });
  }

  return Object.freeze({
    state: "INCOMPLETE",
    incompleteEvidence: Object.freeze(
      incompleteEvidence
    ) as readonly [
      PriorityPolicyIncompleteEvidence,
      ...PriorityPolicyIncompleteEvidence[]
    ]
  });
}

function delivery(
  evaluatedCandidateCount: number,
  returnedCandidateCount: number,
  continuationAvailable: boolean
): PriorityPolicyCollectionDelivery {
  return Object.freeze({
    state:
      evaluatedCandidateCount === returnedCandidateCount
        ? "COMPLETE"
        : "PARTIAL",
    evaluatedCandidateCount,
    returnedCandidateCount,
    continuationAvailable
  });
}

export function createPriorityPolicyCollectionEvaluation(
  input: PriorityPolicyCollectionEvaluationInput
): PriorityPolicyCollectionEvaluation {
  const validated = validateInput(input);
  const validThrough = canonicalBoundary(
    validated.evaluatedAtMilliseconds,
    EVALUATION_VALIDITY_MILLISECONDS
  );
  const staleRetentionThrough = canonicalBoundary(
    validated.evaluatedAtMilliseconds,
    STALE_RETENTION_MILLISECONDS
  );
  const scope = candidateScope();
  const synchronization = Object.freeze({ coverage: validated.coverage });
  const completeness = evidenceCompleteness(
    validated.orderedCandidates,
    validated.evaluatedAtMilliseconds
  );
  const constructedDelivery = delivery(
    validated.orderedCandidates.length,
    validated.returnedCandidateCount,
    validated.continuationAvailable
  );
  const ordering = Object.freeze({
    scheme: "PRIORITY_POLICY_V1" as const
  });
  const candidates = Object.freeze(
    validated.orderedCandidates
      .slice(0, validated.returnedCandidateCount)
      .map(({ evaluation }) => evaluation)
  ) as readonly EvaluatedOutcome[];

  return Object.freeze({
    policyVersion: "1.0",
    evaluatedAt: validated.evaluatedAt,
    validThrough,
    staleRetentionThrough,
    candidateScope: scope,
    synchronization,
    evidenceCompleteness: completeness,
    delivery: constructedDelivery,
    ordering,
    candidates
  });
}
