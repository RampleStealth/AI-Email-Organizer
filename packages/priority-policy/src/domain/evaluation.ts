import type {
  CanonicalTimestamp,
  PolicyVersion,
  ThreadId
} from "./identifiers.js";

export type PriorityTier =
  | "NEEDS_ATTENTION"
  | "REVIEW_LATER"
  | "NO_IMMEDIATE_SIGNALS";

export type ReasonCode =
  | "USER_PRIORITIZE"
  | "USER_NOT_IMPORTANT"
  | "PROVIDER_STAR"
  | "RECENCY";

export type CanonicalReason =
  | "You prioritized this conversation."
  | "You marked this conversation as not important."
  | "Starred in your email provider."
  | "Received recently.";

export type ReasonRole = "DETERMINING" | "SUPPORTING";

export interface CandidateEvaluation {
  readonly threadId: ThreadId;
  readonly tier: PriorityTier;
  readonly reasonCodes: readonly ReasonCode[];
  readonly reasons: readonly CanonicalReason[];
  readonly reasonRoles: readonly ReasonRole[];
  readonly policyVersion: PolicyVersion;
  readonly evaluatedAt: CanonicalTimestamp;
}

export interface EvaluatedOutcome extends CandidateEvaluation {
  readonly kind: "EVALUATED";
}

export interface UnknownOutcome {
  readonly kind: "UNKNOWN";
  readonly threadId: ThreadId;
  readonly policyVersion: PolicyVersion;
  readonly evaluatedAt: CanonicalTimestamp;
}

export type PriorityPolicyEvaluationOutcome =
  | EvaluatedOutcome
  | UnknownOutcome;
