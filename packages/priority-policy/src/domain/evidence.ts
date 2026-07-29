import type {
  ApplicationMessageId,
  CanonicalTimestamp,
  CorrectionTransitionId,
  ProviderBindingTransitionId
} from "./identifiers.js";

export type VerifiedMembership =
  | { readonly state: "VERIFIED_PRESENT" }
  | { readonly state: "VERIFIED_ABSENT" }
  | { readonly state: "UNKNOWN" };

export interface NormalizedLocationEvidence {
  readonly inbox: VerifiedMembership;
  readonly spam: VerifiedMembership;
  readonly trash: VerifiedMembership;
}

export type CandidateTimestampEvidence =
  | {
      readonly state: "VERIFIED";
      readonly value: CanonicalTimestamp;
      readonly sourceMessageId: ApplicationMessageId;
    }
  | { readonly state: "UNKNOWN" };

export type ProviderStarEvidence =
  | { readonly state: "VERIFIED_PRESENT" }
  | { readonly state: "VERIFIED_ABSENT" }
  | { readonly state: "UNKNOWN" };

export type CorrectionKind = "PRIORITIZE" | "NOT_IMPORTANT";

export type CorrectionEvidence =
  | {
      readonly state: "VERIFIED_ACTIVE";
      readonly kind: CorrectionKind;
      readonly transitionId: CorrectionTransitionId;
    }
  | { readonly state: "VERIFIED_ABSENT" }
  | { readonly state: "UNKNOWN" };

export interface ProviderBindingContext {
  readonly transitionId: ProviderBindingTransitionId;
}
