import type {
  ApplicationMessageId,
  ApprovedParameterIdentity,
  CanonicalTimestamp,
  EvidenceSnapshotId,
  MailboxId,
  OwnerId,
  PriorityPolicyAdmissionCandidate,
  PriorityPolicyReplayFixture,
  ProviderBindingTransitionId,
  ThreadId
} from "../../src/index.js";

function identity<Value extends string>(value: string): Value {
  return value as Value;
}

export const REPLAY_OWNER_ID = identity<OwnerId>(
  "10000000-0000-4000-8000-000000000001"
);
export const REPLAY_MAILBOX_ID = identity<MailboxId>(
  "20000000-0000-4000-8000-000000000001"
);
export const REPLAY_EVALUATED_AT = identity<CanonicalTimestamp>(
  "2026-07-30T10:00:00.000Z"
);

const EMPTY_SERIALIZATION =
  '{"policyVersion":"1.0","evaluatedAt":"2026-07-30T10:00:00.000Z","validThrough":"2026-07-30T10:05:00.000Z","staleRetentionThrough":"2026-07-31T10:00:00.000Z","candidateScope":{"entityType":"THREAD","ownerScope":"AUTHENTICATED_OWNER","mailboxScope":"REQUESTED_MAILBOX","locationKnowledge":"VERIFIED","requiredPresentLocations":["INBOX"],"requiredAbsentLocations":["SPAM","TRASH"],"additionalLocationMembership":"DOES_NOT_DISQUALIFY","temporalLookback":"UNBOUNDED","candidateCountLimit":"UNBOUNDED"},"synchronization":{"coverage":"READY"},"evidenceCompleteness":{"state":"COMPLETE","incompleteEvidence":[]},"delivery":{"state":"COMPLETE","evaluatedCandidateCount":0,"returnedCandidateCount":0,"continuationAvailable":false},"ordering":{"scheme":"PRIORITY_POLICY_V1"},"candidates":[]}';

const REPRESENTATIVE_SERIALIZATION =
  '{"policyVersion":"1.0","evaluatedAt":"2026-07-30T10:00:00.000Z","validThrough":"2026-07-30T10:05:00.000Z","staleRetentionThrough":"2026-07-31T10:00:00.000Z","candidateScope":{"entityType":"THREAD","ownerScope":"AUTHENTICATED_OWNER","mailboxScope":"REQUESTED_MAILBOX","locationKnowledge":"VERIFIED","requiredPresentLocations":["INBOX"],"requiredAbsentLocations":["SPAM","TRASH"],"additionalLocationMembership":"DOES_NOT_DISQUALIFY","temporalLookback":"UNBOUNDED","candidateCountLimit":"UNBOUNDED"},"synchronization":{"coverage":"READY"},"evidenceCompleteness":{"state":"COMPLETE","incompleteEvidence":[]},"delivery":{"state":"COMPLETE","evaluatedCandidateCount":1,"returnedCandidateCount":1,"continuationAvailable":false},"ordering":{"scheme":"PRIORITY_POLICY_V1"},"candidates":[{"kind":"EVALUATED","threadId":"30000000-0000-4000-8000-000000000001","tier":"REVIEW_LATER","reasonCodes":["PROVIDER_STAR"],"reasons":["Starred in your email provider."],"reasonRoles":["DETERMINING"],"policyVersion":"1.0","evaluatedAt":"2026-07-30T10:00:00.000Z"}]}';

function input(candidates: readonly PriorityPolicyAdmissionCandidate[]) {
  return Object.freeze({
    scope: Object.freeze({
      ownerId: REPLAY_OWNER_ID,
      mailboxId: REPLAY_MAILBOX_ID
    }),
    candidates: Object.freeze(candidates),
    context: Object.freeze({
      policyVersion: "1.0" as const,
      evaluatedAt: REPLAY_EVALUATED_AT,
      evidenceSnapshotId: identity<EvidenceSnapshotId>(
        "canonical-evidence-snapshot"
      ),
      parameters: Object.freeze({
        identity: identity<ApprovedParameterIdentity>(
          "canonical-parameter-identity"
        ),
        futureSkewTolerance: "PT5M" as const
      })
    }),
    synchronization: Object.freeze({ coverage: "READY" as const }),
    delivery: Object.freeze({
      returnedCandidateCount: candidates.length,
      continuationAvailable: false
    })
  });
}

const representativeCandidate = Object.freeze({
  scope: Object.freeze({
    ownerId: REPLAY_OWNER_ID,
    mailboxId: REPLAY_MAILBOX_ID
  }),
  threadId: identity<ThreadId>(
    "30000000-0000-4000-8000-000000000001"
  ),
  providerBinding: Object.freeze({
    transitionId: identity<ProviderBindingTransitionId>(
      "50000000-0000-4000-8000-000000000001"
    )
  }),
  location: Object.freeze({
    inbox: Object.freeze({ state: "VERIFIED_PRESENT" as const }),
    spam: Object.freeze({ state: "VERIFIED_ABSENT" as const }),
    trash: Object.freeze({ state: "VERIFIED_ABSENT" as const })
  }),
  candidateTimestamp: Object.freeze({
    state: "VERIFIED" as const,
    value: identity<CanonicalTimestamp>("2026-07-30T09:00:00.000Z"),
    sourceMessageId: identity<ApplicationMessageId>(
      "40000000-0000-4000-8000-000000000001"
    )
  }),
  providerStar: Object.freeze({ state: "VERIFIED_PRESENT" as const }),
  correction: Object.freeze({ state: "VERIFIED_ABSENT" as const })
});

export const PRIORITY_POLICY_V1_EMPTY_REPLAY_FIXTURE =
  Object.freeze<PriorityPolicyReplayFixture>({
    input: input([]),
    expectedSerializedOutput: EMPTY_SERIALIZATION
  });

export const PRIORITY_POLICY_V1_REPRESENTATIVE_REPLAY_FIXTURE =
  Object.freeze<PriorityPolicyReplayFixture>({
    input: input([representativeCandidate]),
    expectedSerializedOutput: REPRESENTATIVE_SERIALIZATION
  });

export const PRIORITY_POLICY_V1_REPLAY_FIXTURES = Object.freeze([
  PRIORITY_POLICY_V1_EMPTY_REPLAY_FIXTURE,
  PRIORITY_POLICY_V1_REPRESENTATIVE_REPLAY_FIXTURE
] as const);
