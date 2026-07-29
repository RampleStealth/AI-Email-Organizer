import type {
  EligibleLocationEvidence,
  NormalizedLocationEvidence
} from "../domain/evidence.js";

export function isPriorityPolicyCandidateEligible(
  location: NormalizedLocationEvidence
): location is EligibleLocationEvidence {
  return (
    location.inbox.state === "VERIFIED_PRESENT" &&
    location.spam.state === "VERIFIED_ABSENT" &&
    location.trash.state === "VERIFIED_ABSENT"
  );
}
