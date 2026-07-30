import type { EligibleLocationEvidence } from "../domain/evidence.js";
import { isPriorityPolicyCandidateEligible } from "../evaluator/candidate-eligibility.js";
import {
  compareThreadIds,
  effectiveCandidateTimestamp,
  isCanonicalUuid,
  parseCanonicalTimestamp
} from "../internal/ordering-primitives.js";
import type {
  PriorityPolicyAdmissionCandidate,
  PriorityPolicyCandidateAdmissionInput
} from "./contract.js";

interface RuntimeRecord {
  readonly [key: string]: unknown;
}

interface ClassifiedCandidate {
  readonly candidate: AdmittedPriorityPolicyCandidate;
  readonly effectiveTimestamp: number | undefined;
}

type AdmissionTimestampEvidence =
  PriorityPolicyAdmissionCandidate["candidateTimestamp"];

type AdmittedPriorityPolicyCandidate = Omit<
  PriorityPolicyAdmissionCandidate,
  "location"
> & {
  readonly location: EligibleLocationEvidence;
};

function isRecord(value: unknown): value is RuntimeRecord {
  return typeof value === "object" && value !== null;
}

function invalidInput(): never {
  throw new TypeError("Invalid Priority Policy candidate admission input.");
}

function compareCandidates(
  left: ClassifiedCandidate,
  right: ClassifiedCandidate
): number {
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

  return compareThreadIds(left.candidate.threadId, right.candidate.threadId);
}

function frozenCopy<Value extends object>(value: Value): Value {
  return Object.freeze({ ...value }) as Value;
}

function copyAdmittedCandidate(
  candidate: AdmittedPriorityPolicyCandidate
): AdmittedPriorityPolicyCandidate {
  const location = Object.freeze({
    inbox: frozenCopy(candidate.location.inbox),
    spam: frozenCopy(candidate.location.spam),
    trash: frozenCopy(candidate.location.trash)
  });

  return Object.freeze({
    scope: frozenCopy(candidate.scope),
    threadId: candidate.threadId,
    providerBinding: frozenCopy(candidate.providerBinding),
    location,
    candidateTimestamp: frozenCopy(candidate.candidateTimestamp),
    providerStar: frozenCopy(candidate.providerStar),
    correction: frozenCopy(candidate.correction)
  });
}

function validateInput(
  input: PriorityPolicyCandidateAdmissionInput
): {
  readonly ownerId: string;
  readonly mailboxId: string;
  readonly evaluatedAt: number;
  readonly candidates: readonly PriorityPolicyAdmissionCandidate[];
} {
  const runtimeInput = input as unknown;
  if (!isRecord(runtimeInput)) {
    return invalidInput();
  }

  const scope = runtimeInput.scope;
  const context = runtimeInput.context;
  const delivery = runtimeInput.delivery;
  const candidates = runtimeInput.candidates;
  if (
    !isRecord(scope) ||
    !isRecord(context) ||
    !isRecord(delivery) ||
    !Array.isArray(candidates)
  ) {
    return invalidInput();
  }

  if (!isCanonicalUuid(scope.ownerId) || !isCanonicalUuid(scope.mailboxId)) {
    return invalidInput();
  }

  const parameters = context.parameters;
  const evaluatedAt = parseCanonicalTimestamp(context.evaluatedAt);
  if (
    context.policyVersion !== "1.0" ||
    evaluatedAt === undefined ||
    !isRecord(parameters) ||
    parameters.futureSkewTolerance !== "PT5M" ||
    delivery.candidateLimit !== 100
  ) {
    return invalidInput();
  }

  return {
    ownerId: scope.ownerId,
    mailboxId: scope.mailboxId,
    evaluatedAt,
    candidates: candidates as unknown as readonly PriorityPolicyAdmissionCandidate[]
  };
}

export function admitPriorityPolicyCandidates(
  input: PriorityPolicyCandidateAdmissionInput
): readonly AdmittedPriorityPolicyCandidate[] {
  const validated = validateInput(input);
  const seenThreadIds = new Set<string>();
  const classified = validated.candidates.map((candidate) => {
    const runtimeCandidate = candidate as unknown;
    if (!isRecord(runtimeCandidate) || !isRecord(runtimeCandidate.scope)) {
      return invalidInput();
    }

    if (
      runtimeCandidate.scope.ownerId !== validated.ownerId ||
      runtimeCandidate.scope.mailboxId !== validated.mailboxId ||
      !isCanonicalUuid(runtimeCandidate.threadId) ||
      !isPriorityPolicyCandidateEligible(
        runtimeCandidate.location as PriorityPolicyAdmissionCandidate["location"]
      )
    ) {
      return invalidInput();
    }

    if (seenThreadIds.has(runtimeCandidate.threadId)) {
      return invalidInput();
    }
    seenThreadIds.add(runtimeCandidate.threadId);

    const admittedCandidate = candidate as AdmittedPriorityPolicyCandidate;
    return {
      candidate: admittedCandidate,
      effectiveTimestamp: effectiveCandidateTimestamp(
        runtimeCandidate.candidateTimestamp as AdmissionTimestampEvidence,
        validated.evaluatedAt
      )
    };
  });

  return Object.freeze(
    classified
      .sort(compareCandidates)
      .slice(0, 100)
      .map(({ candidate }) => copyAdmittedCandidate(candidate))
  );
}
