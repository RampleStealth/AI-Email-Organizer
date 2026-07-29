# Milestone 3: Deterministic Priority Policy MVP

**Status: Approved and constitutionally ready for implementation; not implemented.**

This milestone defines the approved minimum implementation slice for [Priority Policy v1](../product/priority-policy-v1.md). Priority Policy remains deterministic, application-owned, provider-neutral at its policy boundary, and non-AI. Gmail remains authoritative for Gmail mailbox state.

## Product outcome

A user can open a bounded Priority collection, understand the deterministic reason for each tier, apply `Prioritize` or `Not Important`, and use idempotent `Undo` without stale, cross-owner, or misleading confirmation.

## Included scope

- A pure deterministic Priority Policy evaluator with a caller-supplied, fixed `evaluatedAt`
- Only approved operative evidence; repository-available metadata is not automatically policy evidence
- Explicit `DETERMINING` and `SUPPORTING` reason roles governed by PPV1-017A through PPV1-019
- Bounded eligible candidate selection with admission ordering separate from final Priority Policy ordering
- A truthful collection envelope that independently reports scope, synchronization coverage, evidence completeness, delivery completeness, freshness, and provider availability
- Application-owned `Prioritize` and `Not Important` corrections
- Append-only correction history
- Idempotent `Undo`
- Direct evaluation over the current normalized state, without reusable evaluation caching
- Privacy-safe `priority_evaluation_runs` required in development and the pilot
- Accessibility, deterministic replay, concurrency, authorization, and stale-result tests

Supporting reasons must never be presented as tier-determining. Missing, malformed, failed, or unread evidence remains `Unknown`; it must not become verified absence.

Provider Star, Manual Star provenance, canonical reason wording, future-skew behavior, `threadId`, and Provider Binding semantics are owned exclusively by [Priority Policy v1](../product/priority-policy-v1.md). This milestone defines their implementation slice and does not restate or amend them.

## Candidate bound and ordering

The MVP evaluates up to the **100 most recent eligible Inbox threads available in the verified synchronized projection**. This is a bounded delivery and pilot scope, not a change to the Priority Policy v1 product-policy definition of eligibility.

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

- `thread_provider_bindings`
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

## Priority Policy foundation decisions

The four implementation-blocking decisions are complete:

| Ruling | Policy authority | Milestone consequence |
| --- | --- | --- |
| WSF-008 — Future-Skew Tolerance | PPV1-024 | Implement the approved fixed parameter and boundary tests. |
| WSF-009 — Manual Star Provider Mapping | PPV1-010A, PPV1-011, PPV1-011A | Normalize truthful Provider Star evidence; do not infer Manual Star. |
| WSF-010 — Canonical Reason Wording | PPV1-016 through PPV1-019 | Implement the canonical registry and reason roles without generated wording. |
| WSF-011 — Stable Application Thread Identity | PPV1-022 | Implement canonical `threadId` and durable Provider Bindings before corrections or replay. |

These rulings authorize implementation of the approved PPV1 foundation. They do not imply production release approval or approval of unrelated, non-operative future-policy TODOs.

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

1. Define shared executable contracts.
2. Define Provider Binding, correction, evaluation-run, parameter, and owner-scoped persistence migrations.
3. Implement the provider adapter's truthful normalized evidence contract.
4. Implement the pure evaluator with fixed-clock and canonical-registry tests.
5. Implement deterministic fixtures and replay verification.
6. Implement corrections, history, version matching, and idempotent `Undo`.
7. Expose minimal Priority APIs using application `threadId`.
8. Implement the product interface specification's Priority collection and correction controls.
9. Run concurrency, stale-result, migration, cross-owner, provider-evidence, replay, and accessibility tests.
10. Run a free 5–8 person pilot.
11. Reassess caching or bounded AI using measured evidence.

## Final implementation checklist

### Evaluator

- Implement a pure evaluator over canonical normalized inputs with caller-supplied `evaluatedAt`, `policyVersion` `1.0`, and `futureSkewTolerance = PT5M`.
- Implement PPV1 tier assignment, precedence, ordering, Provider Star handling, `Unknown`, canonical reasons, and `DETERMINING`/`SUPPORTING` roles without AI, scores, implicit clocks, or provider IDs.

### Contracts

- Define executable schemas for evaluator input/output, collection envelope, corrections, Undo, Provider Star state, canonical `threadId`, `reasonCode`, `reason`, reason role, `evaluatedAt`, and `policyVersion`.
- Reject malformed identity, unknown enum values, noncanonical reason wording, and mismatched parallel reason arrays.

### Persistence

- Add durable Provider Bindings, Priority corrections/history, evaluation runs, and policy-parameter identity with owner/mailbox constraints.
- Preserve immutable correction attachment, evaluation facts, Provider Binding transitions, idempotency identities, and permanent `threadId` non-reuse.

### Provider Adapter

- Map complete Gmail `STARRED` evidence into Provider Star verified present, verified absent, or `Unknown` under PPV1-011A.
- Preserve evidence completeness and snapshot identity; never infer Manual Star from labels, History, Filters, or metadata.

### Worker

- Make synchronization reuse canonical Provider Bindings and preserve `threadId` through projection deletion, rebuild, recovery, and reconnect.
- Trigger reevaluation after authoritative evidence, correction, synchronization, or binding changes, with idempotent processing.

### API

- Expose Priority evaluation, correction, and Undo operations using application `threadId`.
- Resolve provider locators only behind authenticated owner/mailbox authorization and return canonical policy fields without provider IDs or generated reason text.

### Web

- Consume the canonical Priority contract, key routes and state by application `threadId`, and render exact `tier`, `reason`, reason-role, collection-state, and timestamp values.
- Implement the already approved accessible correction, Undo, pending, confirmed, failed, stale, partial, empty, and `Unknown` states; introduce no new design semantics.

### Testing

- Add exhaustive rule, boundary, `Unknown`, reason-registry, correction, Undo, isolation, concurrency, accessibility, and provider-mapping tests.
- Add negative tests proving no AI authority, provenance inference, provider-ID identity, generated wording, cross-owner access, or supporting-as-determining presentation.

### Replay

- Add canonical fixtures containing fixed input snapshots, `evaluatedAt`, `policyVersion`, parameter identity, `threadId`, Provider Binding transition identity, corrections, and expected serialized output.
- Verify exact equality across repeated runs, input permutations, process instances, database order, provider order, pagination, and supported platforms.

### Migration

- Preserve every existing valid thread UUID as canonical `threadId` and backfill its scoped Provider Binding without semantic inference.
- Fail duplicate, malformed, cross-owner, cross-mailbox, and conflicting mappings safely; verify rollback, restart, idempotency, non-reuse, and projection-rebuild behavior.

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

No evaluator, Priority API, correction controls, Priority envelope, PPV1 evaluation-run schema, or PPV1 cache exists in the repository at the approval of this milestone. The implemented dependencies are documented in [Milestone 2](milestone-2-mailbox-workspace-and-commands.md). Product architectural constraints remain in [Product Architecture v1](product-architecture-v1.md), [Data and State Model v1](data-state-model-v1.md), and the [AI Email Organizer Interface Specification v1](../design/ai-email-organizer-interface-spec-v1.md).
