import { describe, expect, it, vi } from "vitest";
import * as priorityPolicy from "@aio/priority-policy";
import {
  evaluatePriorityPolicy,
  PriorityPolicyEvaluatorNotImplementedError
} from "@aio/priority-policy";
import type {
  ApplicationMessageId,
  ApprovedParameterIdentity,
  CanonicalTimestamp,
  CorrectionEvidence,
  CorrectionTransitionId,
  EvidenceSnapshotId,
  MailboxId,
  OwnerId,
  PriorityPolicyEvaluationOutcome,
  PriorityPolicyEvaluatorInput,
  ProviderBindingTransitionId,
  ProviderStarEvidence,
  ThreadId
} from "@aio/priority-policy";

type AdmittedLocationFixture =
  PriorityPolicyEvaluatorInput["candidate"]["location"];

interface FixtureOptions {
  readonly providerStar?: ProviderStarEvidence;
  readonly correction?: CorrectionEvidence;
  readonly location?: AdmittedLocationFixture;
}

function asIdentifier<T extends string>(value: string): T {
  return value as T;
}

function fixture(options: FixtureOptions = {}): PriorityPolicyEvaluatorInput {
  return {
    scope: {
      ownerId: asIdentifier<OwnerId>("10000000-0000-4000-8000-000000000001"),
      mailboxId: asIdentifier<MailboxId>("20000000-0000-4000-8000-000000000002")
    },
    candidate: {
      threadId: asIdentifier<ThreadId>("30000000-0000-4000-8000-000000000003"),
      providerBinding: {
        transitionId: asIdentifier<ProviderBindingTransitionId>("binding-transition-7")
      },
      location: options.location ?? {
        inbox: { state: "VERIFIED_PRESENT" },
        spam: { state: "VERIFIED_ABSENT" },
        trash: { state: "VERIFIED_ABSENT" }
      },
      candidateTimestamp: {
        state: "VERIFIED",
        value: asIdentifier<CanonicalTimestamp>("2026-07-29T09:00:00.000Z"),
        sourceMessageId: asIdentifier<ApplicationMessageId>("40000000-0000-4000-8000-000000000004")
      },
      providerStar: options.providerStar ?? { state: "VERIFIED_PRESENT" },
      correction: options.correction ?? { state: "VERIFIED_ABSENT" }
    },
    context: {
      policyVersion: "1.0",
      evaluatedAt: asIdentifier<CanonicalTimestamp>("2026-07-29T10:00:00.000Z"),
      evidenceSnapshotId: asIdentifier<EvidenceSnapshotId>("evidence-snapshot-13"),
      parameters: {
        identity: asIdentifier<ApprovedParameterIdentity>("ppv1-parameters-1"),
        futureSkewTolerance: "PT5M"
      }
    }
  };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const nested of Object.values(value)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}

const defaultEvaluation = {
  kind: "EVALUATED",
  threadId: "30000000-0000-4000-8000-000000000003",
  tier: "NO_IMMEDIATE_SIGNALS",
  reasonCodes: [],
  reasons: [],
  reasonRoles: [],
  policyVersion: "1.0",
  evaluatedAt: "2026-07-29T10:00:00.000Z"
} as const;

describe("Provider Star constitutional rule", () => {
  it("returns the canonical evaluated result for verified-present Provider Star", () => {
    expect(evaluatePriorityPolicy(fixture())).toEqual({
      kind: "EVALUATED",
      threadId: "30000000-0000-4000-8000-000000000003",
      tier: "REVIEW_LATER",
      reasonCodes: ["PROVIDER_STAR"],
      reasons: ["Starred in your email provider."],
      reasonRoles: ["DETERMINING"],
      policyVersion: "1.0",
      evaluatedAt: "2026-07-29T10:00:00.000Z"
    });
  });

  it("does not fabricate Provider Star behavior for verified absence", () => {
    const result = evaluatePriorityPolicy(
      fixture({ providerStar: { state: "VERIFIED_ABSENT" } })
    );

    expect(result).toEqual(defaultEvaluation);
    expect(result.kind).toBe("EVALUATED");
    expect("reasonCodes" in result && result.reasonCodes).not.toContain("PROVIDER_STAR");
  });

  it("preserves Unknown evidence without treating it as present or absent", () => {
    const input = fixture({ providerStar: { state: "UNKNOWN" } });
    const result = evaluatePriorityPolicy(input);

    expect(input.candidate.providerStar.state).toBe("UNKNOWN");
    expect(result).toEqual(defaultEvaluation);
    expect("reasonCodes" in result && result.reasonCodes).not.toContain("PROVIDER_STAR");
  });

  it("returns the complete Attention Contract fields with aligned canonical reasons", () => {
    const result = evaluatePriorityPolicy(fixture());

    expect(Object.keys(result).sort()).toEqual([
      "evaluatedAt",
      "kind",
      "policyVersion",
      "reasonCodes",
      "reasonRoles",
      "reasons",
      "threadId",
      "tier"
    ]);
    expect(result).toMatchObject({
      reasonCodes: ["PROVIDER_STAR"],
      reasons: ["Starred in your email provider."],
      reasonRoles: ["DETERMINING"]
    });
  });

  it("is structurally deterministic and does not mutate input", () => {
    const input = deepFreeze(fixture());
    const before = JSON.stringify(input);

    expect(evaluatePriorityPolicy(input)).toEqual(evaluatePriorityPolicy(input));
    expect(JSON.stringify(input)).toBe(before);
  });

  it("does not read the current clock or generate random state", () => {
    const clock = vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("The evaluator read the current clock.");
    });
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("The evaluator generated random state.");
    });

    try {
      expect(evaluatePriorityPolicy(fixture())).toMatchObject({
        evaluatedAt: "2026-07-29T10:00:00.000Z",
        threadId: "30000000-0000-4000-8000-000000000003"
      });
      expect(clock).not.toHaveBeenCalled();
      expect(random).not.toHaveBeenCalled();
    } finally {
      clock.mockRestore();
      random.mockRestore();
    }
  });

  it("keeps development-time incompleteness distinct from constitutional outcomes", () => {
    const error = new PriorityPolicyEvaluatorNotImplementedError();

    expect(error).toMatchObject({
      name: "PriorityPolicyEvaluatorNotImplementedError",
      code: "PRIORITY_POLICY_EVALUATOR_NOT_IMPLEMENTED",
      message: "Priority Policy evaluation is not implemented for this input."
    });
    expect(error).toBeInstanceOf(Error);
  });

  it("keeps constitutional Unknown distinct from an unsupported development path", () => {
    const outcome: PriorityPolicyEvaluationOutcome = {
      kind: "UNKNOWN",
      threadId: asIdentifier<ThreadId>("30000000-0000-4000-8000-000000000003"),
      policyVersion: "1.0",
      evaluatedAt: asIdentifier<CanonicalTimestamp>("2026-07-29T10:00:00.000Z")
    };

    expect(outcome).toEqual({
      kind: "UNKNOWN",
      threadId: "30000000-0000-4000-8000-000000000003",
      policyVersion: "1.0",
      evaluatedAt: "2026-07-29T10:00:00.000Z"
    });
    expect(outcome).not.toBeInstanceOf(Error);
  });
});

describe("Active Prioritize correction", () => {
  const correction: CorrectionEvidence = {
    state: "VERIFIED_ACTIVE",
    kind: "PRIORITIZE",
    transitionId: asIdentifier<CorrectionTransitionId>(
      "correction-transition-11"
    )
  };

  it("determines Needs Attention and retains verified Provider Star as ordered supporting evidence", () => {
    expect(evaluatePriorityPolicy(fixture({ correction }))).toEqual({
      kind: "EVALUATED",
      threadId: "30000000-0000-4000-8000-000000000003",
      tier: "NEEDS_ATTENTION",
      reasonCodes: ["USER_PRIORITIZE", "PROVIDER_STAR"],
      reasons: [
        "You prioritized this conversation.",
        "Starred in your email provider."
      ],
      reasonRoles: ["DETERMINING", "SUPPORTING"],
      policyVersion: "1.0",
      evaluatedAt: "2026-07-29T10:00:00.000Z"
    });
  });

  it("determines Needs Attention without fabricating a reason for absent Provider Star", () => {
    expect(
      evaluatePriorityPolicy(
        fixture({
          correction,
          providerStar: { state: "VERIFIED_ABSENT" }
        })
      )
    ).toEqual({
      kind: "EVALUATED",
      threadId: "30000000-0000-4000-8000-000000000003",
      tier: "NEEDS_ATTENTION",
      reasonCodes: ["USER_PRIORITIZE"],
      reasons: ["You prioritized this conversation."],
      reasonRoles: ["DETERMINING"],
      policyVersion: "1.0",
      evaluatedAt: "2026-07-29T10:00:00.000Z"
    });
  });

  it("determines Needs Attention while preserving Unknown Provider Star without a star reason", () => {
    const input = fixture({
      correction,
      providerStar: { state: "UNKNOWN" }
    });

    expect(evaluatePriorityPolicy(input)).toEqual({
      kind: "EVALUATED",
      threadId: "30000000-0000-4000-8000-000000000003",
      tier: "NEEDS_ATTENTION",
      reasonCodes: ["USER_PRIORITIZE"],
      reasons: ["You prioritized this conversation."],
      reasonRoles: ["DETERMINING"],
      policyVersion: "1.0",
      evaluatedAt: "2026-07-29T10:00:00.000Z"
    });
    expect(input.candidate.providerStar.state).toBe("UNKNOWN");
  });

  it("is replay-deterministic and leaves active Prioritize input unchanged", () => {
    const input = deepFreeze(fixture({ correction }));
    const before = JSON.stringify(input);

    expect(evaluatePriorityPolicy(input)).toEqual(evaluatePriorityPolicy(input));
    expect(JSON.stringify(input)).toBe(before);
  });

  it("reads no clock, randomness, environment, or network state", () => {
    const clock = vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("The evaluator read the current clock.");
    });
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("The evaluator generated random state.");
    });
    const environment = vi.spyOn(process, "cwd").mockImplementation(() => {
      throw new Error("The evaluator read process environment state.");
    });
    const network = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("The evaluator accessed the network.");
    });

    try {
      expect(
        evaluatePriorityPolicy(fixture({ correction }))
      ).toMatchObject({
        evaluatedAt: "2026-07-29T10:00:00.000Z",
        threadId: "30000000-0000-4000-8000-000000000003"
      });
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
});

describe("Unknown correction evidence fallback", () => {
  it("continues verified-present Provider Star evaluation without inventing correction evidence", () => {
    const input = fixture({ correction: { state: "UNKNOWN" } });

    expect(evaluatePriorityPolicy(input)).toEqual({
      kind: "EVALUATED",
      threadId: "30000000-0000-4000-8000-000000000003",
      tier: "REVIEW_LATER",
      reasonCodes: ["PROVIDER_STAR"],
      reasons: ["Starred in your email provider."],
      reasonRoles: ["DETERMINING"],
      policyVersion: "1.0",
      evaluatedAt: "2026-07-29T10:00:00.000Z"
    });
    expect(input.candidate.correction.state).toBe("UNKNOWN");
  });

  it("uses the completed default for verified-absent Provider Star without claiming correction absence", () => {
    const input = fixture({
      correction: { state: "UNKNOWN" },
      providerStar: { state: "VERIFIED_ABSENT" }
    });

    expect(evaluatePriorityPolicy(input)).toEqual(defaultEvaluation);
    expect(input.candidate.correction.state).toBe("UNKNOWN");
  });

  it("preserves both correction and Provider Star uncertainty without fabricating reasons", () => {
    const input = fixture({
      correction: { state: "UNKNOWN" },
      providerStar: { state: "UNKNOWN" }
    });
    const result = evaluatePriorityPolicy(input);

    expect(result).toEqual(defaultEvaluation);
    expect(input.candidate.correction.state).toBe("UNKNOWN");
    expect(input.candidate.providerStar.state).toBe("UNKNOWN");
    expect("reasonCodes" in result && result.reasonCodes).toEqual([]);
  });

  it("is replay-deterministic and leaves Unknown correction input unchanged", () => {
    const input = deepFreeze(fixture({ correction: { state: "UNKNOWN" } }));
    const before = JSON.stringify(input);

    expect(evaluatePriorityPolicy(input)).toEqual(evaluatePriorityPolicy(input));
    expect(JSON.stringify(input)).toBe(before);
  });

  it("reads no clock, randomness, or network state", () => {
    const clock = vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("The evaluator read the current clock.");
    });
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("The evaluator generated random state.");
    });
    const network = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("The evaluator accessed the network.");
    });

    try {
      expect(
        evaluatePriorityPolicy(
          fixture({ correction: { state: "UNKNOWN" } })
        )
      ).toMatchObject({
        evaluatedAt: "2026-07-29T10:00:00.000Z",
        threadId: "30000000-0000-4000-8000-000000000003"
      });
      expect(clock).not.toHaveBeenCalled();
      expect(random).not.toHaveBeenCalled();
      expect(network).not.toHaveBeenCalled();
    } finally {
      clock.mockRestore();
      random.mockRestore();
      network.mockRestore();
    }
  });

});

describe("Active Not Important correction", () => {
  const correction: CorrectionEvidence = {
    state: "VERIFIED_ACTIVE",
    kind: "NOT_IMPORTANT",
    transitionId: asIdentifier<CorrectionTransitionId>(
      "correction-transition-12"
    )
  };

  it("determines No Immediate Signals and retains verified Provider Star as ordered supporting evidence", () => {
    expect(evaluatePriorityPolicy(fixture({ correction }))).toEqual({
      kind: "EVALUATED",
      threadId: "30000000-0000-4000-8000-000000000003",
      tier: "NO_IMMEDIATE_SIGNALS",
      reasonCodes: ["USER_NOT_IMPORTANT", "PROVIDER_STAR"],
      reasons: [
        "You marked this conversation as not important.",
        "Starred in your email provider."
      ],
      reasonRoles: ["DETERMINING", "SUPPORTING"],
      policyVersion: "1.0",
      evaluatedAt: "2026-07-29T10:00:00.000Z"
    });
  });

  it("determines No Immediate Signals without fabricating a reason for absent Provider Star", () => {
    expect(
      evaluatePriorityPolicy(
        fixture({
          correction,
          providerStar: { state: "VERIFIED_ABSENT" }
        })
      )
    ).toEqual({
      kind: "EVALUATED",
      threadId: "30000000-0000-4000-8000-000000000003",
      tier: "NO_IMMEDIATE_SIGNALS",
      reasonCodes: ["USER_NOT_IMPORTANT"],
      reasons: ["You marked this conversation as not important."],
      reasonRoles: ["DETERMINING"],
      policyVersion: "1.0",
      evaluatedAt: "2026-07-29T10:00:00.000Z"
    });
  });

  it("determines No Immediate Signals while preserving Unknown Provider Star without a star reason", () => {
    const input = fixture({
      correction,
      providerStar: { state: "UNKNOWN" }
    });

    expect(evaluatePriorityPolicy(input)).toEqual({
      kind: "EVALUATED",
      threadId: "30000000-0000-4000-8000-000000000003",
      tier: "NO_IMMEDIATE_SIGNALS",
      reasonCodes: ["USER_NOT_IMPORTANT"],
      reasons: ["You marked this conversation as not important."],
      reasonRoles: ["DETERMINING"],
      policyVersion: "1.0",
      evaluatedAt: "2026-07-29T10:00:00.000Z"
    });
    expect(input.candidate.providerStar.state).toBe("UNKNOWN");
  });

  it("is replay-deterministic and leaves active Not Important input unchanged", () => {
    const input = deepFreeze(fixture({ correction }));
    const before = JSON.stringify(input);

    expect(evaluatePriorityPolicy(input)).toEqual(evaluatePriorityPolicy(input));
    expect(JSON.stringify(input)).toBe(before);
  });

  it("reads no clock, randomness, environment, or network state", () => {
    const clock = vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("The evaluator read the current clock.");
    });
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("The evaluator generated random state.");
    });
    const environment = vi.spyOn(process, "cwd").mockImplementation(() => {
      throw new Error("The evaluator read process environment state.");
    });
    const network = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("The evaluator accessed the network.");
    });

    try {
      expect(
        evaluatePriorityPolicy(fixture({ correction }))
      ).toMatchObject({
        evaluatedAt: "2026-07-29T10:00:00.000Z",
        threadId: "30000000-0000-4000-8000-000000000003"
      });
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
});

describe("Milestone 4E package contract", () => {
  it("exposes only the deliberate runtime package surface", () => {
    expect(Object.keys(priorityPolicy).sort()).toEqual([
      "PriorityPolicyEvaluatorNotImplementedError",
      "admitPriorityPolicyCandidates",
      "evaluatePriorityPolicy",
      "isPriorityPolicyCandidateEligible"
    ]);
  });
});
