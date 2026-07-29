import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  evaluatePriorityPolicy,
  isPriorityPolicyCandidateEligible
} from "@aio/priority-policy";
import type {
  NormalizedLocationEvidence,
  PriorityPolicyEvaluatorInput
} from "@aio/priority-policy";

type AdmittedLocationFixture =
  PriorityPolicyEvaluatorInput["candidate"]["location"];

type MembershipState =
  NormalizedLocationEvidence["inbox"]["state"];

interface EligibilityCase {
  readonly inbox: MembershipState;
  readonly spam: MembershipState;
  readonly trash: MembershipState;
  readonly admitted: boolean;
}

const membershipStates = [
  "VERIFIED_PRESENT",
  "VERIFIED_ABSENT",
  "UNKNOWN"
] as const satisfies readonly MembershipState[];

const malformedLocationEvidence = [
  ["undefined location", undefined],
  ["null location", null],
  ["missing memberships", {}],
  [
    "missing Inbox membership",
    {
      spam: { state: "VERIFIED_ABSENT" },
      trash: { state: "VERIFIED_ABSENT" }
    }
  ],
  [
    "missing Spam membership",
    {
      inbox: { state: "VERIFIED_PRESENT" },
      trash: { state: "VERIFIED_ABSENT" }
    }
  ],
  [
    "missing Trash membership",
    {
      inbox: { state: "VERIFIED_PRESENT" },
      spam: { state: "VERIFIED_ABSENT" }
    }
  ],
  [
    "unknown membership enum",
    {
      inbox: { state: "INVALID" },
      spam: { state: "VERIFIED_ABSENT" },
      trash: { state: "VERIFIED_ABSENT" }
    }
  ],
  [
    "null membership",
    {
      inbox: null,
      spam: { state: "VERIFIED_ABSENT" },
      trash: { state: "VERIFIED_ABSENT" }
    }
  ]
] as const;

const eligibilityCases: readonly EligibilityCase[] =
  membershipStates.flatMap((inbox) =>
    membershipStates.flatMap((spam) =>
      membershipStates.map((trash) => ({
        inbox,
        spam,
        trash,
        admitted:
          inbox === "VERIFIED_PRESENT" &&
          spam === "VERIFIED_ABSENT" &&
          trash === "VERIFIED_ABSENT"
      }))
    )
  );

function locationEvidence(
  candidate: Omit<EligibilityCase, "admitted">
): NormalizedLocationEvidence {
  return {
    inbox: { state: candidate.inbox },
    spam: { state: candidate.spam },
    trash: { state: candidate.trash }
  };
}

function evaluatorInput(
  location: AdmittedLocationFixture
): PriorityPolicyEvaluatorInput {
  return {
    scope: {
      ownerId: "10000000-0000-4000-8000-000000000001",
      mailboxId: "20000000-0000-4000-8000-000000000002"
    },
    candidate: {
      threadId: "30000000-0000-4000-8000-000000000003",
      providerBinding: {
        transitionId: "binding-transition-7"
      },
      location,
      candidateTimestamp: {
        state: "UNKNOWN"
      },
      providerStar: {
        state: "VERIFIED_ABSENT"
      },
      correction: {
        state: "VERIFIED_ABSENT"
      }
    },
    context: {
      policyVersion: "1.0",
      evaluatedAt: "2026-07-29T10:00:00.000Z",
      evidenceSnapshotId: "evidence-snapshot-13",
      parameters: {
        identity: "ppv1-parameters-1",
        futureSkewTolerance: "PT5M"
      }
    }
  } as unknown as PriorityPolicyEvaluatorInput;
}

describe("Priority Policy candidate eligibility", () => {
  it.each(eligibilityCases)(
    "maps Inbox=$inbox Spam=$spam Trash=$trash to admitted=$admitted",
    ({ admitted, ...states }) => {
      const location = locationEvidence(states);
      const evaluator = vi.fn(evaluatePriorityPolicy);
      const result = isPriorityPolicyCandidateEligible(location)
        ? evaluator(evaluatorInput(location))
        : undefined;

      expect(isPriorityPolicyCandidateEligible(location)).toBe(admitted);
      expect(evaluator).toHaveBeenCalledTimes(admitted ? 1 : 0);

      if (admitted) {
        expect(result).toEqual({
          kind: "EVALUATED",
          threadId: "30000000-0000-4000-8000-000000000003",
          tier: "NO_IMMEDIATE_SIGNALS",
          reasonCodes: [],
          reasons: [],
          reasonRoles: [],
          policyVersion: "1.0",
          evaluatedAt: "2026-07-29T10:00:00.000Z"
        });
      } else {
        expect(result).toBeUndefined();
      }
    }
  );

  it("is replay-deterministic, immutable, and independent of ambient state", () => {
    const location = Object.freeze({
      inbox: Object.freeze({ state: "VERIFIED_PRESENT" as const }),
      spam: Object.freeze({ state: "VERIFIED_ABSENT" as const }),
      trash: Object.freeze({ state: "VERIFIED_ABSENT" as const })
    });
    const before = JSON.stringify(location);
    const clock = vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("Eligibility read the current clock.");
    });
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Eligibility generated random state.");
    });
    const environment = vi.spyOn(process, "cwd").mockImplementation(() => {
      throw new Error("Eligibility read process environment state.");
    });
    const network = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("Eligibility accessed the network.");
    });

    try {
      expect(isPriorityPolicyCandidateEligible(location)).toBe(true);
      expect(isPriorityPolicyCandidateEligible(location)).toBe(true);
      expect(JSON.stringify(location)).toBe(before);
      expect(clock).not.toHaveBeenCalled();
      expect(random).not.toHaveBeenCalled();
      expect(environment).not.toHaveBeenCalled();
      expect(network).not.toHaveBeenCalled();
    } finally {
      clock.mockRestore();
      random.mockRestore();
      environment.mockRestore();
      network.mockRestore();
    }
  });

  it("fails a direct evaluator call that bypasses candidate admission", () => {
    const input = evaluatorInput({
      inbox: { state: "VERIFIED_PRESENT" },
      spam: { state: "VERIFIED_ABSENT" },
      trash: { state: "VERIFIED_ABSENT" }
    });
    const invalidInput = {
      ...input,
      candidate: {
        ...input.candidate,
        location: {
          inbox: { state: "VERIFIED_ABSENT" },
          spam: { state: "VERIFIED_ABSENT" },
          trash: { state: "VERIFIED_ABSENT" }
        }
      }
    } as unknown as PriorityPolicyEvaluatorInput;

    expect(() => evaluatePriorityPolicy(invalidInput)).toThrow(
      new TypeError(
        "Priority Policy evaluation requires an admitted candidate."
      )
    );
  });

  it.each(malformedLocationEvidence)(
    "rejects %s without throwing from the public predicate",
    (_label, malformedLocation) => {
      const location =
        malformedLocation as unknown as NormalizedLocationEvidence;

      expect(() => isPriorityPolicyCandidateEligible(location)).not.toThrow();
      expect(isPriorityPolicyCandidateEligible(location)).toBe(false);
    }
  );

  it.each(malformedLocationEvidence)(
    "rejects %s through the stable evaluator programming error",
    (_label, malformedLocation) => {
      const input = evaluatorInput({
        inbox: { state: "VERIFIED_PRESENT" },
        spam: { state: "VERIFIED_ABSENT" },
        trash: { state: "VERIFIED_ABSENT" }
      });
      const invalidInput = {
        ...input,
        candidate: {
          ...input.candidate,
          location: malformedLocation
        }
      } as unknown as PriorityPolicyEvaluatorInput;

      expect(() => evaluatePriorityPolicy(invalidInput)).toThrow(
        new TypeError(
          "Priority Policy evaluation requires an admitted candidate."
        )
      );
    }
  );

  it("narrows normalized evidence to the evaluator location contract", () => {
    const location: NormalizedLocationEvidence = {
      inbox: { state: "VERIFIED_PRESENT" },
      spam: { state: "VERIFIED_ABSENT" },
      trash: { state: "VERIFIED_ABSENT" }
    };

    if (isPriorityPolicyCandidateEligible(location)) {
      expectTypeOf(location).toEqualTypeOf<AdmittedLocationFixture>();
    }
  });
});
