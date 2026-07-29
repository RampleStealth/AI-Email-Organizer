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
  NormalizedLocationEvidence,
  OwnerId,
  PriorityPolicyEvaluationOutcome,
  PriorityPolicyEvaluatorInput,
  ProviderBindingTransitionId,
  ProviderStarEvidence,
  ThreadId
} from "@aio/priority-policy";

interface FixtureOptions {
  readonly providerStar?: ProviderStarEvidence;
  readonly correction?: CorrectionEvidence;
  readonly location?: NormalizedLocationEvidence;
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

  it("keeps unimplemented correction paths behind the development-only boundary", () => {
    const input = fixture({
      correction: {
        state: "VERIFIED_ACTIVE",
        kind: "PRIORITIZE",
        transitionId: asIdentifier<CorrectionTransitionId>("correction-transition-11")
      }
    });

    expect(() => evaluatePriorityPolicy(input)).toThrow(
      PriorityPolicyEvaluatorNotImplementedError
    );
  });

  it("keeps unimplemented eligibility paths behind the development-only boundary", () => {
    const input = fixture({
      location: {
        inbox: { state: "VERIFIED_ABSENT" },
        spam: { state: "VERIFIED_ABSENT" },
        trash: { state: "VERIFIED_ABSENT" }
      }
    });

    expect(() => evaluatePriorityPolicy(input)).toThrow(
      PriorityPolicyEvaluatorNotImplementedError
    );
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

describe("Milestone 4B package contract", () => {
  it("exposes only the deliberate runtime package surface", () => {
    expect(Object.keys(priorityPolicy).sort()).toEqual([
      "PriorityPolicyEvaluatorNotImplementedError",
      "evaluatePriorityPolicy"
    ]);
  });
});
