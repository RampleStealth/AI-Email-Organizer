import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  admitPriorityPolicyCandidates,
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
  type PriorityPolicyCandidateAdmissionInput,
  type PriorityPolicyCollectionOrderingInput,
  type PriorityPolicyEvaluatorInput,
  type PriorityPolicyOrderedEvaluatedCandidate,
  type PriorityPolicyScopedEvaluation,
  type PriorityTier,
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

function identifier<Value extends string>(value: string): Value {
  return value as Value;
}

function threadId(index: number): ThreadId {
  return identifier<ThreadId>(
    `30000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`
  );
}

function rawCandidate(
  index: number,
  options: {
    readonly ownerId?: OwnerId;
    readonly mailboxId?: MailboxId;
    readonly timestamp?: string | "UNKNOWN";
  } = {}
): PriorityPolicyAdmissionCandidate {
  const timestamp = options.timestamp ?? "2026-07-30T09:00:00.000Z";

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
    providerStar: { state: "VERIFIED_ABSENT" },
    correction: { state: "VERIFIED_ABSENT" }
  };
}

function admissionInput(
  candidates: readonly PriorityPolicyAdmissionCandidate[],
  scope: {
    readonly ownerId: OwnerId;
    readonly mailboxId: MailboxId;
  } = { ownerId: OWNER_ID, mailboxId: MAILBOX_ID }
): PriorityPolicyCandidateAdmissionInput {
  return {
    scope,
    candidates,
    context: {
      policyVersion: "1.0",
      evaluatedAt: EVALUATED_AT,
      parameters: { futureSkewTolerance: "PT5M" }
    },
    delivery: { candidateLimit: 100 }
  };
}

function admit(
  candidates: readonly PriorityPolicyAdmissionCandidate[],
  scope: {
    readonly ownerId: OwnerId;
    readonly mailboxId: MailboxId;
  } = { ownerId: OWNER_ID, mailboxId: MAILBOX_ID }
): readonly PriorityPolicyAdmissionCandidate[] {
  return admitPriorityPolicyCandidates(admissionInput(candidates, scope));
}

function reasonFields(tier: PriorityTier): Pick<
  EvaluatedOutcome,
  "reasonCodes" | "reasons" | "reasonRoles"
> {
  switch (tier) {
    case "NEEDS_ATTENTION":
      return {
        reasonCodes: ["USER_PRIORITIZE"],
        reasons: ["You prioritized this conversation."],
        reasonRoles: ["DETERMINING"]
      };
    case "REVIEW_LATER":
      return {
        reasonCodes: ["PROVIDER_STAR"],
        reasons: ["Starred in your email provider."],
        reasonRoles: ["DETERMINING"]
      };
    case "NO_IMMEDIATE_SIGNALS":
      return { reasonCodes: [], reasons: [], reasonRoles: [] };
  }
}

function evaluation(
  candidate: PriorityPolicyAdmissionCandidate,
  tier: PriorityTier = "NO_IMMEDIATE_SIGNALS",
  overrides: Partial<EvaluatedOutcome> = {}
): EvaluatedOutcome {
  return {
    kind: "EVALUATED",
    threadId: candidate.threadId,
    tier,
    ...reasonFields(tier),
    policyVersion: "1.0",
    evaluatedAt: EVALUATED_AT,
    ...overrides
  };
}

function scopedEvaluation(
  candidate: PriorityPolicyAdmissionCandidate,
  tier: PriorityTier = "NO_IMMEDIATE_SIGNALS",
  options: {
    readonly ownerId?: OwnerId;
    readonly mailboxId?: MailboxId;
    readonly evaluation?: EvaluatedOutcome;
  } = {}
): PriorityPolicyScopedEvaluation {
  return {
    scope: {
      ownerId: options.ownerId ?? OWNER_ID,
      mailboxId: options.mailboxId ?? MAILBOX_ID
    },
    evaluation: options.evaluation ?? evaluation(candidate, tier)
  };
}

function orderingInput(
  admittedCandidates: readonly PriorityPolicyAdmissionCandidate[],
  evaluations: readonly PriorityPolicyScopedEvaluation[] = admittedCandidates.map(
    (candidate) => scopedEvaluation(candidate)
  )
): PriorityPolicyCollectionOrderingInput {
  return {
    scope: { ownerId: OWNER_ID, mailboxId: MAILBOX_ID },
    admittedCandidates,
    evaluations,
    context: {
      policyVersion: "1.0",
      evaluatedAt: EVALUATED_AT,
      parameters: { futureSkewTolerance: "PT5M" }
    }
  };
}

function orderedIds(
  result: readonly PriorityPolicyOrderedEvaluatedCandidate[]
): readonly ThreadId[] {
  return result.map(({ candidate }) => candidate.threadId);
}

function allPermutations<Value>(values: readonly Value[]): readonly Value[][] {
  if (values.length <= 1) {
    return [[...values]];
  }

  return values.flatMap((value, index) =>
    allPermutations(values.filter((_, candidateIndex) => candidateIndex !== index)).map(
      (remaining) => [value, ...remaining]
    )
  );
}

function deepFreeze<Value>(value: Value): Value {
  if (value !== null && typeof value === "object") {
    for (const nested of Object.values(value)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}

describe("canonical evaluated collection ordering", () => {
  it.each([0, 1, 100])(
    "returns an immutable population containing %i candidates",
    (count) => {
      const candidates = admit(
        Array.from({ length: count }, (_, index) => rawCandidate(index + 1))
      );
      const result = orderPriorityPolicyCandidates(orderingInput(candidates));

      expect(result).toHaveLength(count);
      expect(Object.isFrozen(result)).toBe(true);
    }
  );

  it("applies the complete constitutional tier precedence", () => {
    const candidates = admit([
      rawCandidate(1),
      rawCandidate(2),
      rawCandidate(3)
    ]);
    const result = orderPriorityPolicyCandidates(
      orderingInput(candidates, [
        scopedEvaluation(candidates[0]!, "NO_IMMEDIATE_SIGNALS"),
        scopedEvaluation(candidates[1]!, "NEEDS_ATTENTION"),
        scopedEvaluation(candidates[2]!, "REVIEW_LATER")
      ])
    );

    expect(result.map(({ evaluation: outcome }) => outcome.tier)).toEqual([
      "NEEDS_ATTENTION",
      "REVIEW_LATER",
      "NO_IMMEDIATE_SIGNALS"
    ]);
  });

  it("orders usable timestamps newest first within a tier", () => {
    const candidates = admit([
      rawCandidate(1, { timestamp: "2026-07-30T08:00:00.000Z" }),
      rawCandidate(2, { timestamp: "2026-07-30T09:00:00.000Z" })
    ]);

    expect(
      orderedIds(orderPriorityPolicyCandidates(orderingInput(candidates)))
    ).toEqual([threadId(2), threadId(1)]);
  });

  it("places usable timestamps before normalized Unknown timestamps", () => {
    const candidates = admit([
      rawCandidate(1, { timestamp: "UNKNOWN" }),
      rawCandidate(2, { timestamp: "2026-07-30T07:00:00.000Z" })
    ]);

    expect(
      orderedIds(orderPriorityPolicyCandidates(orderingInput(candidates)))
    ).toEqual([threadId(2), threadId(1)]);
  });

  it.each([
    "2026-07-30T10:00:00.000Z",
    "2026-07-30T10:04:59.999Z",
    "2026-07-30T10:05:00.000Z"
  ])("uses evaluatedAt as the effective key for %s", (timestamp) => {
    const candidates = admit([
      rawCandidate(2, { timestamp }),
      rawCandidate(1, { timestamp: "2026-07-30T10:00:00.000Z" })
    ]);

    expect(
      orderedIds(orderPriorityPolicyCandidates(orderingInput(candidates)))
    ).toEqual([threadId(1), threadId(2)]);
  });

  it("treats a timestamp strictly beyond PT5M as temporal Unknown", () => {
    const candidates = admit([
      rawCandidate(1, { timestamp: "2026-07-30T10:05:00.001Z" }),
      rawCandidate(2, { timestamp: "2026-07-30T06:00:00.000Z" })
    ]);

    expect(
      orderedIds(orderPriorityPolicyCandidates(orderingInput(candidates)))
    ).toEqual([threadId(2), threadId(1)]);
  });

  it("uses canonical UUID byte order for equal effective timestamps", () => {
    const candidates = admit([
      rawCandidate(2, { timestamp: "2026-07-30T09:00:00.000Z" }),
      rawCandidate(1, { timestamp: "2026-07-30T09:00:00.000Z" })
    ]);

    expect(
      orderedIds(orderPriorityPolicyCandidates(orderingInput(candidates)))
    ).toEqual([threadId(1), threadId(2)]);
  });

  it("uses canonical UUID byte order when both timestamps are Unknown", () => {
    const candidates = admit([
      rawCandidate(2, { timestamp: "UNKNOWN" }),
      rawCandidate(1, { timestamp: "UNKNOWN" })
    ]);

    expect(
      orderedIds(orderPriorityPolicyCandidates(orderingInput(candidates)))
    ).toEqual([threadId(1), threadId(2)]);
  });

  it("compares earlier canonical UUID bytes without lexical or locale order", () => {
    const lower = {
      ...rawCandidate(1, { timestamp: "UNKNOWN" }),
      threadId: identifier<ThreadId>(
        "20000000-0000-4000-8000-000000000001"
      )
    };
    const higher = {
      ...rawCandidate(2, { timestamp: "UNKNOWN" }),
      threadId: identifier<ThreadId>(
        "30000000-0000-4000-8000-000000000001"
      )
    };
    const candidates = admit([higher, lower]);

    expect(
      orderedIds(orderPriorityPolicyCandidates(orderingInput(candidates)))
    ).toEqual([lower.threadId, higher.threadId]);
  });

  it("orders a usable left operand before an Unknown right operand", () => {
    const candidates = admit([
      rawCandidate(1, { timestamp: "UNKNOWN" }),
      rawCandidate(2, { timestamp: "2026-07-30T07:00:00.000Z" })
    ]);
    const reversed = [...candidates].reverse();

    expect(
      orderedIds(orderPriorityPolicyCandidates(orderingInput(reversed)))
    ).toEqual([threadId(2), threadId(1)]);
  });

  it("keeps tier precedence above timestamp precedence", () => {
    const candidates = admit([
      rawCandidate(1, { timestamp: "UNKNOWN" }),
      rawCandidate(2, { timestamp: "2026-07-30T10:00:00.000Z" })
    ]);
    const unknown = candidates.find(
      ({ threadId: id }) => id === threadId(1)
    )!;
    const timestamped = candidates.find(
      ({ threadId: id }) => id === threadId(2)
    )!;

    expect(
      orderedIds(
        orderPriorityPolicyCandidates(
          orderingInput(candidates, [
            scopedEvaluation(unknown, "NEEDS_ATTENTION"),
            scopedEvaluation(timestamped, "REVIEW_LATER")
          ])
        )
      )
    ).toEqual([threadId(1), threadId(2)]);
  });

  it("keeps timestamp precedence above UUID precedence", () => {
    const candidates = admit([
      rawCandidate(1, { timestamp: "2026-07-30T08:00:00.000Z" }),
      rawCandidate(2, { timestamp: "2026-07-30T09:00:00.000Z" })
    ]);

    expect(
      orderedIds(orderPriorityPolicyCandidates(orderingInput(candidates)))
    ).toEqual([threadId(2), threadId(1)]);
  });
});

describe("canonical collection validation", () => {
  const stableFailure = "Invalid Priority Policy collection ordering input.";

  function expectInvalid(input: unknown): void {
    expect(() =>
      orderPriorityPolicyCandidates(
        input as PriorityPolicyCollectionOrderingInput
      )
    ).toThrow(new TypeError(stableFailure));
  }

  it.each([null, undefined, [], "invalid", 7])(
    "rejects malformed top-level input %j",
    (value) => expectInvalid(value)
  );

  it("rejects missing required top-level records", () => {
    expectInvalid({});
    expectInvalid({ scope: {}, admittedCandidates: [], evaluations: [] });
  });

  it("rejects malformed owner and mailbox identities", () => {
    const valid = orderingInput([]);
    expectInvalid({ ...valid, scope: { ...valid.scope, ownerId: "owner" } });
    expectInvalid({ ...valid, scope: { ...valid.scope, mailboxId: "mailbox" } });
  });

  it("rejects unsupported policy context", () => {
    const valid = orderingInput([]);
    expectInvalid({
      ...valid,
      context: { ...valid.context, policyVersion: "2.0" }
    });
    expectInvalid({
      ...valid,
      context: { ...valid.context, evaluatedAt: "not-a-time" }
    });
    expectInvalid({
      ...valid,
      context: {
        ...valid.context,
        evaluatedAt: "2026-02-30T10:00:00.000Z"
      }
    });
    expectInvalid({
      ...valid,
      context: {
        ...valid.context,
        parameters: { futureSkewTolerance: "PT10M" }
      }
    });
  });

  it("rejects duplicate candidate identities", () => {
    const [candidate] = admit([rawCandidate(1)]);
    expectInvalid(
      orderingInput(
        [candidate!, candidate!],
        [scopedEvaluation(candidate!)]
      )
    );
  });

  it("rejects duplicate evaluation identities", () => {
    const [candidate] = admit([rawCandidate(1)]);
    const completed = scopedEvaluation(candidate!);
    expectInvalid(orderingInput([candidate!], [completed, completed]));
  });

  it("rejects missing and extra evaluations", () => {
    const candidates = admit([rawCandidate(1), rawCandidate(2)]);
    expectInvalid(
      orderingInput(candidates, [scopedEvaluation(candidates[0]!)])
    );
    expectInvalid(
      orderingInput([candidates[0]!], [
        scopedEvaluation(candidates[0]!),
        scopedEvaluation(candidates[1]!)
      ])
    );
  });

  it("rejects candidate and evaluation identity mismatch", () => {
    const candidates = admit([rawCandidate(1), rawCandidate(2)]);
    expectInvalid(
      orderingInput([candidates[0]!], [scopedEvaluation(candidates[1]!)])
    );
  });

  it("rejects mixed candidate owner and mailbox scope", () => {
    const [otherOwner] = admit(
      [rawCandidate(1, { ownerId: OTHER_OWNER_ID })],
      { ownerId: OTHER_OWNER_ID, mailboxId: MAILBOX_ID }
    );
    const [otherMailbox] = admit(
      [rawCandidate(2, { mailboxId: OTHER_MAILBOX_ID })],
      { ownerId: OWNER_ID, mailboxId: OTHER_MAILBOX_ID }
    );

    expectInvalid(
      orderingInput(
        [otherOwner!],
        [
          scopedEvaluation(otherOwner!, "NO_IMMEDIATE_SIGNALS", {
            ownerId: OTHER_OWNER_ID
          })
        ]
      )
    );
    expectInvalid(
      orderingInput(
        [otherMailbox!],
        [
          scopedEvaluation(otherMailbox!, "NO_IMMEDIATE_SIGNALS", {
            mailboxId: OTHER_MAILBOX_ID
          })
        ]
      )
    );
  });

  it("rejects mixed evaluation owner and mailbox scope", () => {
    const [candidate] = admit([rawCandidate(1)]);
    expectInvalid(
      orderingInput(
        [candidate!],
        [
          scopedEvaluation(candidate!, "NO_IMMEDIATE_SIGNALS", {
            ownerId: OTHER_OWNER_ID
          })
        ]
      )
    );
    expectInvalid(
      orderingInput(
        [candidate!],
        [
          scopedEvaluation(candidate!, "NO_IMMEDIATE_SIGNALS", {
            mailboxId: OTHER_MAILBOX_ID
          })
        ]
      )
    );
  });

  it("rejects mixed policy version and evaluatedAt", () => {
    const [candidate] = admit([rawCandidate(1)]);
    expectInvalid(
      orderingInput(
        [candidate!],
        [
          scopedEvaluation(candidate!, "NO_IMMEDIATE_SIGNALS", {
            evaluation: evaluation(candidate!, "NO_IMMEDIATE_SIGNALS", {
              policyVersion: "2.0" as "1.0"
            })
          })
        ]
      )
    );
    expectInvalid(
      orderingInput(
        [candidate!],
        [
          scopedEvaluation(candidate!, "NO_IMMEDIATE_SIGNALS", {
            evaluation: evaluation(candidate!, "NO_IMMEDIATE_SIGNALS", {
              evaluatedAt: identifier<CanonicalTimestamp>(
                "2026-07-30T10:00:01.000Z"
              )
            })
          })
        ]
      )
    );
  });

  it("rejects malformed candidate and evaluation identities", () => {
    const [candidate] = admit([rawCandidate(1)]);
    const malformedCandidate = deepFreeze({
      ...candidate!,
      threadId: "thread"
    }) as unknown as PriorityPolicyAdmissionCandidate;
    expectInvalid(
      orderingInput(
        [malformedCandidate],
        [scopedEvaluation(malformedCandidate)]
      )
    );
    expectInvalid(
      orderingInput(
        [candidate!],
        [
          scopedEvaluation(candidate!, "NO_IMMEDIATE_SIGNALS", {
            evaluation: evaluation(candidate!, "NO_IMMEDIATE_SIGNALS", {
              threadId: "thread" as ThreadId
            })
          })
        ]
      )
    );
  });

  it("rejects a malformed candidate timestamp", () => {
    const [candidate] = admit([rawCandidate(1)]);
    const malformed = deepFreeze({
      ...candidate!,
      candidateTimestamp: {
        state: "VERIFIED",
        value: "not-a-time",
        sourceMessageId: "message"
      }
    }) as unknown as PriorityPolicyAdmissionCandidate;
    expectInvalid(orderingInput([malformed], [scopedEvaluation(malformed)]));
  });

  it("rejects non-record and unsupported timestamp evidence", () => {
    const [candidate] = admit([rawCandidate(1)]);
    for (const candidateTimestamp of [null, { state: "FUTURE" }]) {
      const malformed = deepFreeze({
        ...candidate!,
        candidateTimestamp
      }) as unknown as PriorityPolicyAdmissionCandidate;
      expectInvalid(
        orderingInput([malformed], [scopedEvaluation(malformed)])
      );
    }
  });

  it("rejects malformed admitted evidence structures", () => {
    const [candidate] = admit([rawCandidate(1)]);
    const malformedCandidates = [
      { ...candidate!, providerBinding: { transitionId: "binding" } },
      { ...candidate!, providerStar: { state: "MAYBE" } },
      { ...candidate!, correction: null },
      { ...candidate!, correction: { state: "ACTIVE" } },
      {
        ...candidate!,
        location: {
          ...candidate!.location,
          inbox: { state: "VERIFIED_ABSENT" }
        }
      }
    ].map(
      (value) =>
        deepFreeze(value) as unknown as PriorityPolicyAdmissionCandidate
    );

    for (const malformed of malformedCandidates) {
      expectInvalid(
        orderingInput([malformed], [scopedEvaluation(malformed)])
      );
    }
  });

  it("accepts both active correction kinds as admitted snapshot structure", () => {
    const candidates = admit([
      {
        ...rawCandidate(1),
        correction: {
          state: "VERIFIED_ACTIVE",
          kind: "PRIORITIZE",
          transitionId: identifier<CorrectionTransitionId>(
            "60000000-0000-4000-8000-000000000001"
          )
        }
      },
      {
        ...rawCandidate(2),
        correction: {
          state: "VERIFIED_ACTIVE",
          kind: "NOT_IMPORTANT",
          transitionId: identifier<CorrectionTransitionId>(
            "60000000-0000-4000-8000-000000000002"
          )
        }
      }
    ]);

    expect(
      orderPriorityPolicyCandidates(orderingInput(candidates))
    ).toHaveLength(2);
  });

  it("rejects unsupported tiers and non-EVALUATED outcomes", () => {
    const [candidate] = admit([rawCandidate(1)]);
    expectInvalid(
      orderingInput(
        [candidate!],
        [
          scopedEvaluation(candidate!, "NO_IMMEDIATE_SIGNALS", {
            evaluation: evaluation(candidate!, "NO_IMMEDIATE_SIGNALS", {
              tier: "FUTURE_TIER" as PriorityTier
            })
          })
        ]
      )
    );
    expectInvalid(
      orderingInput(
        [candidate!],
        [
          {
            scope: { ownerId: OWNER_ID, mailboxId: MAILBOX_ID },
            evaluation: {
              kind: "UNKNOWN",
              threadId: candidate!.threadId,
              policyVersion: "1.0",
              evaluatedAt: EVALUATED_AT
            }
          } as unknown as PriorityPolicyScopedEvaluation
        ]
      )
    );
  });

  it("rejects malformed and misaligned reason arrays", () => {
    const [candidate] = admit([rawCandidate(1)]);
    expectInvalid(
      orderingInput(
        [candidate!],
        [
          scopedEvaluation(candidate!, "REVIEW_LATER", {
            evaluation: evaluation(candidate!, "REVIEW_LATER", {
              reasonCodes: ["PROVIDER_STAR"],
              reasons: [],
              reasonRoles: ["DETERMINING"]
            })
          })
        ]
      )
    );
    expectInvalid(
      orderingInput(
        [candidate!],
        [
          scopedEvaluation(candidate!, "REVIEW_LATER", {
            evaluation: {
              ...evaluation(candidate!, "REVIEW_LATER"),
              reasons: "Starred in your email provider."
            } as unknown as EvaluatedOutcome
          })
        ]
      )
    );
    for (const malformed of [
      {
        reasonCodes: ["UNAPPROVED"],
        reasons: ["Starred in your email provider."],
        reasonRoles: ["DETERMINING"]
      },
      {
        reasonCodes: ["PROVIDER_STAR"],
        reasons: ["Wrong wording."],
        reasonRoles: ["DETERMINING"]
      },
      {
        reasonCodes: ["PROVIDER_STAR"],
        reasons: ["Starred in your email provider."],
        reasonRoles: ["PRIMARY"]
      },
      {
        reasonCodes: ["PROVIDER_STAR", "PROVIDER_STAR"],
        reasons: [
          "Starred in your email provider.",
          "Starred in your email provider."
        ],
        reasonRoles: ["DETERMINING", "SUPPORTING"]
      }
    ]) {
      expectInvalid(
        orderingInput(
          [candidate!],
          [
            scopedEvaluation(candidate!, "REVIEW_LATER", {
              evaluation: {
                ...evaluation(candidate!, "REVIEW_LATER"),
                ...malformed
              } as unknown as EvaluatedOutcome
            })
          ]
        )
      );
    }
    for (const malformed of [
      { reasonCodes: "PROVIDER_STAR" },
      { reasonRoles: "DETERMINING" }
    ]) {
      expectInvalid(
        orderingInput(
          [candidate!],
          [
            scopedEvaluation(candidate!, "REVIEW_LATER", {
              evaluation: {
                ...evaluation(candidate!, "REVIEW_LATER"),
                ...malformed
              } as unknown as EvaluatedOutcome
            })
          ]
        )
      );
    }
  });

  it("rejects malformed scoped evaluation records", () => {
    const [candidate] = admit([rawCandidate(1)]);
    for (const malformed of [
      null,
      {},
      { scope: null, evaluation: evaluation(candidate!) },
      { scope: candidate!.scope, evaluation: null }
    ]) {
      expectInvalid(
        orderingInput(
          [candidate!],
          [malformed as unknown as PriorityPolicyScopedEvaluation]
        )
      );
    }
  });

  it("rejects forged or mutable non-admitted snapshots", () => {
    const forged = rawCandidate(1);
    expectInvalid(orderingInput([forged], [scopedEvaluation(forged)]));
    expectInvalid(
      orderingInput(
        [Object.freeze(rawCandidate(2))],
        [scopedEvaluation(Object.freeze(rawCandidate(2)))]
      )
    );
  });

  it("rejects populations above the admitted 100-candidate invariant", () => {
    const first = admit(
      Array.from({ length: 100 }, (_, index) => rawCandidate(index + 1))
    );
    const [last] = admit([rawCandidate(101)]);
    const candidates = [...first, last!];
    expectInvalid(orderingInput(candidates));
  });
});

describe("canonical collection determinism and immutability", () => {
  it("is independent of admitted and evaluation population permutations", () => {
    const candidates = admit([
      rawCandidate(1, { timestamp: "UNKNOWN" }),
      rawCandidate(2, { timestamp: "2026-07-30T09:00:00.000Z" }),
      rawCandidate(3, { timestamp: "2026-07-30T08:00:00.000Z" })
    ]);
    const byId = new Map(
      candidates.map((candidate) => [candidate.threadId, candidate])
    );
    const evaluations = [
      scopedEvaluation(byId.get(threadId(1))!, "NEEDS_ATTENTION"),
      scopedEvaluation(byId.get(threadId(2))!, "REVIEW_LATER"),
      scopedEvaluation(byId.get(threadId(3))!, "NO_IMMEDIATE_SIGNALS")
    ];

    for (const candidatePermutation of allPermutations(candidates)) {
      for (const evaluationPermutation of allPermutations(evaluations)) {
        expect(
          orderedIds(
            orderPriorityPolicyCandidates(
              orderingInput(candidatePermutation, evaluationPermutation)
            )
          )
        ).toEqual([threadId(1), threadId(2), threadId(3)]);
      }
    }
  });

  it.each([
    "provider response order",
    "database retrieval order",
    "asynchronous evaluation completion order"
  ])("does not depend on %s", () => {
    const candidates = admit([rawCandidate(2), rawCandidate(1)]);
    const evaluations = candidates.map((candidate) =>
      scopedEvaluation(candidate)
    );
    const forward = orderPriorityPolicyCandidates(
      orderingInput(candidates, evaluations)
    );
    const reverse = orderPriorityPolicyCandidates(
      orderingInput([...candidates].reverse(), [...evaluations].reverse())
    );

    expect(JSON.stringify(forward)).toBe(JSON.stringify(reverse));
  });

  it("replays bit-for-bit across repeated calls and fresh equivalent graphs", () => {
    const firstCandidates = admit([
      rawCandidate(2, { timestamp: "UNKNOWN" }),
      rawCandidate(1, { timestamp: "2026-07-30T09:00:00.000Z" })
    ]);
    const secondCandidates = admit([
      rawCandidate(2, { timestamp: "UNKNOWN" }),
      rawCandidate(1, { timestamp: "2026-07-30T09:00:00.000Z" })
    ]);

    const first = orderPriorityPolicyCandidates(
      orderingInput(firstCandidates)
    );
    const replay = orderPriorityPolicyCandidates(
      orderingInput(firstCandidates)
    );
    const fresh = orderPriorityPolicyCandidates(
      orderingInput(secondCandidates)
    );

    expect(JSON.stringify(first)).toBe(JSON.stringify(replay));
    expect(JSON.stringify(first)).toBe(JSON.stringify(fresh));
  });

  it("consults no ambient clock, randomness, locale, or I/O", () => {
    const [candidate] = admit([rawCandidate(1)]);
    const now = vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("clock consulted");
    });
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("randomness consulted");
    });
    const locale = vi
      .spyOn(String.prototype, "localeCompare")
      .mockImplementation(() => {
        throw new Error("locale comparator consulted");
      });

    try {
      expect(
        orderPriorityPolicyCandidates(orderingInput([candidate!]))
      ).toHaveLength(1);
      expect(now).not.toHaveBeenCalled();
      expect(random).not.toHaveBeenCalled();
      expect(locale).not.toHaveBeenCalled();
    } finally {
      now.mockRestore();
      random.mockRestore();
      locale.mockRestore();
    }
  });

  it("preserves exact membership without mutating or sorting caller arrays", () => {
    const candidates = admit([rawCandidate(2), rawCandidate(1)]);
    const candidateArray = [...candidates];
    const evaluations = candidateArray.map((candidate) =>
      scopedEvaluation(candidate)
    );
    const candidateBefore = [...candidateArray];
    const evaluationBefore = [...evaluations];
    const result = orderPriorityPolicyCandidates(
      orderingInput(candidateArray, evaluations)
    );

    expect(candidateArray).toEqual(candidateBefore);
    expect(evaluations).toEqual(evaluationBefore);
    expect(new Set(orderedIds(result))).toEqual(
      new Set(candidateArray.map(({ threadId: id }) => id))
    );
  });

  it("returns frozen entries with detached frozen evaluation outcomes", () => {
    const [candidate] = admit([rawCandidate(1)]);
    const sourceEvaluation = evaluation(candidate!, "REVIEW_LATER");
    const sourceCodes = sourceEvaluation.reasonCodes as string[];
    const sourceReasons = sourceEvaluation.reasons as string[];
    const sourceRoles = sourceEvaluation.reasonRoles as string[];
    const [result] = orderPriorityPolicyCandidates(
      orderingInput(
        [candidate!],
        [
          scopedEvaluation(candidate!, "REVIEW_LATER", {
            evaluation: sourceEvaluation
          })
        ]
      )
    );
    const serialized = JSON.stringify(result);

    expect(result?.candidate).toBe(candidate);
    expect(result?.evaluation).not.toBe(sourceEvaluation);
    expect(result?.evaluation.reasonCodes).not.toBe(sourceCodes);
    expect(result?.evaluation.reasons).not.toBe(sourceReasons);
    expect(result?.evaluation.reasonRoles).not.toBe(sourceRoles);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result?.evaluation)).toBe(true);
    expect(Object.isFrozen(result?.evaluation.reasonCodes)).toBe(true);
    expect(Object.isFrozen(result?.evaluation.reasons)).toBe(true);
    expect(Object.isFrozen(result?.evaluation.reasonRoles)).toBe(true);

    sourceCodes.push("RECENCY");
    sourceReasons.push("Received recently.");
    sourceRoles.push("SUPPORTING");
    expect(JSON.stringify(result)).toBe(serialized);
  });
});

describe("direct Priority Policy pipeline composition", () => {
  it("composes admission, evaluation, scoped binding, and ordering without reconstruction", () => {
    const admitted = admit([
      {
        ...rawCandidate(1, { timestamp: "UNKNOWN" }),
        correction: {
          state: "VERIFIED_ACTIVE",
          kind: "PRIORITIZE",
          transitionId: identifier<CorrectionTransitionId>(
            "60000000-0000-4000-8000-000000000001"
          )
        }
      },
      {
        ...rawCandidate(2, {
          timestamp: "2026-07-30T09:00:00.000Z"
        }),
        providerStar: { state: "VERIFIED_PRESENT" }
      }
    ]);
    const completed = admitted.map((candidate, index) => {
      const evaluatorInput: PriorityPolicyEvaluatorInput = {
        scope: candidate.scope,
        candidate:
          candidate as PriorityPolicyEvaluatorInput["candidate"],
        context: {
          policyVersion: "1.0",
          evaluatedAt: EVALUATED_AT,
          evidenceSnapshotId: identifier<EvidenceSnapshotId>(
            `70000000-0000-4000-8000-${(index + 1)
              .toString(16)
              .padStart(12, "0")}`
          ),
          parameters: {
            identity: identifier<ApprovedParameterIdentity>(
              "80000000-0000-4000-8000-000000000001"
            ),
            futureSkewTolerance: "PT5M"
          }
        }
      };
      const outcome = evaluatePriorityPolicy(evaluatorInput);
      expect(outcome.kind).toBe("EVALUATED");
      return {
        scope: evaluatorInput.scope,
        evaluation: outcome
      } as PriorityPolicyScopedEvaluation;
    });

    const ordered = orderPriorityPolicyCandidates(
      orderingInput(admitted, completed)
    );

    expectTypeOf(ordered).toEqualTypeOf<
      readonly PriorityPolicyOrderedEvaluatedCandidate[]
    >();
    expect(ordered.map(({ evaluation: outcome }) => outcome.tier)).toEqual([
      "NEEDS_ATTENTION",
      "REVIEW_LATER"
    ]);
    expect(ordered[0]?.candidate).toBe(
      admitted.find(({ threadId: id }) => id === threadId(1))
    );
    expect(ordered[1]?.candidate).toBe(
      admitted.find(({ threadId: id }) => id === threadId(2))
    );
  });
});
