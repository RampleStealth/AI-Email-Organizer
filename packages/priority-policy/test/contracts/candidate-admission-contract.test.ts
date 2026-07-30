import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  admitPriorityPolicyCandidates,
  type ApplicationMessageId,
  type ApprovedParameterIdentity,
  type CanonicalTimestamp,
  type CorrectionEvidence,
  type CorrectionTransitionId,
  evaluatePriorityPolicy,
  type EvidenceSnapshotId,
  type MailboxId,
  type OwnerId,
  type PriorityPolicyCandidateAdmissionInput,
  type PriorityPolicyEvaluatorInput,
  type ProviderBindingTransitionId,
  type ProviderStarEvidence,
  type ThreadId
} from "@aio/priority-policy";

const OWNER_ID = asIdentifier<OwnerId>(
  "10000000-0000-4000-8000-000000000001"
);
const MAILBOX_ID = asIdentifier<MailboxId>(
  "20000000-0000-4000-8000-000000000002"
);
const EVALUATED_AT = asIdentifier<CanonicalTimestamp>(
  "2026-07-29T10:00:00.000Z"
);
const ELIGIBLE_LOCATION = {
  inbox: { state: "VERIFIED_PRESENT" },
  spam: { state: "VERIFIED_ABSENT" },
  trash: { state: "VERIFIED_ABSENT" }
} as const;

function asIdentifier<T extends string>(value: string): T {
  return value as T;
}

function threadId(index: number): ThreadId {
  return asIdentifier<ThreadId>(
    `30000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`
  );
}

function candidate(
  index: number,
  options: {
    readonly ownerId?: OwnerId;
    readonly mailboxId?: MailboxId;
    readonly timestamp?: string | "UNKNOWN";
    readonly providerStar?: ProviderStarEvidence;
    readonly correction?: CorrectionEvidence;
    readonly providerBindingTransitionId?: ProviderBindingTransitionId;
  } = {}
): PriorityPolicyCandidateAdmissionInput["candidates"][number] {
  const timestamp = options.timestamp ?? "2026-07-29T09:00:00.000Z";

  return {
    scope: {
      ownerId: options.ownerId ?? OWNER_ID,
      mailboxId: options.mailboxId ?? MAILBOX_ID
    },
    threadId: threadId(index),
    providerBinding: {
      transitionId:
        options.providerBindingTransitionId ??
        asIdentifier<ProviderBindingTransitionId>(
          `50000000-0000-4000-8000-${index
            .toString(16)
            .padStart(12, "0")}`
        )
    },
    location: ELIGIBLE_LOCATION,
    candidateTimestamp:
      timestamp === "UNKNOWN"
        ? { state: "UNKNOWN" }
        : {
            state: "VERIFIED",
            value: asIdentifier<CanonicalTimestamp>(timestamp),
            sourceMessageId: asIdentifier<ApplicationMessageId>(
              `40000000-0000-4000-8000-${index
                .toString(16)
                .padStart(12, "0")}`
            )
          },
    providerStar: options.providerStar ?? { state: "VERIFIED_ABSENT" },
    correction: options.correction ?? { state: "VERIFIED_ABSENT" }
  };
}

function input(
  candidates: PriorityPolicyCandidateAdmissionInput["candidates"]
): PriorityPolicyCandidateAdmissionInput {
  return {
    scope: {
      ownerId: OWNER_ID,
      mailboxId: MAILBOX_ID
    },
    candidates,
    context: {
      policyVersion: "1.0",
      evaluatedAt: EVALUATED_AT,
      parameters: {
        futureSkewTolerance: "PT5M"
      }
    },
    delivery: {
      candidateLimit: 100
    }
  };
}

function range(count: number): readonly number[] {
  return Array.from({ length: count }, (_, index) => index + 1);
}

function admittedThreadIds(
  candidates: ReturnType<typeof admitPriorityPolicyCandidates>
): readonly ThreadId[] {
  return candidates.map(({ threadId: admittedThreadId }) => admittedThreadId);
}

describe("deterministic candidate admission population boundaries", () => {
  it.each([0, 1, 99, 100, 101, 257])(
    "admits the constitutional bounded population from %i candidates",
    (count) => {
      const result = admitPriorityPolicyCandidates(
        input(range(count).map((index) => candidate(index)))
      );

      expect(result).toHaveLength(Math.min(count, 100));
      expect(Object.isFrozen(result)).toBe(true);
    }
  );
});

describe("deterministic candidate admission temporal evidence", () => {
  it("orders past timestamps newest first", () => {
    const result = admitPriorityPolicyCandidates(
      input([
        candidate(1, { timestamp: "2026-07-29T08:00:00.000Z" }),
        candidate(2, { timestamp: "2026-07-29T09:00:00.000Z" })
      ])
    );

    expect(admittedThreadIds(result)).toEqual([threadId(2), threadId(1)]);
  });

  it("keeps a timestamp equal to evaluatedAt usable", () => {
    const result = admitPriorityPolicyCandidates(
      input([
        candidate(1, { timestamp: "2026-07-29T09:59:59.999Z" }),
        candidate(2, { timestamp: "2026-07-29T10:00:00.000Z" })
      ])
    );

    expect(admittedThreadIds(result)).toEqual([threadId(2), threadId(1)]);
  });

  it.each([
    "2026-07-29T10:00:00.001Z",
    "2026-07-29T10:04:59.999Z",
    "2026-07-29T10:05:00.000Z"
  ])("clamps the usable future timestamp %s to evaluatedAt", (timestamp) => {
    const result = admitPriorityPolicyCandidates(
      input([
        candidate(2, { timestamp }),
        candidate(1, { timestamp: "2026-07-29T10:00:00.000Z" })
      ])
    );

    expect(admittedThreadIds(result)).toEqual([threadId(1), threadId(2)]);
  });

  it("classifies a timestamp strictly beyond PT5M as Unknown", () => {
    const result = admitPriorityPolicyCandidates(
      input([
        candidate(1, { timestamp: "2026-07-29T10:05:00.001Z" }),
        candidate(2, { timestamp: "2026-07-29T08:00:00.000Z" })
      ])
    );

    expect(admittedThreadIds(result)).toEqual([threadId(2), threadId(1)]);
  });

  it("places normalized Unknown temporal evidence after usable evidence", () => {
    const result = admitPriorityPolicyCandidates(
      input([
        candidate(1, { timestamp: "UNKNOWN" }),
        candidate(2, { timestamp: "2026-07-28T00:00:00.000Z" })
      ])
    );

    expect(admittedThreadIds(result)).toEqual([threadId(2), threadId(1)]);
  });
});

describe("deterministic candidate admission ordering and membership", () => {
  it("uses canonical application threadId byte order for final ties", () => {
    const result = admitPriorityPolicyCandidates(
      input([
        candidate(16, { timestamp: "UNKNOWN" }),
        candidate(15, { timestamp: "UNKNOWN" })
      ])
    );

    expect(admittedThreadIds(result)).toEqual([threadId(15), threadId(16)]);
  });

  it("does not admit according to an attached provider identifier", () => {
    const first = {
      ...candidate(1, { timestamp: "UNKNOWN" }),
      providerThreadId: "z-provider-thread"
    };
    const second = {
      ...candidate(2, { timestamp: "UNKNOWN" }),
      providerThreadId: "a-provider-thread"
    };

    const result = admitPriorityPolicyCandidates(input([second, first]));

    expect(admittedThreadIds(result)).toEqual([threadId(1), threadId(2)]);
    expect(result).not.toHaveProperty("providerThreadId");
    expect(result[0]).not.toHaveProperty("providerThreadId");
  });

  it("makes selected membership and output order independent of input permutation", () => {
    const ascending = range(101).map((index) =>
      candidate(index, { timestamp: "UNKNOWN" })
    );
    const descending = [...ascending].reverse();

    const first = admitPriorityPolicyCandidates(input(ascending));
    const second = admitPriorityPolicyCandidates(input(descending));

    expect(first).toEqual(second);
    expect(admittedThreadIds(first)).toEqual(range(100).map(threadId));
    expect(first).not.toContain(ascending[100]);
  });
});

describe("deterministic candidate admission identity and scope failures", () => {
  it.each([
    ["null input", null],
    ["primitive input", "not-an-input"],
    ["missing input structure", {}],
    ["null scope", { ...input([]), scope: null }],
    ["null context", { ...input([]), context: null }],
    ["null delivery", { ...input([]), delivery: null }],
    ["non-array candidates", { ...input([]), candidates: {} }],
    [
      "malformed input owner",
      {
        ...input([]),
        scope: { ...input([]).scope, ownerId: "not-a-uuid" }
      }
    ],
    [
      "malformed input mailbox",
      {
        ...input([]),
        scope: { ...input([]).scope, mailboxId: "not-a-uuid" }
      }
    ],
    [
      "unsupported policy version",
      {
        ...input([]),
        context: { ...input([]).context, policyVersion: "2.0" }
      }
    ],
    [
      "malformed evaluatedAt",
      {
        ...input([]),
        context: { ...input([]).context, evaluatedAt: "2026-07-29T10:00:00Z" }
      }
    ],
    [
      "impossible evaluatedAt",
      {
        ...input([]),
        context: {
          ...input([]).context,
          evaluatedAt: "2026-02-30T10:00:00.000Z"
        }
      }
    ],
    [
      "null parameters",
      {
        ...input([]),
        context: { ...input([]).context, parameters: null }
      }
    ],
    ["null candidate", { ...input([]), candidates: [null] }],
    [
      "null candidate scope",
      { ...input([]), candidates: [{ ...candidate(1), scope: null }] }
    ],
    [
      "null timestamp evidence",
      {
        ...input([]),
        candidates: [{ ...candidate(1), candidateTimestamp: null }]
      }
    ],
    [
      "malformed verified timestamp",
      {
        ...input([]),
        candidates: [
          {
            ...candidate(1),
            candidateTimestamp: {
              state: "VERIFIED",
              value: "2026-07-29T09:00:00Z",
              sourceMessageId: "40000000-0000-4000-8000-000000000001"
            }
          }
        ]
      }
    ],
    [
      "malformed timestamp source identity",
      {
        ...input([]),
        candidates: [
          {
            ...candidate(1),
            candidateTimestamp: {
              state: "VERIFIED",
              value: "2026-07-29T09:00:00.000Z",
              sourceMessageId: "not-a-uuid"
            }
          }
        ]
      }
    ]
  ])("rejects malformed runtime structure: %s", (_name, malformed) => {
    expect(() =>
      admitPriorityPolicyCandidates(
        malformed as PriorityPolicyCandidateAdmissionInput
      )
    ).toThrow(TypeError);
  });

  it("rejects an ineligible candidate instead of redefining eligibility", () => {
    const ineligible = {
      ...candidate(1),
      location: {
        ...ELIGIBLE_LOCATION,
        inbox: { state: "VERIFIED_ABSENT" }
      }
    } as unknown as PriorityPolicyCandidateAdmissionInput["candidates"][number];

    expect(() =>
      admitPriorityPolicyCandidates(input([ineligible]))
    ).toThrow(TypeError);
  });

  it("rejects duplicate application thread identities without choosing a winner", () => {
    expect(() =>
      admitPriorityPolicyCandidates(input([candidate(1), candidate(1)]))
    ).toThrow(TypeError);
  });

  it("rejects a candidate from another owner", () => {
    const otherOwner = asIdentifier<OwnerId>(
      "10000000-0000-4000-8000-000000000099"
    );

    expect(() =>
      admitPriorityPolicyCandidates(
        input([candidate(1, { ownerId: otherOwner })])
      )
    ).toThrow(TypeError);
  });

  it("rejects a candidate from another mailbox", () => {
    const otherMailbox = asIdentifier<MailboxId>(
      "20000000-0000-4000-8000-000000000099"
    );

    expect(() =>
      admitPriorityPolicyCandidates(
        input([candidate(1, { mailboxId: otherMailbox })])
      )
    ).toThrow(TypeError);
  });

  it.each([
    ["threadId", { ...candidate(1), threadId: "not-a-uuid" }],
    [
      "ownerId",
      {
        ...candidate(1),
        scope: { ...candidate(1).scope, ownerId: "not-a-uuid" }
      }
    ],
    [
      "mailboxId",
      {
        ...candidate(1),
        scope: { ...candidate(1).scope, mailboxId: "not-a-uuid" }
      }
    ]
  ])("rejects malformed %s identity input", (_name, malformed) => {
    expect(() =>
      admitPriorityPolicyCandidates(
        input([
          malformed as PriorityPolicyCandidateAdmissionInput["candidates"][number]
        ])
      )
    ).toThrow(TypeError);
  });

  it.each([
    [
      "location enum",
      {
        ...candidate(1),
        location: {
          ...ELIGIBLE_LOCATION,
          inbox: { state: "FUTURE_MEMBERSHIP_STATE" }
        }
      }
    ],
    [
      "timestamp enum",
      {
        ...candidate(1),
        candidateTimestamp: { state: "FUTURE_TIMESTAMP_STATE" }
      }
    ],
    [
      "future-skew parameter",
      {
        ...input([candidate(1)]),
        context: {
          ...input([candidate(1)]).context,
          parameters: {
            ...input([candidate(1)]).context.parameters,
            futureSkewTolerance: "PT10M"
          }
        }
      }
    ],
    [
      "candidate admission limit",
      {
        ...input([candidate(1)]),
        delivery: {
          candidateLimit: 101
        }
      }
    ]
  ])("rejects an unknown or future %s", (kind, value) => {
    const malformedInput =
      kind === "location enum" || kind === "timestamp enum"
        ? input([
            value as PriorityPolicyCandidateAdmissionInput["candidates"][number]
          ])
        : (value as PriorityPolicyCandidateAdmissionInput);

    expect(() => admitPriorityPolicyCandidates(malformedInput)).toThrow(
      TypeError
    );
  });
});

describe("deterministic candidate admission snapshot preservation", () => {
  it("returns the complete admitted normalized candidate snapshot", () => {
    const source = candidate(1, {
      providerStar: { state: "VERIFIED_PRESENT" },
      correction: {
        state: "VERIFIED_ACTIVE",
        kind: "PRIORITIZE",
        transitionId: asIdentifier<CorrectionTransitionId>(
          "60000000-0000-4000-8000-000000000001"
        )
      }
    });

    const [admitted] = admitPriorityPolicyCandidates(input([source]));

    expect(admitted).toEqual(source);
    expect(admitted).not.toBe(source);
    expect(admitted?.scope).toEqual(source.scope);
    expect(admitted?.threadId).toBe(source.threadId);
    expect(admitted?.providerBinding).toEqual(source.providerBinding);
    expect(admitted?.location).toEqual(source.location);
    expect(admitted?.candidateTimestamp).toEqual(source.candidateTimestamp);
    expect(admitted?.providerStar).toEqual(source.providerStar);
    expect(admitted?.correction).toEqual(source.correction);
  });

  it("excludes candidate 101 as a complete object", () => {
    const source = range(101).map((index) =>
      candidate(index, { timestamp: "UNKNOWN" })
    );
    const result = admitPriorityPolicyCandidates(input(source));

    expect(result).toHaveLength(100);
    expect(result.some(({ threadId: id }) => id === threadId(101))).toBe(false);
    expect(result).not.toContain(source[100]);
  });

  it("flows directly into the evaluator without lookup or reconstruction", () => {
    const [admitted] = admitPriorityPolicyCandidates(
      input([
        candidate(1, {
          providerStar: { state: "VERIFIED_PRESENT" },
          correction: { state: "VERIFIED_ABSENT" }
        })
      ])
    );

    expect(admitted).toBeDefined();
    expectTypeOf(admitted!).toMatchTypeOf<
      PriorityPolicyEvaluatorInput["candidate"]
    >();

    const evaluatorInput: PriorityPolicyEvaluatorInput = {
      scope: admitted!.scope,
      candidate: admitted!,
      context: {
        policyVersion: "1.0",
        evaluatedAt: EVALUATED_AT,
        evidenceSnapshotId: asIdentifier<EvidenceSnapshotId>(
          "70000000-0000-4000-8000-000000000001"
        ),
        parameters: {
          identity: asIdentifier<ApprovedParameterIdentity>(
            "80000000-0000-4000-8000-000000000001"
          ),
          futureSkewTolerance: "PT5M"
        }
      }
    };

    expect(evaluatePriorityPolicy(evaluatorInput)).toMatchObject({
      kind: "EVALUATED",
      threadId: threadId(1),
      tier: "REVIEW_LATER",
      reasonCodes: ["PROVIDER_STAR"]
    });
  });
});

describe("deterministic candidate admission evidence non-influence", () => {
  it("does not use Provider Star, corrections, or Provider Binding for membership or order", () => {
    const baseline = [
      candidate(2, { timestamp: "UNKNOWN" }),
      candidate(1, { timestamp: "UNKNOWN" })
    ];
    const changed = [
      candidate(2, {
        timestamp: "UNKNOWN",
        providerStar: { state: "VERIFIED_PRESENT" },
        correction: {
          state: "VERIFIED_ACTIVE",
          kind: "NOT_IMPORTANT",
          transitionId: asIdentifier<CorrectionTransitionId>(
            "60000000-0000-4000-8000-000000000002"
          )
        },
        providerBindingTransitionId:
          asIdentifier<ProviderBindingTransitionId>(
            "50000000-0000-4000-8000-000000000099"
          )
      }),
      candidate(1, {
        timestamp: "UNKNOWN",
        providerStar: { state: "UNKNOWN" },
        correction: { state: "UNKNOWN" },
        providerBindingTransitionId:
          asIdentifier<ProviderBindingTransitionId>(
            "50000000-0000-4000-8000-000000000098"
          )
      })
    ];

    const baselineResult = admitPriorityPolicyCandidates(input(baseline));
    const changedResult = admitPriorityPolicyCandidates(input(changed));

    expect(admittedThreadIds(changedResult)).toEqual(
      admittedThreadIds(baselineResult)
    );
    expect(admittedThreadIds(changedResult)).toEqual([
      threadId(1),
      threadId(2)
    ]);
    expect(changedResult[0]?.providerStar).toEqual({ state: "UNKNOWN" });
    expect(changedResult[1]?.correction).toMatchObject({
      state: "VERIFIED_ACTIVE",
      kind: "NOT_IMPORTANT"
    });
  });
});

describe("deterministic candidate admission trust and replay", () => {
  it("does not mutate source candidates or rewrite provider timestamps", () => {
    const source = [
      candidate(1, { timestamp: "2026-07-29T10:04:00.000Z" }),
      candidate(2, { timestamp: "UNKNOWN" })
    ];
    const before = JSON.stringify(source);

    admitPriorityPolicyCandidates(input(source));

    expect(JSON.stringify(source)).toBe(before);
    expect(source[0]?.candidateTimestamp).toEqual({
      state: "VERIFIED",
      value: "2026-07-29T10:04:00.000Z",
      sourceMessageId: "40000000-0000-4000-8000-000000000001"
    });
  });

  it("returns a collection that cannot mutate the source input", () => {
    const source = [candidate(1)];
    const result = admitPriorityPolicyCandidates(input(source));

    expect(() => {
      (
        result as PriorityPolicyCandidateAdmissionInput["candidates"][number][]
      ).push(candidate(2));
    }).toThrow(TypeError);
    expect(source).toHaveLength(1);
    expect(source[0]?.threadId).toBe(threadId(1));
  });

  it("returns detached deeply frozen normalized candidate snapshots", () => {
    const source = [
      candidate(1, {
        providerStar: { state: "VERIFIED_PRESENT" },
        correction: {
          state: "VERIFIED_ACTIVE",
          kind: "PRIORITIZE",
          transitionId: asIdentifier<CorrectionTransitionId>(
            "60000000-0000-4000-8000-000000000001"
          )
        }
      })
    ];
    const [admitted] = admitPriorityPolicyCandidates(input(source));
    const serialized = JSON.stringify(admitted);

    expect(admitted).not.toBe(source[0]);
    expect(admitted?.scope).not.toBe(source[0]?.scope);
    expect(admitted?.providerBinding).not.toBe(source[0]?.providerBinding);
    expect(admitted?.location).not.toBe(source[0]?.location);
    expect(admitted?.location.inbox).not.toBe(source[0]?.location.inbox);
    expect(admitted?.candidateTimestamp).not.toBe(
      source[0]?.candidateTimestamp
    );
    expect(admitted?.providerStar).not.toBe(source[0]?.providerStar);
    expect(admitted?.correction).not.toBe(source[0]?.correction);

    expect(Object.isFrozen(admitted)).toBe(true);
    expect(Object.isFrozen(admitted?.scope)).toBe(true);
    expect(Object.isFrozen(admitted?.providerBinding)).toBe(true);
    expect(Object.isFrozen(admitted?.location)).toBe(true);
    expect(Object.isFrozen(admitted?.location.inbox)).toBe(true);
    expect(Object.isFrozen(admitted?.location.spam)).toBe(true);
    expect(Object.isFrozen(admitted?.location.trash)).toBe(true);
    expect(Object.isFrozen(admitted?.candidateTimestamp)).toBe(true);
    expect(Object.isFrozen(admitted?.providerStar)).toBe(true);
    expect(Object.isFrozen(admitted?.correction)).toBe(true);

    expect(Object.isFrozen(source[0])).toBe(false);
    expect(Object.isFrozen(source[0]?.scope)).toBe(false);
    expect(Object.isFrozen(source[0]?.providerBinding)).toBe(false);
    expect(Object.isFrozen(source[0]?.location)).toBe(false);
    expect(Object.isFrozen(source[0]?.candidateTimestamp)).toBe(false);
    expect(Object.isFrozen(source[0]?.providerStar)).toBe(false);
    expect(Object.isFrozen(source[0]?.correction)).toBe(false);

    (
      source[0]!.providerStar as { state: ProviderStarEvidence["state"] }
    ).state = "UNKNOWN";
    (
      source[0]!.scope as {
        ownerId: OwnerId;
        mailboxId: MailboxId;
      }
    ).ownerId = asIdentifier<OwnerId>(
      "10000000-0000-4000-8000-000000000099"
    );
    (
      source[0]!.candidateTimestamp as {
        state: "VERIFIED";
        value: CanonicalTimestamp;
        sourceMessageId: ApplicationMessageId;
      }
    ).value = asIdentifier<CanonicalTimestamp>(
      "2026-07-29T08:00:00.000Z"
    );

    expect(JSON.stringify(admitted)).toBe(serialized);
    expect(() => {
      (
        admitted!.providerStar as {
          state: ProviderStarEvidence["state"];
        }
      ).state = "UNKNOWN";
    }).toThrow(TypeError);
  });

  it("does not consult the ambient system clock", () => {
    const now = vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("ambient clock consulted");
    });

    try {
      expect(
        admittedThreadIds(
          admitPriorityPolicyCandidates(input([candidate(1)]))
        )
      ).toEqual([threadId(1)]);
      expect(now).not.toHaveBeenCalled();
    } finally {
      now.mockRestore();
    }
  });

  it("replays bit-for-bit and idempotently for identical canonical inputs", () => {
    const canonicalInput = input([
      candidate(3, { timestamp: "UNKNOWN" }),
      candidate(2, { timestamp: "2026-07-29T10:06:00.000Z" }),
      candidate(1, { timestamp: "2026-07-29T09:00:00.000Z" })
    ]);

    const first = admitPriorityPolicyCandidates(canonicalInput);
    const second = admitPriorityPolicyCandidates(canonicalInput);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first).toEqual(second);
  });
});
