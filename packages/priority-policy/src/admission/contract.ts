import type {
  CandidateTimestampEvidence,
  CorrectionEvidence,
  NormalizedLocationEvidence,
  ProviderBindingContext,
  ProviderStarEvidence
} from "../domain/evidence.js";
import type {
  CanonicalTimestamp,
  FutureSkewTolerance,
  MailboxId,
  OwnerId,
  PolicyVersion,
  ThreadId
} from "../domain/identifiers.js";

export interface PriorityPolicyAdmissionCandidate {
  readonly scope: {
    readonly ownerId: OwnerId;
    readonly mailboxId: MailboxId;
  };
  readonly threadId: ThreadId;
  readonly providerBinding: ProviderBindingContext;
  readonly location: NormalizedLocationEvidence;
  readonly candidateTimestamp: CandidateTimestampEvidence;
  readonly providerStar: ProviderStarEvidence;
  readonly correction: CorrectionEvidence;
}

export interface PriorityPolicyCandidateAdmissionInput {
  readonly scope: {
    readonly ownerId: OwnerId;
    readonly mailboxId: MailboxId;
  };
  readonly candidates: readonly PriorityPolicyAdmissionCandidate[];
  readonly context: {
    readonly policyVersion: PolicyVersion;
    readonly evaluatedAt: CanonicalTimestamp;
    readonly parameters: {
      readonly futureSkewTolerance: FutureSkewTolerance;
    };
  };
  readonly delivery: {
    readonly candidateLimit: 100;
  };
}

export type PriorityPolicyCandidateAdmission = (
  input: PriorityPolicyCandidateAdmissionInput
) => readonly PriorityPolicyAdmissionCandidate[];
