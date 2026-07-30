import type { PriorityPolicyAdmissionCandidate } from "../admission/contract.js";
import type {
  PriorityPolicyCollectionDeliveryInput,
  PriorityPolicyCollectionEvaluation,
  PriorityPolicySynchronizationCoverage
} from "../collection/contract.js";
import type {
  ApprovedParameterIdentity,
  CanonicalTimestamp,
  EvidenceSnapshotId,
  FutureSkewTolerance,
  MailboxId,
  OwnerId,
  PolicyVersion
} from "../domain/identifiers.js";

export interface PriorityPolicyReplayInputSnapshot {
  readonly scope: {
    readonly ownerId: OwnerId;
    readonly mailboxId: MailboxId;
  };
  readonly candidates: readonly PriorityPolicyAdmissionCandidate[];
  readonly context: {
    readonly policyVersion: PolicyVersion;
    readonly evaluatedAt: CanonicalTimestamp;
    readonly evidenceSnapshotId: EvidenceSnapshotId;
    readonly parameters: {
      readonly identity: ApprovedParameterIdentity;
      readonly futureSkewTolerance: FutureSkewTolerance;
    };
  };
  readonly synchronization: {
    readonly coverage: PriorityPolicySynchronizationCoverage;
  };
  readonly delivery: PriorityPolicyCollectionDeliveryInput;
}

export interface PriorityPolicyReplayFixture {
  readonly input: PriorityPolicyReplayInputSnapshot;
  readonly expectedSerializedOutput: string;
}

export type PriorityPolicyReplayVerificationResult =
  | {
      readonly kind: "MATCH";
      readonly evaluation: PriorityPolicyCollectionEvaluation;
      readonly serializedEvaluation: string;
    }
  | {
      readonly kind: "MISMATCH";
      readonly evaluation: PriorityPolicyCollectionEvaluation;
      readonly expectedSerializedEvaluation: string;
      readonly actualSerializedEvaluation: string;
    };
