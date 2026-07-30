import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  admitPriorityPolicyCandidates,
  createPriorityPolicyCollectionEvaluation,
  evaluatePriorityPolicy,
  orderPriorityPolicyCandidates,
  type ApplicationMessageId,
  type ApprovedParameterIdentity,
  type CanonicalTimestamp,
  type CorrectionTransitionId,
  type EvaluatedOutcome,
  type EvidenceSnapshotId,
  type MailboxId,
  type OwnerId,
  type PriorityPolicyAdmissionCandidate,
  type PriorityPolicyCollectionEvaluation,
  type PriorityPolicyCollectionEvaluationInput,
  type PriorityPolicyEvaluatorInput,
  type PriorityPolicyOrderedEvaluatedCandidate,
  type ProviderBindingTransitionId,
  type ThreadId
} from "@aio/priority-policy";

const OWNER_ID = identifier<OwnerId>(
  "10000000-0000-4000-8000-000000000001"
);
const OTHER_OWNER_ID = identifier<OwnerId>(
  "10000000-0000-4000-8000-000000000002"
);
const MAILBOX_ID = identifier<MailboxId>(
  "20000000-0000-4000-8000-000000000001"
);
const OTHER_MAILBOX_ID = identifier<MailboxId>(
  "20000000-0000-4000-8000-000000000002"
);
const EVALUATED_AT = identifier<CanonicalTimestamp>(
  "2026-07-30T10:00:00.000Z"
);

interface CandidateOptions {
  readonly ownerId?: OwnerId;
  readonly mailboxId?: MailboxId;
  readonly timestamp?: string | "UNKNOWN";
  readonly providerStar?: "VERIFIED_PRESENT" | "VERIFIED_ABSENT" | "UNKNOWN";
  readonly correction?: "ABSENT" | "UNKNOWN" | "PRIORITIZE" | "NOT_IMPORTANT";
}

function identifier<Value extends string>(value: string): Value {
  return value as Value;
}

function threadId(index: number): ThreadId {
  return identifier<ThreadId>(
    `30000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`
  );
}

function candidate(
  index: number,
  options: CandidateOptions = {}
): PriorityPolicyAdmissionCandidate {
  const timestamp = options.timestamp ?? "2026-07-30T09:00:00.000Z";
  const correction = options.correction ?? "ABSENT";

  return {
    scope: {
      ownerId: options.ownerId ?? OWNER_ID,
      mailboxId: options.mailboxId ?? MAILBOX_ID
    },
    threadId: threadId(index),
    providerBinding: {
      transitionId: identifier<ProviderBindingTransitionId>(
        `50000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`
      )
    },
    location: {
      inbox: { state: "VERIFIED_PRESENT" },
      spam: { state: "VERIFIED_ABSENT" },
      trash: { state: "VERIFIED_ABSENT" }
    },
    candidateTimestamp:
      timestamp === "UNKNOWN"
        ? { state: "UNKNOWN" }
        : {
            state: "VERIFIED",
            value: identifier<CanonicalTimestamp>(timestamp),
            sourceMessageId: identifier<ApplicationMessageId>(
              `40000000-0000-4000-8000-${index
                .toString(16)
                .padStart(12, "0")}`
            )
          },
    providerStar: { state: options.providerStar ?? "VERIFIED_ABSENT" },
    correction:
      correction === "ABSENT"
        ? { state: "VERIFIED_ABSENT" }
        : correction === "UNKNOWN"
          ? { state: "UNKNOWN" }
          : {
              state: "VERIFIED_ACTIVE",
              kind: correction,
              transitionId: identifier<CorrectionTransitionId>(
                `60000000-0000-4000-8000-${index
                  .toString(16)
                  .padStart(12, "0")}`
              )
            }
  };
}

function admitted(
  source: readonly PriorityPolicyAdmissionCandidate[],
  scope = { ownerId: OWNER_ID, mailboxId: MAILBOX_ID }
): readonly PriorityPolicyAdmissionCandidate[] {
  return admitPriorityPolicyCandidates({
    scope,
    candidates: source,
    context: {
      policyVersion: "1.0",
      evaluatedAt: EVALUATED_AT,
      parameters: { futureSkewTolerance: "PT5M" }
    },
    delivery: { candidateLimit: 100 }
  });
}

function evaluatorInput(
  value: PriorityPolicyAdmissionCandidate
): PriorityPolicyEvaluatorInput {
  return {
    scope: value.scope,
    candidate: value as PriorityPolicyEvaluatorInput["candidate"],
    context: {
      policyVersion: "1.0",
      evaluatedAt: EVALUATED_AT,
      evidenceSnapshotId: identifier<EvidenceSnapshotId>(
        "70000000-0000-4000-8000-000000000001"
      ),
      parameters: {
        identity: identifier<ApprovedParameterIdentity>(
          "80000000-0000-4000-8000-000000000001"
        ),
        futureSkewTolerance: "PT5M"
      }
    }
  };
}

function ordered(
  source: readonly PriorityPolicyAdmissionCandidate[],
  scope = { ownerId: OWNER_ID, mailboxId: MAILBOX_ID }
): readonly PriorityPolicyOrderedEvaluatedCandidate[] {
  const population = admitted(source, scope);
  const evaluations = population.map((value) => {
    const evaluation = evaluatePriorityPolicy(evaluatorInput(value));
    if (evaluation.kind !== "EVALUATED") {
      throw new Error("Expected an evaluated fixture.");
    }
    return { scope, evaluation };
  });

  return orderPriorityPolicyCandidates({
    scope,
    admittedCandidates: population,
    evaluations,
    context: {
      policyVersion: "1.0",
      evaluatedAt: EVALUATED_AT,
      parameters: { futureSkewTolerance: "PT5M" }
    }
  });
}

function input(
  orderedCandidates: readonly PriorityPolicyOrderedEvaluatedCandidate[],
  overrides: {
    readonly scope?: { readonly ownerId: OwnerId; readonly mailboxId: MailboxId };
    readonly evaluatedAt?: CanonicalTimestamp;
    readonly coverage?: "READY" | "PARTIAL";
    readonly returnedCandidateCount?: number;
    readonly continuationAvailable?: boolean;
  } = {}
): PriorityPolicyCollectionEvaluationInput {
  return {
    scope: overrides.scope ?? { ownerId: OWNER_ID, mailboxId: MAILBOX_ID },
    orderedCandidates,
    context: {
      policyVersion: "1.0",
      evaluatedAt: overrides.evaluatedAt ?? EVALUATED_AT
    },
    synchronization: { coverage: overrides.coverage ?? "READY" },
    delivery: {
      returnedCandidateCount:
        overrides.returnedCandidateCount ?? orderedCandidates.length,
      continuationAvailable: overrides.continuationAvailable ?? false
    }
  };
}

function expectInvalid(value: unknown): void {
  expect(() =>
    createPriorityPolicyCollectionEvaluation(
      value as PriorityPolicyCollectionEvaluationInput
    )
  ).toThrow(
    new TypeError("Invalid Priority Policy collection evaluation input.")
  );
}

function expectDeepFrozen(value: unknown): void {
  if (value !== null && typeof value === "object") {
    expect(Object.isFrozen(value)).toBe(true);
    for (const nested of Object.values(value)) {
      expectDeepFrozen(nested);
    }
  }
}

describe("PPV1 collection evaluation construction", () => {
  it.each([
    ["READY", 0],
    ["PARTIAL", 0],
    ["READY", 1],
    ["READY", 100]
  ] as const)(
    "constructs a %s collection with %i evaluated candidates",
    (coverage, count) => {
      const result = createPriorityPolicyCollectionEvaluation(
        input(
          ordered(
            Array.from({ length: count }, (_, index) => candidate(index + 1))
          ),
          { coverage }
        )
      );

      expect(result.synchronization.coverage).toBe(coverage);
      expect(result.delivery).toEqual({
        state: "COMPLETE",
        evaluatedCandidateCount: count,
        returnedCandidateCount: count,
        continuationAvailable: false
      });
      expect(result.candidates).toHaveLength(count);
    }
  );

  it("emits the exact constitutional field and candidate-scope shapes", () => {
    const result = createPriorityPolicyCollectionEvaluation(input(ordered([])));

    expect(Object.keys(result)).toEqual([
      "policyVersion",
      "evaluatedAt",
      "validThrough",
      "staleRetentionThrough",
      "candidateScope",
      "synchronization",
      "evidenceCompleteness",
      "delivery",
      "ordering",
      "candidates"
    ]);
    expect(result.candidateScope).toEqual({
      entityType: "THREAD",
      ownerScope: "AUTHENTICATED_OWNER",
      mailboxScope: "REQUESTED_MAILBOX",
      locationKnowledge: "VERIFIED",
      requiredPresentLocations: ["INBOX"],
      requiredAbsentLocations: ["SPAM", "TRASH"],
      additionalLocationMembership: "DOES_NOT_DISQUALIFY",
      temporalLookback: "UNBOUNDED",
      candidateCountLimit: "UNBOUNDED"
    });
    expect(JSON.stringify(result)).not.toContain(OWNER_ID);
    expect(JSON.stringify(result)).not.toContain(MAILBOX_ID);
  });

  it("projects only canonical evaluated outcomes for every operative reason shape", () => {
    const result = createPriorityPolicyCollectionEvaluation(
      input(
        ordered([
          candidate(1),
          candidate(2, { providerStar: "VERIFIED_PRESENT" }),
          candidate(3, { correction: "PRIORITIZE" }),
          candidate(4, {
            correction: "PRIORITIZE",
            providerStar: "VERIFIED_PRESENT"
          }),
          candidate(5, { correction: "NOT_IMPORTANT" }),
          candidate(6, {
            correction: "NOT_IMPORTANT",
            providerStar: "VERIFIED_PRESENT"
          })
        ])
      )
    );

    expect(result.candidates.map(({ tier }) => tier)).toEqual([
      "NEEDS_ATTENTION",
      "NEEDS_ATTENTION",
      "REVIEW_LATER",
      "NO_IMMEDIATE_SIGNALS",
      "NO_IMMEDIATE_SIGNALS",
      "NO_IMMEDIATE_SIGNALS"
    ]);
    expect(
      result.candidates.map(({ reasonCodes, reasonRoles }) => ({
        reasonCodes,
        reasonRoles
      }))
    ).toEqual([
      {
        reasonCodes: ["USER_PRIORITIZE"],
        reasonRoles: ["DETERMINING"]
      },
      {
        reasonCodes: ["USER_PRIORITIZE", "PROVIDER_STAR"],
        reasonRoles: ["DETERMINING", "SUPPORTING"]
      },
      {
        reasonCodes: ["PROVIDER_STAR"],
        reasonRoles: ["DETERMINING"]
      },
      { reasonCodes: [], reasonRoles: [] },
      {
        reasonCodes: ["USER_NOT_IMPORTANT"],
        reasonRoles: ["DETERMINING"]
      },
      {
        reasonCodes: ["USER_NOT_IMPORTANT", "PROVIDER_STAR"],
        reasonRoles: ["DETERMINING", "SUPPORTING"]
      }
    ]);
    expect(
      result.candidates.every(
        (value) =>
          !("candidate" in value) &&
          !("providerBinding" in value) &&
          !("providerStar" in value) &&
          !("correction" in value)
      )
    ).toBe(true);
  });

  it("preserves policy identity, evaluatedAt, and exact validity boundaries", () => {
    const result = createPriorityPolicyCollectionEvaluation(input(ordered([])));

    expect(result.policyVersion).toBe("1.0");
    expect(result.evaluatedAt).toBe("2026-07-30T10:00:00.000Z");
    expect(result.validThrough).toBe("2026-07-30T10:05:00.000Z");
    expect(result.staleRetentionThrough).toBe(
      "2026-07-31T10:00:00.000Z"
    );
    expect(result.ordering).toEqual({ scheme: "PRIORITY_POLICY_V1" });
  });
});

describe("PPV1 collection evidence completeness", () => {
  it("reports COMPLETE for complete and empty evaluated populations", () => {
    for (const population of [ordered([]), ordered([candidate(1)])]) {
      expect(
        createPriorityPolicyCollectionEvaluation(input(population))
          .evidenceCompleteness
      ).toEqual({ state: "COMPLETE", incompleteEvidence: [] });
    }
  });

  it.each([
    ["CANDIDATE_TIMESTAMP", candidate(1, { timestamp: "UNKNOWN" })],
    ["POLICY_LABELS", candidate(1, { providerStar: "UNKNOWN" })],
    ["USER_CORRECTIONS", candidate(1, { correction: "UNKNOWN" })]
  ] as const)("reports %s for its operative Unknown evidence", (kind, value) => {
    expect(
      createPriorityPolicyCollectionEvaluation(input(ordered([value])))
        .evidenceCompleteness
    ).toEqual({
      state: "INCOMPLETE",
      incompleteEvidence: [{ kind, affectedCandidateCount: 1 }]
    });
  });

  it("treats excessive future skew as incomplete but keeps the inclusive tolerance boundary valid", () => {
    const result = createPriorityPolicyCollectionEvaluation(
      input(
        ordered([
          candidate(1, { timestamp: "2026-07-30T10:05:00.000Z" }),
          candidate(2, { timestamp: "2026-07-30T10:05:00.001Z" })
        ])
      )
    );

    expect(result.evidenceCompleteness).toEqual({
      state: "INCOMPLETE",
      incompleteEvidence: [
        { kind: "CANDIDATE_TIMESTAMP", affectedCandidateCount: 1 }
      ]
    });
  });

  it("aggregates affected candidates once per kind in canonical order", () => {
    const result = createPriorityPolicyCollectionEvaluation(
      input(
        ordered([
          candidate(1, {
            timestamp: "UNKNOWN",
            providerStar: "UNKNOWN",
            correction: "UNKNOWN"
          }),
          candidate(2, {
            timestamp: "UNKNOWN",
            providerStar: "UNKNOWN"
          }),
          candidate(3, { correction: "UNKNOWN" })
        ])
      )
    );

    expect(result.evidenceCompleteness).toEqual({
      state: "INCOMPLETE",
      incompleteEvidence: [
        { kind: "CANDIDATE_TIMESTAMP", affectedCandidateCount: 2 },
        { kind: "POLICY_LABELS", affectedCandidateCount: 2 },
        { kind: "USER_CORRECTIONS", affectedCandidateCount: 2 }
      ]
    });
  });

  it("derives completeness from the full evaluation, including undelivered entries", () => {
    const result = createPriorityPolicyCollectionEvaluation(
      input(
        ordered([
          candidate(1),
          candidate(2, { timestamp: "UNKNOWN" })
        ]),
        { returnedCandidateCount: 1, continuationAvailable: true }
      )
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.evidenceCompleteness).toEqual({
      state: "INCOMPLETE",
      incompleteEvidence: [
        { kind: "CANDIDATE_TIMESTAMP", affectedCandidateCount: 1 }
      ]
    });
  });
});

describe("PPV1 collection delivery", () => {
  it.each([
    [0, 0, false, "COMPLETE"],
    [3, 3, false, "COMPLETE"],
    [3, 2, true, "PARTIAL"],
    [3, 2, false, "PARTIAL"],
    [3, 0, true, "PARTIAL"],
    [3, 0, false, "PARTIAL"]
  ] as const)(
    "constructs evaluated=%i returned=%i continuation=%s as %s",
    (evaluatedCount, returnedCount, continuationAvailable, state) => {
      const result = createPriorityPolicyCollectionEvaluation(
        input(
          ordered(
            Array.from({ length: evaluatedCount }, (_, index) =>
              candidate(index + 1)
            )
          ),
          { returnedCandidateCount: returnedCount, continuationAvailable }
        )
      );

      expect(result.delivery).toEqual({
        state,
        evaluatedCandidateCount: evaluatedCount,
        returnedCandidateCount: returnedCount,
        continuationAvailable
      });
      expect(result.candidates).toHaveLength(returnedCount);
    }
  );

  it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1, 4])(
    "rejects invalid returned candidate count %s",
    (returnedCandidateCount) =>
      expectInvalid(
        input(ordered([candidate(1), candidate(2), candidate(3)]), {
          returnedCandidateCount
        })
      )
  );

  it("rejects continuation when delivery is complete", () => {
    expectInvalid(
      input(ordered([candidate(1)]), { continuationAvailable: true })
    );
  });
});

describe("PPV1 collection ordering certification and validation", () => {
  it("accepts canonical order without changing it", () => {
    const canonical = ordered([
      candidate(1, { timestamp: "2026-07-30T08:00:00.000Z" }),
      candidate(2, {
        timestamp: "UNKNOWN",
        providerStar: "VERIFIED_PRESENT"
      }),
      candidate(3, { correction: "PRIORITIZE" })
    ]);
    const before = canonical.map(({ candidate: value }) => value.threadId);
    const result = createPriorityPolicyCollectionEvaluation(input(canonical));

    expect(result.candidates.map(({ threadId: value }) => value)).toEqual(
      before
    );
  });

  it("rejects every canonical-precedence inversion without silently reordering", () => {
    const tier = ordered([
      candidate(1),
      candidate(2, { providerStar: "VERIFIED_PRESENT" })
    ]);
    const timestamp = ordered([
      candidate(3, { timestamp: "2026-07-30T08:00:00.000Z" }),
      candidate(4, { timestamp: "2026-07-30T09:00:00.000Z" })
    ]);
    const unknown = ordered([
      candidate(5, { timestamp: "UNKNOWN" }),
      candidate(6, { timestamp: "2026-07-30T09:00:00.000Z" })
    ]);
    const identity = ordered([
      candidate(8, { timestamp: "2026-07-30T09:00:00.000Z" }),
      candidate(7, { timestamp: "2026-07-30T09:00:00.000Z" })
    ]);

    for (const canonical of [tier, timestamp, unknown, identity]) {
      expectInvalid(input([...canonical].reverse()));
    }
  });

  it("rejects duplicate identities", () => {
    const [entry] = ordered([candidate(1)]);
    expectInvalid(input([entry!, entry!]));
  });

  it("rejects mixed owner and mailbox scope", () => {
    const ownerEntry = ordered([candidate(1)])[0]!;
    const otherOwner = ordered(
      [candidate(2, { ownerId: OTHER_OWNER_ID })],
      { ownerId: OTHER_OWNER_ID, mailboxId: MAILBOX_ID }
    )[0]!;
    const otherMailbox = ordered(
      [candidate(3, { mailboxId: OTHER_MAILBOX_ID })],
      { ownerId: OWNER_ID, mailboxId: OTHER_MAILBOX_ID }
    )[0]!;

    expectInvalid(input([ownerEntry, otherOwner]));
    expectInvalid(input([ownerEntry, otherMailbox]));
  });

  it("rejects candidate/evaluation identity, policy, and clock mismatches", () => {
    const [entry] = ordered([candidate(1)]);
    const base = entry!;
    const mismatches = [
      {
        candidate: base.candidate,
        evaluation: { ...base.evaluation, threadId: threadId(99) }
      },
      {
        candidate: base.candidate,
        evaluation: { ...base.evaluation, policyVersion: "2.0" }
      },
      {
        candidate: base.candidate,
        evaluation: {
          ...base.evaluation,
          evaluatedAt: "2026-07-30T10:00:00Z"
        }
      }
    ];

    for (const mismatch of mismatches) {
      expectInvalid(input([mismatch as PriorityPolicyOrderedEvaluatedCandidate]));
    }
  });

  it("rejects malformed top-level, context, synchronization, delivery, and evaluation values", () => {
    const valid = input(ordered([candidate(1)]));
    const malformedEvaluation = {
      ...valid.orderedCandidates[0]!,
      evaluation: {
        ...valid.orderedCandidates[0]!.evaluation,
        reasons: ["Not canonical."]
      }
    };

    for (const value of [
      null,
      [],
      {},
      { ...valid, scope: { ownerId: "owner", mailboxId: MAILBOX_ID } },
      { ...valid, context: { ...valid.context, policyVersion: "2.0" } },
      { ...valid, context: { ...valid.context, evaluatedAt: "invalid" } },
      { ...valid, synchronization: { coverage: "COMPLETE" } },
      { ...valid, delivery: { ...valid.delivery, continuationAvailable: "yes" } },
      { ...valid, orderedCandidates: [null] },
      {
        ...valid,
        orderedCandidates: [malformedEvaluation]
      }
    ]) {
      expectInvalid(value);
    }
  });

  it("rejects validity-boundary overflow", () => {
    expectInvalid(
      input([], {
        evaluatedAt: identifier<CanonicalTimestamp>(
          "9999-12-31T23:59:59.999Z"
        )
      })
    );
  });
});

describe("PPV1 collection determinism and immutability", () => {
  it("replays deeply and JSON-identically across fresh equivalent graphs", () => {
    const make = () =>
      input(
        ordered([
          candidate(1, { providerStar: "VERIFIED_PRESENT" }),
          candidate(2, { timestamp: "UNKNOWN" }),
          candidate(3, { correction: "PRIORITIZE" })
        ]),
        { returnedCandidateCount: 2, continuationAvailable: true }
      );
    const first = createPriorityPolicyCollectionEvaluation(make());
    const repeated = createPriorityPolicyCollectionEvaluation(make());

    expect(repeated).toEqual(first);
    expect(JSON.stringify(repeated)).toBe(JSON.stringify(first));
  });

  it("does not mutate inputs and returns a deeply frozen detached graph", () => {
    const orderedCandidates = ordered([
      candidate(1, { providerStar: "VERIFIED_PRESENT" }),
      candidate(2, { correction: "UNKNOWN" })
    ]);
    const source = input(orderedCandidates);
    const before = JSON.stringify(source);
    const result = createPriorityPolicyCollectionEvaluation(source);

    expect(JSON.stringify(source)).toBe(before);
    expect(result.candidates).not.toBe(orderedCandidates);
    expect(result.candidates[0]).not.toBe(orderedCandidates[0]);
    expectDeepFrozen(result);
  });

  it("is independent of ambient clock, randomness, environment, and network", () => {
    const clock = vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("Clock accessed.");
    });
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Randomness accessed.");
    });
    const environment = vi
      .spyOn(process, "env", "get")
      .mockImplementation(() => {
        throw new Error("Environment accessed.");
      });
    const network = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("Network accessed.");
    });

    try {
      expect(
        createPriorityPolicyCollectionEvaluation(input(ordered([])))
          .evaluatedAt
      ).toBe(EVALUATED_AT);
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

  it("exposes the intentional public type contract", () => {
    expectTypeOf<
      PriorityPolicyCollectionEvaluation["candidates"]
    >().toEqualTypeOf<readonly EvaluatedOutcome[]>();
    expectTypeOf(createPriorityPolicyCollectionEvaluation).returns.toEqualTypeOf<
      PriorityPolicyCollectionEvaluation
    >();
  });
});
