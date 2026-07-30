import type { EvaluatedOutcome } from "../domain/evaluation.js";
import type {
  CanonicalTimestamp,
  MailboxId,
  OwnerId,
  PolicyVersion
} from "../domain/identifiers.js";
import type { PriorityPolicyOrderedEvaluatedCandidate } from "../ordering/contract.js";

export type PriorityPolicySynchronizationCoverage = "READY" | "PARTIAL";

export interface PriorityPolicyCandidateScope {
  readonly entityType: "THREAD";
  readonly ownerScope: "AUTHENTICATED_OWNER";
  readonly mailboxScope: "REQUESTED_MAILBOX";
  readonly locationKnowledge: "VERIFIED";
  readonly requiredPresentLocations: readonly ["INBOX"];
  readonly requiredAbsentLocations: readonly ["SPAM", "TRASH"];
  readonly additionalLocationMembership: "DOES_NOT_DISQUALIFY";
  readonly temporalLookback: "UNBOUNDED";
  readonly candidateCountLimit: "UNBOUNDED";
}

export type PriorityPolicyIncompleteEvidenceKind =
  | "CANDIDATE_TIMESTAMP"
  | "POLICY_LABELS"
  | "USER_CORRECTIONS";

export interface PriorityPolicyIncompleteEvidence {
  readonly kind: PriorityPolicyIncompleteEvidenceKind;
  readonly affectedCandidateCount: number;
}

export type PriorityPolicyEvidenceCompleteness =
  | {
      readonly state: "COMPLETE";
      readonly incompleteEvidence: readonly [];
    }
  | {
      readonly state: "INCOMPLETE";
      readonly incompleteEvidence: readonly [
        PriorityPolicyIncompleteEvidence,
        ...PriorityPolicyIncompleteEvidence[]
      ];
    };

export interface PriorityPolicyCollectionDeliveryInput {
  readonly returnedCandidateCount: number;
  readonly continuationAvailable: boolean;
}

export interface PriorityPolicyCollectionDelivery {
  readonly state: "COMPLETE" | "PARTIAL";
  readonly evaluatedCandidateCount: number;
  readonly returnedCandidateCount: number;
  readonly continuationAvailable: boolean;
}

export interface PriorityPolicyCollectionEvaluationInput {
  readonly scope: {
    readonly ownerId: OwnerId;
    readonly mailboxId: MailboxId;
  };
  readonly orderedCandidates:
    readonly PriorityPolicyOrderedEvaluatedCandidate[];
  readonly context: {
    readonly policyVersion: PolicyVersion;
    readonly evaluatedAt: CanonicalTimestamp;
  };
  readonly synchronization: {
    readonly coverage: PriorityPolicySynchronizationCoverage;
  };
  readonly delivery: PriorityPolicyCollectionDeliveryInput;
}

export interface PriorityPolicyCollectionEvaluation {
  readonly policyVersion: PolicyVersion;
  readonly evaluatedAt: CanonicalTimestamp;
  readonly validThrough: CanonicalTimestamp;
  readonly staleRetentionThrough: CanonicalTimestamp;
  readonly candidateScope: PriorityPolicyCandidateScope;
  readonly synchronization: {
    readonly coverage: PriorityPolicySynchronizationCoverage;
  };
  readonly evidenceCompleteness: PriorityPolicyEvidenceCompleteness;
  readonly delivery: PriorityPolicyCollectionDelivery;
  readonly ordering: {
    readonly scheme: "PRIORITY_POLICY_V1";
  };
  readonly candidates: readonly EvaluatedOutcome[];
}
