import type { PriorityPolicyAdmissionCandidate } from "../admission/contract.js";
import { admitPriorityPolicyCandidates } from "../admission/admit-priority-policy-candidates.js";
import type { PriorityPolicyCollectionEvaluation } from "../collection/contract.js";
import { createPriorityPolicyCollectionEvaluation } from "../collection/create-priority-policy-collection-evaluation.js";
import type {
  CanonicalReason,
  EvaluatedOutcome,
  PriorityTier,
  ReasonCode,
  ReasonRole
} from "../domain/evaluation.js";
import type { PriorityPolicyEvaluatorInput } from "../evaluator/contract.js";
import { evaluatePriorityPolicy } from "../evaluator/evaluate-priority-policy.js";
import {
  isCanonicalUuid,
  parseCanonicalTimestamp
} from "../internal/ordering-primitives.js";
import type { PriorityPolicyScopedEvaluation } from "../ordering/contract.js";
import { orderPriorityPolicyCandidates } from "../ordering/order-priority-policy-candidates.js";
import type {
  PriorityPolicyReplayFixture,
  PriorityPolicyReplayInputSnapshot,
  PriorityPolicyReplayVerificationResult
} from "./contract.js";

interface RuntimeRecord {
  readonly [key: string]: unknown;
}

const FIXTURE_ERROR = "Invalid Priority Policy replay fixture.";
const SERIALIZATION_ERROR =
  "Invalid canonical Priority Policy replay serialization.";

const REASON_BY_CODE: Readonly<Record<ReasonCode, CanonicalReason>> =
  Object.freeze({
    USER_PRIORITIZE: "You prioritized this conversation.",
    USER_NOT_IMPORTANT: "You marked this conversation as not important.",
    PROVIDER_STAR: "Starred in your email provider.",
    RECENCY: "Received recently."
  });

function isRecord(value: unknown): value is RuntimeRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: RuntimeRecord, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return (
    actual.length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

function fixtureError(cause?: unknown): never {
  throw new TypeError(FIXTURE_ERROR, cause === undefined ? undefined : { cause });
}

function serializationError(cause?: unknown): never {
  throw new TypeError(
    SERIALIZATION_ERROR,
    cause === undefined ? undefined : { cause }
  );
}

function requireCanonicalTimestamp(value: unknown, serialization = false): string {
  if (
    typeof value !== "string" ||
    parseCanonicalTimestamp(value) === undefined
  ) {
    return serialization ? serializationError() : fixtureError();
  }
  return value;
}

function requireOpaqueIdentity(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    return fixtureError();
  }
  return value;
}

function copyMembership(value: unknown): { readonly state: string } {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["state"]) ||
    (value.state !== "VERIFIED_PRESENT" &&
      value.state !== "VERIFIED_ABSENT" &&
      value.state !== "UNKNOWN")
  ) {
    return fixtureError();
  }
  return Object.freeze({ state: value.state });
}

function copyCandidate(value: unknown): PriorityPolicyAdmissionCandidate {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "scope",
      "threadId",
      "providerBinding",
      "location",
      "candidateTimestamp",
      "providerStar",
      "correction"
    ]) ||
    !isRecord(value.scope) ||
    !hasExactKeys(value.scope, ["ownerId", "mailboxId"]) ||
    !isCanonicalUuid(value.scope.ownerId) ||
    !isCanonicalUuid(value.scope.mailboxId) ||
    !isCanonicalUuid(value.threadId) ||
    !isRecord(value.providerBinding) ||
    !hasExactKeys(value.providerBinding, ["transitionId"]) ||
    !isCanonicalUuid(value.providerBinding.transitionId) ||
    !isRecord(value.location) ||
    !hasExactKeys(value.location, ["inbox", "spam", "trash"]) ||
    !isRecord(value.providerStar) ||
    !hasExactKeys(value.providerStar, ["state"]) ||
    (value.providerStar.state !== "VERIFIED_PRESENT" &&
      value.providerStar.state !== "VERIFIED_ABSENT" &&
      value.providerStar.state !== "UNKNOWN") ||
    !isRecord(value.candidateTimestamp) ||
    !isRecord(value.correction)
  ) {
    return fixtureError();
  }

  let candidateTimestamp: PriorityPolicyAdmissionCandidate["candidateTimestamp"];
  if (value.candidateTimestamp.state === "UNKNOWN") {
    if (!hasExactKeys(value.candidateTimestamp, ["state"])) {
      return fixtureError();
    }
    candidateTimestamp = Object.freeze({ state: "UNKNOWN" });
  } else if (
    value.candidateTimestamp.state === "VERIFIED" &&
    hasExactKeys(value.candidateTimestamp, ["state", "value", "sourceMessageId"]) &&
    isCanonicalUuid(value.candidateTimestamp.sourceMessageId)
  ) {
    candidateTimestamp = Object.freeze({
      state: "VERIFIED",
      value: requireCanonicalTimestamp(
        value.candidateTimestamp.value
      ) as Extract<
        PriorityPolicyAdmissionCandidate["candidateTimestamp"],
        { readonly state: "VERIFIED" }
      >["value"],
      sourceMessageId: value.candidateTimestamp.sourceMessageId
    }) as PriorityPolicyAdmissionCandidate["candidateTimestamp"];
  } else {
    return fixtureError();
  }

  let correction: PriorityPolicyAdmissionCandidate["correction"];
  if (
    (value.correction.state === "VERIFIED_ABSENT" ||
      value.correction.state === "UNKNOWN") &&
    hasExactKeys(value.correction, ["state"])
  ) {
    correction = Object.freeze({ state: value.correction.state });
  } else if (
    value.correction.state === "VERIFIED_ACTIVE" &&
    hasExactKeys(value.correction, ["state", "kind", "transitionId"]) &&
    (value.correction.kind === "PRIORITIZE" ||
      value.correction.kind === "NOT_IMPORTANT") &&
    isCanonicalUuid(value.correction.transitionId)
  ) {
    correction = Object.freeze({
      state: "VERIFIED_ACTIVE",
      kind: value.correction.kind,
      transitionId: value.correction.transitionId
    }) as PriorityPolicyAdmissionCandidate["correction"];
  } else {
    return fixtureError();
  }

  return Object.freeze({
    scope: Object.freeze({
      ownerId: value.scope.ownerId,
      mailboxId: value.scope.mailboxId
    }),
    threadId: value.threadId,
    providerBinding: Object.freeze({
      transitionId: value.providerBinding.transitionId
    }),
    location: Object.freeze({
      inbox: copyMembership(value.location.inbox),
      spam: copyMembership(value.location.spam),
      trash: copyMembership(value.location.trash)
    }),
    candidateTimestamp,
    providerStar: Object.freeze({ state: value.providerStar.state }),
    correction
  }) as PriorityPolicyAdmissionCandidate;
}

function validateReplayFixture(value: unknown): PriorityPolicyReplayFixture {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["input", "expectedSerializedOutput"]) ||
    typeof value.expectedSerializedOutput !== "string" ||
    !isRecord(value.input) ||
    !hasExactKeys(value.input, [
      "scope",
      "candidates",
      "context",
      "synchronization",
      "delivery"
    ])
  ) {
    return fixtureError();
  }

  const input = value.input;
  if (
    !isRecord(input.scope) ||
    !hasExactKeys(input.scope, ["ownerId", "mailboxId"]) ||
    !isCanonicalUuid(input.scope.ownerId) ||
    !isCanonicalUuid(input.scope.mailboxId) ||
    !Array.isArray(input.candidates) ||
    !isRecord(input.context) ||
    !hasExactKeys(input.context, [
      "policyVersion",
      "evaluatedAt",
      "evidenceSnapshotId",
      "parameters"
    ]) ||
    input.context.policyVersion !== "1.0" ||
    !isRecord(input.context.parameters) ||
    !hasExactKeys(input.context.parameters, [
      "identity",
      "futureSkewTolerance"
    ]) ||
    input.context.parameters.futureSkewTolerance !== "PT5M" ||
    !isRecord(input.synchronization) ||
    !hasExactKeys(input.synchronization, ["coverage"]) ||
    (input.synchronization.coverage !== "READY" &&
      input.synchronization.coverage !== "PARTIAL") ||
    !isRecord(input.delivery) ||
    !hasExactKeys(input.delivery, [
      "returnedCandidateCount",
      "continuationAvailable"
    ]) ||
    !Number.isSafeInteger(input.delivery.returnedCandidateCount) ||
    (input.delivery.returnedCandidateCount as number) < 0 ||
    typeof input.delivery.continuationAvailable !== "boolean"
  ) {
    return fixtureError();
  }

  const candidates = Object.freeze(input.candidates.map(copyCandidate));
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (
      candidate.scope.ownerId !== input.scope.ownerId ||
      candidate.scope.mailboxId !== input.scope.mailboxId ||
      seen.has(candidate.threadId)
    ) {
      return fixtureError();
    }
    seen.add(candidate.threadId);
  }

  const detachedInput: PriorityPolicyReplayInputSnapshot = Object.freeze({
    scope: Object.freeze({
      ownerId: input.scope.ownerId,
      mailboxId: input.scope.mailboxId
    }),
    candidates,
    context: Object.freeze({
      policyVersion: "1.0",
      evaluatedAt: requireCanonicalTimestamp(input.context.evaluatedAt),
      evidenceSnapshotId: requireOpaqueIdentity(
        input.context.evidenceSnapshotId
      ),
      parameters: Object.freeze({
        identity: requireOpaqueIdentity(input.context.parameters.identity),
        futureSkewTolerance: "PT5M"
      })
    }),
    synchronization: Object.freeze({
      coverage: input.synchronization.coverage
    }),
    delivery: Object.freeze({
      returnedCandidateCount: input.delivery.returnedCandidateCount,
      continuationAvailable: input.delivery.continuationAvailable
    })
  }) as PriorityPolicyReplayInputSnapshot;

  return Object.freeze({
    input: detachedInput,
    expectedSerializedOutput: value.expectedSerializedOutput
  });
}

function requireSerializedRecord(
  value: unknown,
  keys: readonly string[]
): RuntimeRecord {
  if (!isRecord(value) || !hasExactKeys(value, keys)) {
    return serializationError();
  }
  return value;
}

function requireStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    return serializationError();
  }
  return value;
}

function canonicalCandidate(value: unknown, policyVersion: string, evaluatedAt: string): EvaluatedOutcome {
  const candidate = requireSerializedRecord(value, [
    "kind",
    "threadId",
    "tier",
    "reasonCodes",
    "reasons",
    "reasonRoles",
    "policyVersion",
    "evaluatedAt"
  ]);
  const tiers: readonly PriorityTier[] = [
    "NEEDS_ATTENTION",
    "REVIEW_LATER",
    "NO_IMMEDIATE_SIGNALS"
  ];
  const reasonCodes = requireStringArray(candidate.reasonCodes);
  const reasons = requireStringArray(candidate.reasons);
  const reasonRoles = requireStringArray(candidate.reasonRoles);
  if (
    candidate.kind !== "EVALUATED" ||
    !isCanonicalUuid(candidate.threadId) ||
    !tiers.includes(candidate.tier as PriorityTier) ||
    candidate.policyVersion !== policyVersion ||
    candidate.evaluatedAt !== evaluatedAt ||
    reasonCodes.length !== reasons.length ||
    reasonCodes.length !== reasonRoles.length
  ) {
    return serializationError();
  }

  const seen = new Set<string>();
  for (let index = 0; index < reasonCodes.length; index += 1) {
    const code = reasonCodes[index] as ReasonCode;
    if (
      !(code in REASON_BY_CODE) ||
      reasons[index] !== REASON_BY_CODE[code] ||
      (reasonRoles[index] !== "DETERMINING" &&
        reasonRoles[index] !== "SUPPORTING") ||
      seen.has(code)
    ) {
      return serializationError();
    }
    seen.add(code);
  }

  return Object.freeze({
    kind: "EVALUATED",
    threadId: candidate.threadId,
    tier: candidate.tier,
    reasonCodes: Object.freeze([...reasonCodes]),
    reasons: Object.freeze([...reasons]),
    reasonRoles: Object.freeze([...reasonRoles]),
    policyVersion: candidate.policyVersion,
    evaluatedAt: candidate.evaluatedAt
  }) as EvaluatedOutcome;
}

function canonicalScope(value: unknown): PriorityPolicyCollectionEvaluation["candidateScope"] {
  const scope = requireSerializedRecord(value, [
    "entityType",
    "ownerScope",
    "mailboxScope",
    "locationKnowledge",
    "requiredPresentLocations",
    "requiredAbsentLocations",
    "additionalLocationMembership",
    "temporalLookback",
    "candidateCountLimit"
  ]);
  if (
    scope.entityType !== "THREAD" ||
    scope.ownerScope !== "AUTHENTICATED_OWNER" ||
    scope.mailboxScope !== "REQUESTED_MAILBOX" ||
    scope.locationKnowledge !== "VERIFIED" ||
    JSON.stringify(scope.requiredPresentLocations) !== '["INBOX"]' ||
    JSON.stringify(scope.requiredAbsentLocations) !== '["SPAM","TRASH"]' ||
    scope.additionalLocationMembership !== "DOES_NOT_DISQUALIFY" ||
    scope.temporalLookback !== "UNBOUNDED" ||
    scope.candidateCountLimit !== "UNBOUNDED"
  ) {
    return serializationError();
  }
  return Object.freeze({
    entityType: "THREAD",
    ownerScope: "AUTHENTICATED_OWNER",
    mailboxScope: "REQUESTED_MAILBOX",
    locationKnowledge: "VERIFIED",
    requiredPresentLocations: Object.freeze(["INBOX"] as const),
    requiredAbsentLocations: Object.freeze(["SPAM", "TRASH"] as const),
    additionalLocationMembership: "DOES_NOT_DISQUALIFY",
    temporalLookback: "UNBOUNDED",
    candidateCountLimit: "UNBOUNDED"
  });
}

function canonicalCompleteness(
  value: unknown,
  evaluatedCandidateCount: number
): PriorityPolicyCollectionEvaluation["evidenceCompleteness"] {
  const completeness = requireSerializedRecord(value, [
    "state",
    "incompleteEvidence"
  ]);
  if (!Array.isArray(completeness.incompleteEvidence)) {
    return serializationError();
  }
  if (
    completeness.state === "COMPLETE" &&
    completeness.incompleteEvidence.length === 0
  ) {
    return Object.freeze({
      state: "COMPLETE",
      incompleteEvidence: Object.freeze([] as const)
    });
  }
  if (
    completeness.state !== "INCOMPLETE" ||
    completeness.incompleteEvidence.length === 0
  ) {
    return serializationError();
  }

  const order = [
    "CANDIDATE_TIMESTAMP",
    "POLICY_LABELS",
    "USER_CORRECTIONS"
  ] as const;
  let previous = -1;
  const entries = completeness.incompleteEvidence.map((entry) => {
    const record = requireSerializedRecord(entry, [
      "kind",
      "affectedCandidateCount"
    ]);
    const index = order.indexOf(record.kind as (typeof order)[number]);
    if (
      index <= previous ||
      !Number.isSafeInteger(record.affectedCandidateCount) ||
      (record.affectedCandidateCount as number) < 1 ||
      (record.affectedCandidateCount as number) > evaluatedCandidateCount
    ) {
      return serializationError();
    }
    previous = index;
    return Object.freeze({
      kind: record.kind,
      affectedCandidateCount: record.affectedCandidateCount
    });
  });
  return Object.freeze({
    state: "INCOMPLETE",
    incompleteEvidence: Object.freeze(entries)
  }) as PriorityPolicyCollectionEvaluation["evidenceCompleteness"];
}

function validateCanonicalReplaySerialization(serialized: string): {
  readonly serialized: string;
  readonly evaluation: PriorityPolicyCollectionEvaluation;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch (cause) {
    return serializationError(cause);
  }
  const value = requireSerializedRecord(parsed, [
    "policyVersion",
    "evaluatedAt",
    "validThrough",
    "staleRetentionThrough",
    "candidateScope",
    "synchronization",
    "evidenceCompleteness",
    "delivery",
    "ordering",
    "candidates"
  ]);
  if (value.policyVersion !== "1.0" || !Array.isArray(value.candidates)) {
    return serializationError();
  }
  const evaluatedAt = requireCanonicalTimestamp(value.evaluatedAt, true);
  const validThrough = requireCanonicalTimestamp(value.validThrough, true);
  const staleRetentionThrough = requireCanonicalTimestamp(
    value.staleRetentionThrough,
    true
  );
  const synchronization = requireSerializedRecord(value.synchronization, [
    "coverage"
  ]);
  if (
    synchronization.coverage !== "READY" &&
    synchronization.coverage !== "PARTIAL"
  ) {
    return serializationError();
  }
  const delivery = requireSerializedRecord(value.delivery, [
    "state",
    "evaluatedCandidateCount",
    "returnedCandidateCount",
    "continuationAvailable"
  ]);
  if (
    !Number.isSafeInteger(delivery.evaluatedCandidateCount) ||
    !Number.isSafeInteger(delivery.returnedCandidateCount) ||
    (delivery.evaluatedCandidateCount as number) < 0 ||
    (delivery.returnedCandidateCount as number) < 0 ||
    (delivery.returnedCandidateCount as number) >
      (delivery.evaluatedCandidateCount as number) ||
    value.candidates.length !== delivery.returnedCandidateCount ||
    typeof delivery.continuationAvailable !== "boolean"
  ) {
    return serializationError();
  }
  const expectedDeliveryState =
    delivery.evaluatedCandidateCount === delivery.returnedCandidateCount
      ? "COMPLETE"
      : "PARTIAL";
  if (
    delivery.state !== expectedDeliveryState ||
    (delivery.state === "COMPLETE" && delivery.continuationAvailable)
  ) {
    return serializationError();
  }
  const ordering = requireSerializedRecord(value.ordering, ["scheme"]);
  if (ordering.scheme !== "PRIORITY_POLICY_V1") {
    return serializationError();
  }

  const candidates = Object.freeze(
    value.candidates.map((candidate) =>
      canonicalCandidate(candidate, "1.0", evaluatedAt)
    )
  );
  const evaluation = Object.freeze({
    policyVersion: "1.0",
    evaluatedAt,
    validThrough,
    staleRetentionThrough,
    candidateScope: canonicalScope(value.candidateScope),
    synchronization: Object.freeze({ coverage: synchronization.coverage }),
    evidenceCompleteness: canonicalCompleteness(
      value.evidenceCompleteness,
      delivery.evaluatedCandidateCount as number
    ),
    delivery: Object.freeze({
      state: delivery.state,
      evaluatedCandidateCount: delivery.evaluatedCandidateCount,
      returnedCandidateCount: delivery.returnedCandidateCount,
      continuationAvailable: delivery.continuationAvailable
    }),
    ordering: Object.freeze({ scheme: "PRIORITY_POLICY_V1" }),
    candidates
  }) as PriorityPolicyCollectionEvaluation;

  const canonical = JSON.stringify(evaluation);
  if (canonical !== serialized) {
    return serializationError();
  }
  return Object.freeze({ serialized: canonical, evaluation });
}

export function verifyPriorityPolicyReplay(
  fixture: PriorityPolicyReplayFixture
): PriorityPolicyReplayVerificationResult {
  const validated = validateReplayFixture(fixture);
  const expected = validateCanonicalReplaySerialization(
    validated.expectedSerializedOutput
  );
  if (
    expected.evaluation.policyVersion !== validated.input.context.policyVersion ||
    expected.evaluation.evaluatedAt !== validated.input.context.evaluatedAt
  ) {
    return serializationError();
  }

  try {
    const admitted = admitPriorityPolicyCandidates({
      scope: validated.input.scope,
      candidates: validated.input.candidates,
      context: {
        policyVersion: validated.input.context.policyVersion,
        evaluatedAt: validated.input.context.evaluatedAt,
        parameters: {
          futureSkewTolerance:
            validated.input.context.parameters.futureSkewTolerance
        }
      },
      delivery: { candidateLimit: 100 }
    });
    const evaluations: readonly PriorityPolicyScopedEvaluation[] =
      Object.freeze(
        admitted.map((candidate) => {
          const input: PriorityPolicyEvaluatorInput = {
            scope: validated.input.scope,
            candidate,
            context: validated.input.context
          };
          const evaluation = evaluatePriorityPolicy(input);
          /* v8 ignore next 3 -- reserved fail-closed guard for future evaluator outcomes */
          if (evaluation.kind !== "EVALUATED") {
            return fixtureError();
          }
          return Object.freeze({
            scope: validated.input.scope,
            evaluation
          });
        })
      );
    const ordered = orderPriorityPolicyCandidates({
      scope: validated.input.scope,
      admittedCandidates: admitted,
      evaluations,
      context: {
        policyVersion: validated.input.context.policyVersion,
        evaluatedAt: validated.input.context.evaluatedAt,
        parameters: {
          futureSkewTolerance:
            validated.input.context.parameters.futureSkewTolerance
        }
      }
    });
    const evaluation = createPriorityPolicyCollectionEvaluation({
      scope: validated.input.scope,
      orderedCandidates: ordered,
      context: {
        policyVersion: validated.input.context.policyVersion,
        evaluatedAt: validated.input.context.evaluatedAt
      },
      synchronization: validated.input.synchronization,
      delivery: validated.input.delivery
    });
    const actual = JSON.stringify(evaluation);
    return actual === expected.serialized
      ? Object.freeze({
          kind: "MATCH",
          evaluation,
          serializedEvaluation: actual
        })
      : Object.freeze({
          kind: "MISMATCH",
          evaluation,
          expectedSerializedEvaluation: expected.serialized,
          actualSerializedEvaluation: actual
        });
  } catch (cause) {
    return fixtureError(cause);
  }
}
