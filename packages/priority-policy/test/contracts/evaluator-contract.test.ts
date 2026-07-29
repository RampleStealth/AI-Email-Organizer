import { describe, expect, it } from "vitest";
import * as priorityPolicy from "@aio/priority-policy";
import {
  evaluatePriorityPolicy,
  PriorityPolicyEvaluatorNotImplementedError
} from "@aio/priority-policy";
import type {
  ApplicationMessageId,
  ApprovedParameterIdentity,
  CanonicalTimestamp,
  CorrectionTransitionId,
  EvidenceSnapshotId,
  MailboxId,
  OwnerId,
  PriorityPolicyEvaluationOutcome,
  PriorityPolicyEvaluatorInput,
  ProviderBindingTransitionId,
  ThreadId
} from "@aio/priority-policy";

function asIdentifier<T extends string>(value: string): T {
  return value as T;
}

function fixture(): PriorityPolicyEvaluatorInput {
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
      location: {
        inbox: { state: "VERIFIED_PRESENT" },
        spam: { state: "VERIFIED_ABSENT" },
        trash: { state: "VERIFIED_ABSENT" }
      },
      candidateTimestamp: {
        state: "VERIFIED",
        value: asIdentifier<CanonicalTimestamp>("2026-07-29T09:00:00.000Z"),
        sourceMessageId: asIdentifier<ApplicationMessageId>("40000000-0000-4000-8000-000000000004")
      },
      providerStar: { state: "UNKNOWN" },
      correction: {
        state: "VERIFIED_ACTIVE",
        kind: "PRIORITIZE",
        transitionId: asIdentifier<CorrectionTransitionId>("correction-transition-11")
      }
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

function errorSnapshot(input: PriorityPolicyEvaluatorInput) {
  try {
    evaluatePriorityPolicy(input);
  } catch (error) {
    expect(error).toBeInstanceOf(PriorityPolicyEvaluatorNotImplementedError);
    const notImplemented = error as PriorityPolicyEvaluatorNotImplementedError;
    return {
      name: notImplemented.name,
      code: notImplemented.code,
      message: notImplemented.message
    };
  }
  throw new Error("The Milestone 4A skeleton returned a policy result.");
}

describe("Milestone 4A evaluator contract", () => {
  it("exposes only the deliberate runtime package surface", () => {
    expect(Object.keys(priorityPolicy).sort()).toEqual([
      "PriorityPolicyEvaluatorNotImplementedError",
      "evaluatePriorityPolicy"
    ]);
  });

  it("accepts the immutable boundary shape without returning a fake tier", () => {
    const input = fixture();

    expect(() => evaluatePriorityPolicy(input)).toThrow(
      PriorityPolicyEvaluatorNotImplementedError
    );
    expect(input.context.evaluatedAt).toBe("2026-07-29T10:00:00.000Z");
    expect(input.context.policyVersion).toBe("1.0");
    expect(input.context.parameters.futureSkewTolerance).toBe("PT5M");
  });

  it("models a normal Unknown outcome as data rather than an exception", () => {
    const input = fixture();
    const outcome: PriorityPolicyEvaluationOutcome = {
      kind: "UNKNOWN",
      threadId: input.candidate.threadId,
      policyVersion: input.context.policyVersion,
      evaluatedAt: input.context.evaluatedAt
    };

    expect(outcome).not.toBeInstanceOf(Error);
    expect(outcome.kind).toBe("UNKNOWN");
    expect("tier" in outcome).toBe(false);
    expect("reasonCodes" in outcome).toBe(false);
  });

  it("has identical skeleton behavior for identical replay input", () => {
    const input = fixture();
    const before = JSON.stringify(input);

    expect(errorSnapshot(input)).toEqual(errorSnapshot(input));
    expect(JSON.stringify(input)).toBe(before);
  });

  it("requires replay-relevant values to be supplied by the caller", () => {
    const input = fixture();

    expect(input).toMatchObject({
      candidate: {
        threadId: "30000000-0000-4000-8000-000000000003",
        providerBinding: { transitionId: "binding-transition-7" },
        candidateTimestamp: {
          sourceMessageId: "40000000-0000-4000-8000-000000000004"
        },
        correction: { transitionId: "correction-transition-11" }
      },
      context: {
        evaluatedAt: "2026-07-29T10:00:00.000Z",
        evidenceSnapshotId: "evidence-snapshot-13",
        parameters: { identity: "ppv1-parameters-1" }
      }
    });
  });
});
