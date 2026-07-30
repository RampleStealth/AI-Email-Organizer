import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  admitPriorityPolicyCandidates,
  createPriorityPolicyCollectionEvaluation,
  evaluatePriorityPolicy,
  orderPriorityPolicyCandidates,
  verifyPriorityPolicyReplay,
  type ApplicationMessageId,
  type ApprovedParameterIdentity,
  type CanonicalTimestamp,
  type CorrectionTransitionId,
  type EvidenceSnapshotId,
  type MailboxId,
  type OwnerId,
  type PriorityPolicyAdmissionCandidate,
  type PriorityPolicyReplayFixture,
  type PriorityPolicyReplayVerificationResult,
  type ProviderBindingTransitionId,
  type ThreadId
} from "@aio/priority-policy";
import {
  PRIORITY_POLICY_V1_EMPTY_REPLAY_FIXTURE,
  PRIORITY_POLICY_V1_REPRESENTATIVE_REPLAY_FIXTURE,
  PRIORITY_POLICY_V1_REPLAY_FIXTURES
} from "../../fixtures/replay/priority-policy-v1.js";

const OWNER_ID = id<OwnerId>("10000000-0000-4000-8000-000000000001");
const MAILBOX_ID = id<MailboxId>(
  "20000000-0000-4000-8000-000000000001"
);
const EVALUATED_AT = id<CanonicalTimestamp>(
  "2026-07-30T10:00:00.000Z"
);

function id<Value extends string>(value: string): Value {
  return value as Value;
}

function threadId(index: number): ThreadId {
  return id<ThreadId>(
    `30000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`
  );
}

function candidate(
  index: number,
  overrides: Partial<PriorityPolicyAdmissionCandidate> = {}
): PriorityPolicyAdmissionCandidate {
  return {
    scope: { ownerId: OWNER_ID, mailboxId: MAILBOX_ID },
    threadId: threadId(index),
    providerBinding: {
      transitionId: id<ProviderBindingTransitionId>(
        `50000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`
      )
    },
    location: {
      inbox: { state: "VERIFIED_PRESENT" },
      spam: { state: "VERIFIED_ABSENT" },
      trash: { state: "VERIFIED_ABSENT" }
    },
    candidateTimestamp: {
      state: "VERIFIED",
      value: id<CanonicalTimestamp>(
        `2026-07-30T09:${(index % 60).toString().padStart(2, "0")}:00.000Z`
      ),
      sourceMessageId: id<ApplicationMessageId>(
        `40000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`
      )
    },
    providerStar: { state: "VERIFIED_ABSENT" },
    correction: { state: "VERIFIED_ABSENT" },
    ...overrides
  };
}

function canonicalOutput(
  candidates: readonly PriorityPolicyAdmissionCandidate[],
  coverage: "READY" | "PARTIAL" = "READY",
  returnedCandidateCount = Math.min(candidates.length, 100),
  continuationAvailable =
    Math.min(candidates.length, 100) > returnedCandidateCount
): string {
  const scope = { ownerId: OWNER_ID, mailboxId: MAILBOX_ID };
  const admitted = admitPriorityPolicyCandidates({
    scope,
    candidates,
    context: {
      policyVersion: "1.0",
      evaluatedAt: EVALUATED_AT,
      parameters: { futureSkewTolerance: "PT5M" }
    },
    delivery: { candidateLimit: 100 }
  });
  const evaluations = admitted.map((value) => {
    const evaluation = evaluatePriorityPolicy({
      scope,
      candidate: value,
      context: {
        policyVersion: "1.0",
        evaluatedAt: EVALUATED_AT,
        evidenceSnapshotId: id<EvidenceSnapshotId>("opaque-snapshot"),
        parameters: {
          identity: id<ApprovedParameterIdentity>("opaque-parameters"),
          futureSkewTolerance: "PT5M"
        }
      }
    });
    if (evaluation.kind !== "EVALUATED") {
      throw new Error("Expected evaluated test input.");
    }
    return { scope, evaluation };
  });
  const ordered = orderPriorityPolicyCandidates({
    scope,
    admittedCandidates: admitted,
    evaluations,
    context: {
      policyVersion: "1.0",
      evaluatedAt: EVALUATED_AT,
      parameters: { futureSkewTolerance: "PT5M" }
    }
  });
  return JSON.stringify(
    createPriorityPolicyCollectionEvaluation({
      scope,
      orderedCandidates: ordered,
      context: { policyVersion: "1.0", evaluatedAt: EVALUATED_AT },
      synchronization: { coverage },
      delivery: { returnedCandidateCount, continuationAvailable }
    })
  );
}

function fixture(
  candidates: readonly PriorityPolicyAdmissionCandidate[] = [],
  overrides: {
    readonly expected?: string;
    readonly coverage?: "READY" | "PARTIAL";
    readonly returnedCandidateCount?: number;
    readonly continuationAvailable?: boolean;
    readonly snapshot?: string;
    readonly parameters?: string;
  } = {}
): PriorityPolicyReplayFixture {
  const returnedCandidateCount =
    overrides.returnedCandidateCount ?? Math.min(candidates.length, 100);
  const continuationAvailable =
    overrides.continuationAvailable ??
    Math.min(candidates.length, 100) > returnedCandidateCount;
  const coverage = overrides.coverage ?? "READY";
  return {
    input: {
      scope: { ownerId: OWNER_ID, mailboxId: MAILBOX_ID },
      candidates,
      context: {
        policyVersion: "1.0",
        evaluatedAt: EVALUATED_AT,
        evidenceSnapshotId: id<EvidenceSnapshotId>(
          overrides.snapshot ?? "opaque-snapshot"
        ),
        parameters: {
          identity: id<ApprovedParameterIdentity>(
            overrides.parameters ?? "opaque-parameters"
          ),
          futureSkewTolerance: "PT5M"
        }
      },
      synchronization: { coverage },
      delivery: { returnedCandidateCount, continuationAvailable }
    },
    expectedSerializedOutput:
      overrides.expected ??
      canonicalOutput(
        candidates,
        coverage,
        returnedCandidateCount,
        continuationAvailable
      )
  };
}

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function invalidFixture(value: unknown): void {
  expect(() =>
    verifyPriorityPolicyReplay(value as PriorityPolicyReplayFixture)
  ).toThrow(new TypeError("Invalid Priority Policy replay fixture."));
}

function invalidSerialization(value: PriorityPolicyReplayFixture): void {
  expect(() => verifyPriorityPolicyReplay(value)).toThrow(
    new TypeError("Invalid canonical Priority Policy replay serialization.")
  );
}

function mutateExpected(
  source: PriorityPolicyReplayFixture,
  mutate: (value: Record<string, any>) => void
): PriorityPolicyReplayFixture {
  const value = JSON.parse(source.expectedSerializedOutput) as Record<
    string,
    any
  >;
  mutate(value);
  return { ...source, expectedSerializedOutput: JSON.stringify(value) };
}

function expectDeepFrozen(value: unknown): void {
  if (value !== null && typeof value === "object") {
    expect(Object.isFrozen(value)).toBe(true);
    for (const nested of Object.values(value)) {
      expectDeepFrozen(nested);
    }
  }
}

describe("Milestone 9 canonical fixtures and public contract", () => {
  it("replays the minimal canonical fixture registry", () => {
    expect(PRIORITY_POLICY_V1_REPLAY_FIXTURES).toHaveLength(2);
    for (const value of PRIORITY_POLICY_V1_REPLAY_FIXTURES) {
      expect(verifyPriorityPolicyReplay(value).kind).toBe("MATCH");
    }
  });

  it.each([0, 1, 100])("accepts a valid %i-candidate fixture", (count) => {
    expect(
      verifyPriorityPolicyReplay(
        fixture(
          Array.from({ length: count }, (_, index) => candidate(index + 1))
        )
      ).kind
    ).toBe("MATCH");
  });

  it("exposes only the approved result shapes", () => {
    expectTypeOf(verifyPriorityPolicyReplay).returns.toEqualTypeOf<
      PriorityPolicyReplayVerificationResult
    >();
    const match = verifyPriorityPolicyReplay(
      PRIORITY_POLICY_V1_EMPTY_REPLAY_FIXTURE
    );
    expect(Object.keys(match)).toEqual([
      "kind",
      "evaluation",
      "serializedEvaluation"
    ]);
  });
});

describe("Milestone 9 fixture validation", () => {
  it.each([
    null,
    [],
    {},
    { input: {}, expectedSerializedOutput: "{}" },
    { ...fixture(), extra: true },
    { ...fixture(), expectedSerializedOutput: 1 },
    { ...fixture(), input: null },
    { ...fixture(), input: { ...fixture().input, extra: true } }
  ])("rejects malformed fixture containers %#", invalidFixture);

  it("rejects malformed scope and mixed candidate scope", () => {
    const base = fixture([candidate(1)]);
    invalidFixture({
      ...base,
      input: { ...base.input, scope: { ownerId: "owner", mailboxId: MAILBOX_ID } }
    });
    const mixed = candidate(1, {
      scope: {
        ownerId: id<OwnerId>("10000000-0000-4000-8000-000000000002"),
        mailboxId: MAILBOX_ID
      }
    });
    invalidFixture({
      ...base,
      input: { ...base.input, candidates: [mixed] }
    });
  });

  it("rejects malformed context, synchronization, and delivery", () => {
    const base = fixture();
    for (const input of [
      { ...base.input, context: null },
      {
        ...base.input,
        context: { ...base.input.context, policyVersion: "2.0" }
      },
      {
        ...base.input,
        context: { ...base.input.context, evaluatedAt: "not-a-timestamp" }
      },
      {
        ...base.input,
        context: { ...base.input.context, evidenceSnapshotId: "" }
      },
      {
        ...base.input,
        context: {
          ...base.input.context,
          parameters: { identity: "", futureSkewTolerance: "PT5M" }
        }
      },
      { ...base.input, synchronization: { coverage: "COMPLETE" } },
      { ...base.input, delivery: { returnedCandidateCount: -1, continuationAvailable: false } },
      { ...base.input, delivery: { returnedCandidateCount: 0, continuationAvailable: "no" } }
    ]) {
      invalidFixture({ ...base, input });
    }
  });

  it("rejects malformed candidates and duplicate identities", () => {
    const base = fixture([candidate(1)]);
    invalidFixture({ ...base, input: { ...base.input, candidates: [null] } });
    invalidFixture({
      ...base,
      input: {
        ...base.input,
        candidates: [candidate(1), candidate(1)]
      }
    });
    invalidFixture({
      ...base,
      input: {
        ...base.input,
        candidates: [
          candidate(1, {
            providerBinding: {
              transitionId: id<ProviderBindingTransitionId>("bad")
            }
          })
        ]
      }
    });
    invalidFixture({
      ...base,
      input: {
        ...base.input,
        candidates: [
          candidate(1, {
            correction: {
              state: "VERIFIED_ACTIVE",
              kind: "PRIORITIZE",
              transitionId: id<CorrectionTransitionId>("bad")
            }
          })
        ]
      }
    });
  });

  it("validates every nested evidence variant and rejects malformed evidence", () => {
    const unknownTimestamp = candidate(1, {
      candidateTimestamp: { state: "UNKNOWN" },
      providerStar: { state: "UNKNOWN" },
      correction: { state: "UNKNOWN" }
    });
    const activeNotImportant = candidate(2, {
      correction: {
        state: "VERIFIED_ACTIVE",
        kind: "NOT_IMPORTANT",
        transitionId: id<CorrectionTransitionId>(
          "60000000-0000-4000-8000-000000000002"
        )
      }
    });
    expect(
      verifyPriorityPolicyReplay(
        fixture([unknownTimestamp, activeNotImportant])
      ).kind
    ).toBe("MATCH");

    const base = fixture([candidate(1)]);
    for (const malformed of [
      candidate(1, {
        location: {
          inbox: { state: "INVALID" } as never,
          spam: { state: "VERIFIED_ABSENT" },
          trash: { state: "VERIFIED_ABSENT" }
        }
      }),
      candidate(1, { providerStar: { state: "INVALID" } as never }),
      candidate(1, {
        candidateTimestamp: {
          state: "VERIFIED",
          value: id<CanonicalTimestamp>("invalid"),
          sourceMessageId: id<ApplicationMessageId>(
            "40000000-0000-4000-8000-000000000001"
          )
        }
      }),
      candidate(1, {
        candidateTimestamp: { state: "OTHER" } as never
      }),
      candidate(1, {
        candidateTimestamp: {
          state: "UNKNOWN",
          extra: true
        } as never
      }),
      candidate(1, {
        correction: { state: "OTHER" } as never
      })
    ]) {
      invalidFixture({
        ...base,
        input: { ...base.input, candidates: [malformed] }
      });
    }
  });

  it("translates published-stage rejection to the replay fixture boundary", () => {
    const base = fixture([candidate(1)]);
    const ineligible = candidate(1, {
      location: {
        inbox: { state: "VERIFIED_ABSENT" },
        spam: { state: "VERIFIED_ABSENT" },
        trash: { state: "VERIFIED_ABSENT" }
      }
    });
    invalidFixture({
      ...base,
      input: { ...base.input, candidates: [ineligible] }
    });
  });

  it("preserves opaque evidence and parameter identities without UUID syntax", () => {
    expect(
      verifyPriorityPolicyReplay(
        fixture([], {
          snapshot: "provider-neutral:snapshot:α",
          parameters: "approved:parameters:one"
        })
      ).kind
    ).toBe("MATCH");
  });
});

describe("Milestone 9 canonical serialization validation", () => {
  it("accepts compact canonical JSON and rejects malformed or formatted JSON", () => {
    expect(
      verifyPriorityPolicyReplay(PRIORITY_POLICY_V1_EMPTY_REPLAY_FIXTURE).kind
    ).toBe("MATCH");
    invalidSerialization({
      ...fixture(),
      expectedSerializedOutput: "{"
    });
    invalidSerialization({
      ...fixture(),
      expectedSerializedOutput: JSON.stringify(
        JSON.parse(fixture().expectedSerializedOutput),
        null,
        2
      )
    });
  });

  it("rejects reordered, missing, and additional properties", () => {
    const base = fixture();
    const parsed = JSON.parse(base.expectedSerializedOutput);
    const { policyVersion, ...rest } = parsed;
    invalidSerialization({
      ...base,
      expectedSerializedOutput: JSON.stringify({ ...rest, policyVersion })
    });
    invalidSerialization(
      mutateExpected(base, (value) => {
        delete value.ordering;
      })
    );
    invalidSerialization(
      mutateExpected(base, (value) => {
        value.extra = true;
      })
    );
    invalidSerialization({
      ...base,
      expectedSerializedOutput: base.expectedSerializedOutput.replace(
        '{"coverage":"READY"}',
        '{"extra":false,"coverage":"READY"}'
      )
    });
  });

  it("rejects malformed timestamps, enums, counts, arrays, and certificates", () => {
    const base = fixture();
    const mutations: readonly ((value: Record<string, any>) => void)[] = [
      (value) => (value.validThrough = "invalid"),
      (value) => (value.synchronization.coverage = "COMPLETE"),
      (value) => (value.delivery.returnedCandidateCount = -1),
      (value) => (value.candidates = {}),
      (value) => (value.candidates = ["not-an-object"]),
      (value) => {
        value.candidates = [
          {
            ...JSON.parse(
              PRIORITY_POLICY_V1_REPRESENTATIVE_REPLAY_FIXTURE
                .expectedSerializedOutput
            ).candidates[0],
            reasonCodes: [1]
          }
        ];
        value.delivery.evaluatedCandidateCount = 1;
        value.delivery.returnedCandidateCount = 1;
      },
      (value) => (value.ordering.scheme = "OTHER"),
      (value) => (value.policyVersion = "2.0")
    ];
    for (const mutate of mutations) {
      invalidSerialization(mutateExpected(base, mutate));
    }
  });

  it("rejects every noncanonical candidate-scope field", () => {
    const base = fixture();
    const mutations: readonly ((scope: Record<string, any>) => void)[] = [
      (scope) => (scope.entityType = "MESSAGE"),
      (scope) => (scope.ownerScope = "ANY_OWNER"),
      (scope) => (scope.mailboxScope = "ANY_MAILBOX"),
      (scope) => (scope.locationKnowledge = "UNKNOWN"),
      (scope) => (scope.requiredPresentLocations = []),
      (scope) => (scope.requiredAbsentLocations = ["TRASH", "SPAM"]),
      (scope) => (scope.additionalLocationMembership = "DISQUALIFIES"),
      (scope) => (scope.temporalLookback = "PT24H"),
      (scope) => (scope.candidateCountLimit = 100)
    ];
    for (const mutate of mutations) {
      invalidSerialization(
        mutateExpected(base, (value) => mutate(value.candidateScope))
      );
    }
  });

  it("rejects invalid reasons, roles, and candidate clock/version alignment", () => {
    const base = PRIORITY_POLICY_V1_REPRESENTATIVE_REPLAY_FIXTURE;
    const mutations: readonly ((value: Record<string, any>) => void)[] = [
      (value) => (value.candidates[0].reasons[0] = "Not canonical."),
      (value) => (value.candidates[0].reasonRoles[0] = "PRIMARY"),
      (value) => value.candidates[0].reasonCodes.push("PROVIDER_STAR"),
      (value) => (value.candidates[0].policyVersion = "2.0"),
      (value) =>
        (value.candidates[0].evaluatedAt = "2026-07-30T10:00:01.000Z")
    ];
    for (const mutate of mutations) {
      invalidSerialization(mutateExpected(base, mutate));
    }
  });

  it("rejects delivery and evidence-completeness contradictions", () => {
    const base = PRIORITY_POLICY_V1_REPRESENTATIVE_REPLAY_FIXTURE;
    for (const mutate of [
      (value: Record<string, any>) => (value.delivery.state = "PARTIAL"),
      (value: Record<string, any>) =>
        (value.delivery.continuationAvailable = true),
      (value: Record<string, any>) =>
        (value.evidenceCompleteness = {
          state: "INCOMPLETE",
          incompleteEvidence: []
        }),
      (value: Record<string, any>) =>
        (value.evidenceCompleteness = {
          state: "INCOMPLETE",
          incompleteEvidence: [
            { kind: "POLICY_LABELS", affectedCandidateCount: 2 }
          ]
        }),
      (value: Record<string, any>) =>
        (value.evidenceCompleteness = {
          state: "INCOMPLETE",
          incompleteEvidence: {}
        }),
      (value: Record<string, any>) =>
        (value.evidenceCompleteness = {
          state: "INCOMPLETE",
          incompleteEvidence: [
            { kind: "OTHER", affectedCandidateCount: 1 }
          ]
        })
    ]) {
      invalidSerialization(mutateExpected(base, mutate));
    }
  });

  it("rejects a canonical expected clock that differs from the fixture", () => {
    const base = fixture();
    invalidSerialization(
      mutateExpected(base, (value) => {
        value.evaluatedAt = "2026-07-30T10:00:01.000Z";
      })
    );
  });
});

describe("Milestone 9 replay equality", () => {
  it("returns MATCH for exact canonical output", () => {
    const result = verifyPriorityPolicyReplay(
      PRIORITY_POLICY_V1_REPRESENTATIVE_REPLAY_FIXTURE
    );
    expect(result.kind).toBe("MATCH");
    if (result.kind === "MATCH") {
      expect(result.serializedEvaluation).toBe(
        PRIORITY_POLICY_V1_REPRESENTATIVE_REPLAY_FIXTURE.expectedSerializedOutput
      );
    }
  });

  it.each([
    ["membership", fixture([candidate(1)], { expected: fixture().expectedSerializedOutput })],
    [
      "tier",
      mutateExpected(
        fixture([
          candidate(1, { providerStar: { state: "VERIFIED_PRESENT" } })
        ]),
        (value) => (value.candidates[0].tier = "NEEDS_ATTENTION")
      )
    ],
    [
      "reason",
      mutateExpected(
        fixture([
          candidate(1, { providerStar: { state: "VERIFIED_PRESENT" } })
        ]),
        (value) => {
          value.candidates[0].reasonCodes = ["RECENCY"];
          value.candidates[0].reasons = ["Received recently."];
        }
      )
    ],
    [
      "reason role",
      mutateExpected(
        fixture([
          candidate(1, { providerStar: { state: "VERIFIED_PRESENT" } })
        ]),
        (value) => {
          value.candidates[0].reasonRoles = ["SUPPORTING"];
        }
      )
    ],
    [
      "candidate order",
      mutateExpected(
        fixture([
          candidate(1),
          candidate(2, {
            candidateTimestamp: {
              state: "VERIFIED",
              value: id<CanonicalTimestamp>(
                "2026-07-30T08:00:00.000Z"
              ),
              sourceMessageId: id<ApplicationMessageId>(
                "40000000-0000-4000-8000-000000000002"
              )
            }
          })
        ]),
        (value) => value.candidates.reverse()
      )
    ],
    [
      "synchronization",
      mutateExpected(fixture([candidate(1)]), (value) => {
        value.synchronization.coverage = "PARTIAL";
      })
    ],
    [
      "delivery",
      mutateExpected(fixture([candidate(1), candidate(2)]), (value) => {
        value.delivery.state = "PARTIAL";
        value.delivery.returnedCandidateCount = 1;
        value.delivery.continuationAvailable = true;
        value.candidates = value.candidates.slice(0, 1);
      })
    ],
    [
      "evidence completeness",
      mutateExpected(fixture([candidate(1)]), (value) => {
        value.evidenceCompleteness = {
          state: "INCOMPLETE",
          incompleteEvidence: [
            { kind: "POLICY_LABELS", affectedCandidateCount: 1 }
          ]
        };
      })
    ],
    [
      "validity boundary",
      mutateExpected(fixture([candidate(1)]), (value) => {
        value.validThrough = "2026-07-30T10:06:00.000Z";
      })
    ]
  ])("returns MISMATCH for a structurally valid %s difference", (_, value) => {
    const result = verifyPriorityPolicyReplay(value);
    expect(result.kind).toBe("MISMATCH");
    if (result.kind === "MISMATCH") {
      expect(result.actualSerializedEvaluation).not.toBe(
        result.expectedSerializedEvaluation
      );
    }
  });
});

describe("Milestone 9 determinism and immutability", () => {
  it("converges across repetition, fresh graphs, and input permutations", () => {
    const candidates = [
      candidate(1),
      candidate(2, { providerStar: { state: "VERIFIED_PRESENT" } }),
      candidate(3, { correction: { state: "UNKNOWN" } })
    ];
    const expected = canonicalOutput(candidates);
    const first = verifyPriorityPolicyReplay(fixture(candidates, { expected }));
    const repeated = verifyPriorityPolicyReplay(
      fixture(clone(candidates), { expected })
    );
    const permuted = verifyPriorityPolicyReplay(
      fixture([...clone(candidates)].reverse(), { expected })
    );
    expect(first).toEqual(repeated);
    expect(permuted).toEqual(first);
  });

  it("privately bounds admission at 100 candidates", () => {
    const candidates = Array.from({ length: 101 }, (_, index) =>
      candidate(index + 1)
    );
    const result = verifyPriorityPolicyReplay(fixture(candidates));
    expect(result.evaluation.delivery.evaluatedCandidateCount).toBe(100);
  });

  it("preserves valid partial delivery through replay", () => {
    const candidates = [candidate(1), candidate(2)];
    const result = verifyPriorityPolicyReplay(
      fixture(candidates, {
        returnedCandidateCount: 1,
        continuationAvailable: true
      })
    );
    expect(result.kind).toBe("MATCH");
    expect(result.evaluation.delivery.state).toBe("PARTIAL");
  });

  it("does not mutate or retain caller-owned nested objects", () => {
    const source = fixture([
      candidate(1, { providerStar: { state: "VERIFIED_PRESENT" } })
    ]);
    const before = JSON.stringify(source);
    const sourceCandidate = source.input.candidates[0]!;
    const result = verifyPriorityPolicyReplay(source);

    expect(JSON.stringify(source)).toBe(before);
    expect(result.evaluation.candidates[0]).not.toBe(sourceCandidate);
    expectDeepFrozen(result);
    expectDeepFrozen(result.evaluation);
  });

  it("does not access clock, randomness, environment, or network", () => {
    const clock = vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("clock");
    });
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("random");
    });
    const environment = vi.spyOn(process, "env", "get").mockImplementation(() => {
      throw new Error("environment");
    });
    const network = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("network");
    });
    try {
      expect(verifyPriorityPolicyReplay(fixture()).kind).toBe("MATCH");
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
