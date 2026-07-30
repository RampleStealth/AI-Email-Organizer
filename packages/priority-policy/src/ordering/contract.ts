import type { PriorityPolicyAdmissionCandidate } from "../admission/contract.js";
import type { EvaluatedOutcome } from "../domain/evaluation.js";
import type {
  CanonicalTimestamp,
  FutureSkewTolerance,
  MailboxId,
  OwnerId,
  PolicyVersion
} from "../domain/identifiers.js";

export interface PriorityPolicyScopedEvaluation {
  readonly scope: {
    readonly ownerId: OwnerId;
    readonly mailboxId: MailboxId;
  };
  readonly evaluation: EvaluatedOutcome;
}

export interface PriorityPolicyCollectionOrderingInput {
  readonly scope: {
    readonly ownerId: OwnerId;
    readonly mailboxId: MailboxId;
  };
  readonly admittedCandidates: readonly PriorityPolicyAdmissionCandidate[];
  readonly evaluations: readonly PriorityPolicyScopedEvaluation[];
  readonly context: {
    readonly policyVersion: PolicyVersion;
    readonly evaluatedAt: CanonicalTimestamp;
    readonly parameters: {
      readonly futureSkewTolerance: FutureSkewTolerance;
    };
  };
}

export interface PriorityPolicyOrderedEvaluatedCandidate {
  readonly candidate: PriorityPolicyAdmissionCandidate;
  readonly evaluation: EvaluatedOutcome;
}

export type PriorityPolicyCollectionOrdering = (
  input: PriorityPolicyCollectionOrderingInput
) => readonly PriorityPolicyOrderedEvaluatedCandidate[];
