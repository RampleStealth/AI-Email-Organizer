# Project roadmap

This roadmap separates repository-supported implementation, the approved next milestone, deferred target-state work, launch-only hardening, and unresolved decisions. It does not replace the canonical policy or architecture documents.

## Milestone sequence

| Milestone | Status | Outcome and boundary |
| --- | --- | --- |
| [Milestone 1 — Gmail connection and synchronization](milestone-1-gmail-sync.md) | Complete historical milestone | Secure read-only Gmail connection, bounded metadata synchronization, notifications, checkpoints, reconciliation, and connection health. Its document preserves the original scope rather than describing the whole current product. |
| [Milestone 2 — Mailbox workspace and provider command foundation](milestone-2-mailbox-workspace-and-commands.md) | Implemented foundation | Gmail-authoritative views and thread reading, application-created drafts, explicit write upgrade, durable provider commands, accessible command state, authorization, observability, and recovery. No Priority Policy execution is claimed. |
| [Milestone 3 — Deterministic Priority Policy MVP](milestone-3-priority-policy-mvp.md) | Constitutionally complete; ready for implementation | A bounded, truthful Priority collection with direct deterministic evaluation, determining/supporting reasons, application-owned corrections, idempotent Undo, and a small pilot. Generative AI, semantic search, and reusable evaluation caching are excluded. |
| Milestone 4 — Bounded AI assistance | Planned after MVP evidence | Consider narrowly bounded assistance only after deterministic-policy and pilot evidence. Any AI feature remains separate from Priority Policy tiers, reasons, and authority. |
| Milestone 5 — Advanced retrieval and performance | Deferred until measured need | Consider semantic or hybrid retrieval, reusable/distributed evaluation caching, invalidation generations, collision verification, and other scale machinery only when measurements justify them. The target-state constraints remain in force while implementation is deferred. |
| Milestone 6 — Production hardening and launch gates | Future | Complete production governance, external-service integrations, operational verification, retention approvals, launch review, and other release gates. Existing security and recovery controls remain implemented foundation; this milestone covers the additional evidence and governance required to launch. |

## Current, next, deferred, and launch-only work

### Implemented foundation

Milestones 1 and 2 are supported by the current API, worker, web, Gmail adapter, migrations, repositories, and tests. Gmail is authoritative for Gmail state. Existing Redis use supports queues, OAuth state, rate limiting, and bounded sanitized reader caching; it is not a Priority Policy evaluation cache.

### Ready for implementation

Milestone 3 is the active next milestone. Its four constitutional blockers are retired by WSF-008 through WSF-011 and recorded exclusively in [Priority Policy v1](../product/priority-policy-v1.md). The MVP evaluates directly over current normalized state and adds only the Provider Binding, correction, correction-history, evaluation-run, and policy-parameter persistence described in its milestone document.

### Deferred target-state work

The canonical architecture describes advanced invalidation, immutable reusable evaluations, cache lifecycle, collision verification, retention, and production-scale verification. Deferring these mechanisms from the MVP does not remove their constraints or authorize an incompatible shortcut. Milestone 3 must leave a safe migration path to that target state.

### Launch-only hardening

Production launch governance—including final retention/deletion approvals, production-scale PPV1 verification, external monitoring/alert delivery, operational evidence, consent/scope requirements, and release gates—belongs to Milestone 6 unless a prerequisite is needed earlier for safe development or the pilot. “Future” does not mean existing security controls can be postponed.

## Decision status

The Priority Policy MVP foundation is complete:

- WSF-008 — Future-Skew Tolerance: approved in PPV1-024.
- WSF-009 — Manual Star Provider Mapping: approved in PPV1-010A and PPV1-011A.
- WSF-010 — Canonical Reason Wording: approved in PPV1-017A.
- WSF-011 — Stable Application Thread Identity: approved in PPV1-022.

Other non-operative future-policy and launch decisions remain tracked by their authoritative documents. They do not block implementation of the approved Milestone 3 scope and must not be silently settled by implementation.

## Canonical sources

- [Priority Policy v1](../product/priority-policy-v1.md) — policy authority and deterministic/non-AI boundary
- [Product Architecture v1](product-architecture-v1.md) — current system evidence and proposed PPV1 integration
- [Data and State Model v1](data-state-model-v1.md) — current persistence and proposed PPV1 model
- [AI Email Organizer Interface Specification v1](../design/ai-email-organizer-interface-spec-v1.md) — product presentation, accessibility implementation, and truthful-state contracts

When this roadmap and a canonical source differ, the canonical source governs its domain. A milestone narrows delivery scope; it does not change Priority Policy meaning.
