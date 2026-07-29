import type {
  EligibleLocationEvidence,
  NormalizedLocationEvidence
} from "../domain/evidence.js";

interface RuntimeMembershipEvidence {
  readonly state?: unknown;
}

interface RuntimeLocationEvidence {
  readonly inbox?: RuntimeMembershipEvidence | null;
  readonly spam?: RuntimeMembershipEvidence | null;
  readonly trash?: RuntimeMembershipEvidence | null;
}

export function isPriorityPolicyCandidateEligible(
  location: NormalizedLocationEvidence
): location is EligibleLocationEvidence {
  const runtimeLocation =
    location as RuntimeLocationEvidence | null | undefined;

  return (
    runtimeLocation?.inbox?.state === "VERIFIED_PRESENT" &&
    runtimeLocation.spam?.state === "VERIFIED_ABSENT" &&
    runtimeLocation.trash?.state === "VERIFIED_ABSENT"
  );
}
