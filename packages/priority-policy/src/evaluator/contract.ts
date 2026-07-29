import type {
  CandidateTimestampEvidence,
  CorrectionEvidence,
  EligibleLocationEvidence,
  ProviderBindingContext,
  ProviderStarEvidence
} from "../domain/evidence.js";
import type {
  ApprovedParameterIdentity,
  CanonicalTimestamp,
  EvidenceSnapshotId,
  FutureSkewTolerance,
  MailboxId,
  OwnerId,
  PolicyVersion,
  ThreadId
} from "../domain/identifiers.js";
import type { PriorityPolicyEvaluationOutcome } from "../domain/evaluation.js";

export interface PriorityPolicyEvaluatorInput {
  readonly scope: {
    readonly ownerId: OwnerId;
    readonly mailboxId: MailboxId;
  };
  readonly candidate: {
    readonly threadId: ThreadId;
    readonly providerBinding: ProviderBindingContext;
    readonly location: EligibleLocationEvidence;
    readonly candidateTimestamp: CandidateTimestampEvidence;
    readonly providerStar: ProviderStarEvidence;
    readonly correction: CorrectionEvidence;
  };
  readonly context: {
    readonly policyVersion: PolicyVersion;
    readonly evaluatedAt: CanonicalTimestamp;
    readonly evidenceSnapshotId: EvidenceSnapshotId;
    readonly parameters: {
      readonly identity: ApprovedParameterIdentity;
      readonly futureSkewTolerance: FutureSkewTolerance;
    };
  };
}

export type PriorityPolicyEvaluator = (
  input: PriorityPolicyEvaluatorInput
) => PriorityPolicyEvaluationOutcome;
