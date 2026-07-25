# Milestone 3: Deterministic Priority Policy MVP

**Status: Approved next milestone; not implemented.**

This milestone defines the approved minimum implementation slice for [Priority Policy v1](../product/priority-policy-v1.md). Priority Policy remains deterministic, application-owned, provider-neutral at its policy boundary, and non-AI. Gmail remains authoritative for Gmail mailbox state.

## Product outcome

A user can open a bounded Priority collection, understand the deterministic reason for each tier, apply `Prioritize` or `Not Important`, and use idempotent `Undo` without stale, cross-owner, or misleading confirmation.

## Included scope

- A pure deterministic Priority Policy evaluator with a caller-supplied, fixed `evaluatedAt`
- Only approved operative evidence; repository-available metadata is not automatically policy evidence
- Explicit `TIER_DETERMINING` and `SUPPORTING` reason roles
- Bounded eligible candidate selection with admission ordering separate from final Priority Policy ordering
- A truthful collection envelope that independently reports scope, synchronization coverage, evidence completeness, delivery completeness, freshness, and provider availability
- Application-owned `Prioritize` and `Not Important` corrections
- Append-only correction history
- Idempotent `Undo`
- Direct evaluation over the current normalized state, without reusable evaluation caching
- Privacy-safe `priority_evaluation_runs` required in development and the pilot
- Accessibility, deterministic replay, concurrency, authorization, and stale-result tests

Supporting reasons must never be presented as tier-determining. Missing, malformed, failed, or unread evidence remains `Unknown`; it must not become verified absence.

## Candidate bound and ordering

The MVP evaluates up to the **100 most recent eligible Inbox threads available in the verified synchronized projection**. This is a bounded delivery and pilot scope, not a change to the Priority Policy v1 constitutional definition of eligibility.

Candidate admission order is:

1. Verified incoming timestamp descending
2. Candidates with `Unknown` timestamps after candidates with verified timestamps
3. Stable application `threadId` as the final tie-breaker

Admission ordering selects the bounded input set. The evaluator then applies the final Priority Policy ordering required by the canonical policy. The UI must disclose the 100-candidate bound and the verified projection scope. It must not claim that the entire mailbox was evaluated.

## Corrections and confirmation

Corrections are application-owned policy inputs; they do not mutate Gmail labels.

- A correction transition and its append-only history record commit atomically.
- The operation records the committed correction version or another stable transition identity.
- Final correction success is presented only after reevaluation observes that same committed version or transition and returns its corresponding deterministic tier.
- A timeout, failed lookup, or ambiguous read is an observation failure. It is not authoritative evidence that no correction exists.
- Repeating `Undo` against the same already-undone correction creates no additional policy effect or duplicate success history.

## Minimal MVP persistence

Add only:

- `priority_corrections`
- `priority_correction_history`
- `priority_evaluation_runs`
- `priority_policy_parameters`

Owner/mailbox/thread scope, foreign keys, uniqueness, transition versioning, and authorization constraints must be executable in schemas and migrations. Do **not** add `priority_invalidation_generation` in the MVP.

### Evaluation-run records

`priority_evaluation_runs` is required for development and the pilot. Retention must be explicitly bounded.

It may store privacy-safe structural data such as:

- Evaluation identity
- Policy version
- Approved parameter identity
- `evaluatedAt`
- Candidate count
- Tier and reason codes/roles
- Correction version/state
- Scope, coverage, evidence, delivery, freshness, and provider states
- Duration
- Deterministic input/output fingerprints

It must not store:

- Message bodies
- Subjects
- Snippets
- Addresses
- Tokens
- Raw provider identifiers

## Four lightweight blocking decisions

Record these before schemas or evaluator behavior are finalized:

1. The exact PPV1-024 future-skew tolerance
2. The minimum Gmail provider mapping for Manual Star
3. Canonical wording and localization keys for the MVP reason subset
4. Practical application-thread identity behavior across normal synchronization and projection rebuild

For this project, Founder approval means recording:

- Decision
- Rationale
- Effective policy version
- Approval name
- Approval date
- Commit

No additional ceremony is required. The decision record must not imply approval of unrelated policy TODOs or a production release.

## Deferred from the MVP

- Generative AI
- AI Insight
- AI summaries
- Semantic or hybrid search
- Reusable or distributed evaluation cache
- Cache collision verifier
- `priority_invalidation_generation`
- Advanced personalization
- Production-scale PPV1 runtime verification

Direct evaluation is the MVP design. The advanced validity, invalidation, stale-retention, and cache machinery in the canonical target-state architecture remains authoritative target-state work; deferral does not weaken or redefine it.

## Build order

1. Record the four blocking decisions.
2. Define executable schemas, migrations, and owner-scoped constraints.
3. Implement the pure evaluator with fixed-clock tests.
4. Implement corrections, history, version matching, and idempotent `Undo`.
5. Expose minimal Priority APIs.
6. Implement the WDS Priority collection and correction controls.
7. Run concurrency, stale-result, cross-owner, and accessibility tests.
8. Run a free 5–8 person pilot.
9. Reassess caching or bounded AI using measured evidence.

## MVP exit criteria

- Identical canonical inputs, fixed clock, policy version, and approved parameters replay deterministically.
- No cross-owner or cross-mailbox access is possible.
- Correction success never appears before a matching reevaluation.
- `Unknown` never becomes verified absence.
- Supporting reasons never appear tier-determining.
- The bounded candidate scope is disclosed truthfully.
- Keyboard and screen-reader users can complete correction and `Undo`.
- Pilot participants can distinguish determining from supporting reasons.

These criteria authorize an MVP/pilot completion claim only. Production hardening and launch gates remain a later milestone.

## Current implementation boundary

No evaluator, Priority API, correction controls, Priority envelope, PPV1 evaluation-run schema, or PPV1 cache exists in the repository at the approval of this milestone. The implemented dependencies are documented in [Milestone 2](milestone-2-mailbox-workspace-and-commands.md). Canonical architectural constraints remain in [Product Architecture v1](product-architecture-v1.md), [Data and State Model v1](data-state-model-v1.md), and [Wong Design System v1](../design/wong-design-system-v1.md).
