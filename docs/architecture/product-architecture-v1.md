# Product Architecture v1

## Document control and status

| Field | Value |
| --- | --- |
| Status | Evaluation baseline; current implementation plus clearly marked proposed design |
| Version | 1.0 |
| Scope | AI Email Organizer monorepo and Priority Policy v1 integration boundary |
| Product-policy source | [Priority Policy v1 and Attention Contract v1](../product/priority-policy-v1.md) |

## Purpose and architectural scope

This document describes what the repository implements today and the architecture required to integrate the approved Priority Policy v1 (PPV1) without changing its product-policy meaning. It is not an implementation authorization for policy TODOs. The companion documents are the [AI Email Organizer Interface Specification v1](../design/ai-email-organizer-interface-spec-v1.md) and [Data and State Model v1](data-state-model-v1.md).

## Product and system context

AI Email Organizer connects a Gmail mailbox through OAuth, keeps a local normalized metadata projection, and provides a web mailbox workspace, thread reading, drafts, and selected Gmail commands. Gmail is authoritative for remote mailbox state. PostgreSQL is the durable local projection and workflow record; Redis/BullMQ transports and schedules work. The README explicitly says the product stores metadata and encrypted token references, while Gmail remains source of truth.

Current milestone evidence spans Gmail synchronization, mailbox workspace/thread reading, and draft/write capability work. The repository contains no Priority Policy evaluator, policy API, correction API, `priority_*` migration, collection-envelope contract, or evaluation cache. Therefore all PPV1 execution, correction, and cache architecture below is **Proposed architecture** unless identified as an existing integration mechanism.

## Architectural principles

- Gmail/provider state is authoritative; local state is a normalized, recoverable projection, not a competing mailbox.
- Every access path is authenticated-owner and mailbox scoped. A provider identifier is never sufficient authorization.
- Provider notifications are triggers, not truth; reconciliation and Gmail reads establish truth.
- Commands are durable, encrypted-payload, idempotent workflows with authoritative provider confirmation.
- PPV1 is deterministic and non-AI. AI Insight, if later approved, is a separate feature and must never attach confidence to a Priority Policy tier.
- Approved product-policy requirements constrain future implementation; they do not imply code already exists.

## Monorepo structure and major components

| Area | Current responsibility |
| --- | --- |
| `apps/api` | Fastify API, cookie session/OAuth, Gmail webhook, mailbox and command routes |
| `apps/worker` | BullMQ consumers, synchronization, provider command execution, schedulers/heartbeats |
| `apps/web` | React mailbox workspace, reader, drafts, command polling, accessible baseline styles |
| `packages/database` | PostgreSQL migrations, transaction helpers, projection/sync/command repositories |
| `packages/gmail` | Gmail adapters and deterministic metadata normalization |
| `packages/contracts` | Zod contracts for jobs, commands, metadata projection, display/search |
| `packages/security` | encryption, scoped cryptographic derivations, command payload validation |
| `packages/jobs` | BullMQ queue adapters/job construction |
| `packages/observability` | redacted telemetry, metrics and health model |

## Existing boundaries

### API, worker, jobs, database, Redis/cache, and provider

The API validates browser requests and persists commands/outbox rows. The worker claims outbox work, queues it in BullMQ/Redis, claims commands with leases, and calls Gmail only after an owner-scoped mailbox lookup/decryption boundary. PostgreSQL transactions couple projection writes with history-checkpoint advancement. Redis currently supports queues, one-time OAuth state, rate limiting, and bounded sanitized reader caching; it is **not** a PPV1 evaluation cache.

Gmail webhook JWT validation records a maximum pending history ID and enqueues sync. The sync worker serializes mailbox work with a PostgreSQL advisory lock, establishes a fresh baseline for initial/recovery sync, applies Gmail changes, then advances `applied_history_id` in the same transaction. Periodic reconciliation handles missed notifications; watch renewal cannot advance checkpoints. A 404 history gap schedules scoped recovery.

### Authentication, authorization, and isolation

Cookie sessions are signed, HttpOnly, `SameSite=Lax`, Secure in production, backed by revocable hashed database tokens. State-changing browser operations require CSRF and exact origin checks. OAuth uses state plus PKCE; webhooks verify Google JWT audience and service account. Repository queries bind mailbox IDs to the authenticated user before access to credentials/provider data. The database further scopes `threads` through `mailbox_accounts.user_id` and makes provider thread identity unique per mailbox.

### Command lifecycle

Archive and mark-unread create an encrypted, versioned provider command with a mailbox-scoped idempotency key and an outbox event. Workers claim with a lease, retry deterministic exponential backoff up to eight attempts, and record immutable attempts. UI polling waits for terminal status before showing confirmation. Gmail is re-read/reconciled after command execution; the existing command types do not include PPV1 corrections or Undo.

**Proposed architecture:** Prioritize, Not Important, correction changes, and Undo shall be application-owned correction commands, not Gmail-label mutations. Their durable transition and resulting PPV1-031 invalidation event must commit atomically; only authoritative persistence confirmation may show success.

## Priority Policy evaluation integration (proposed)

The evaluator consumes owner/mailbox-scoped normalized metadata only: verified current location, provider-verifiable incoming direction/timestamp, Provider Star state, and authoritative correction state. It produces the PPV1 `tier`, ordered determining and supporting reasons, `policyVersion`, approved-parameter identity, fixed `evaluatedAt`, validity boundaries, candidate scope, and collection envelope. PPV1-001 through PPV1-035 exclusively own those semantics; architecture owns their isolation and execution boundaries.

F01 is resolved exclusively by PPV1-012 and PPV1-016 through PPV1-019. The architecture must preserve ordered reason codes, canonical reasons, and explicit determining/supporting roles without reinterpreting them.

F02 is resolved exclusively by WSF-008 and PPV1-024. The architecture must transport the approved policy parameter, fixed `evaluatedAt`, original provider timestamp, temporal-evidence state, and disclosure facts without defining another tolerance.

WSF-009 and PPV1-010A/011A own Provider Star and Manual Star semantics. The provider adapter maps Gmail evidence into the approved three-state Provider Star input; synchronization, architecture, or AI shall not infer Manual Star provenance.

WSF-011 and PPV1-022 own canonical thread identity. Architecture shall maintain durable owner/mailbox-scoped Provider Bindings separately from mutable thread projections. Evaluator, correction, replay, API, and UI boundaries use application `threadId`; provider IDs remain inside adapter and binding boundaries.

### PPV1-031 invalidation wiring (proposed)

Emit a durable, transactional `priority_evaluation.invalidate` outbox event whenever an authoritative normalized input can alter eligibility, tier, reasons, ordering, evidence completeness, collection coverage, or availability: projection/location/label change; verified direction/timestamp correction; correction activation/change/Undo; synchronization coverage change; provider disconnect/reauthorization; policy-version/approved-parameter change; or command reconciliation. The dispatcher must make a known-invalid evaluation immediately ineligible before physical eviction. This is not wired in current command or sync code (F07).

## Cache lifecycle (proposed)

No PPV1 cache exists today. A compliant cache entry must be immutable and use a collision-resistant, purpose-scoped keyed fingerprint over canonical inputs plus: authenticated owner ID, mailbox ID, policy version, approved parameter identity, candidate-scope identity, and evaluator/schema identity. It must not reuse entries across policy versions or parameter identities (F06).

- Read-time independently verifies authenticated owner and mailbox against durable scope (F05), even when cache key lookup succeeds.
- `CURRENT` is allowed only through inclusive `validThrough`; `STALE` only through inclusive `staleRetentionThrough` and only if no known PPV1-031 invalidation occurred.
- Retrieval never changes `evaluatedAt`; stale cannot improve readiness, evidence, coverage, delivery, or provider claims.
- Known-invalid and expired-beyond-retention entries are withheld, then evicted asynchronously under a bounded retention/eviction policy. Identity collision or verification failure is a miss plus security/correctness telemetry.

## Failure, partial, stale, and unavailable behavior

An empty eligible result is distinct from unavailable, partial synchronization, incomplete evidence, stale evaluation, and provider failure. The future collection envelope must expose eligibility/scope, synchronization coverage, evidence completeness, delivery completeness, freshness, and provider availability independently; UI must not collapse them into one status. Current implementation exposes mailbox health and command statuses, but not PPV1 collection states.

## Retry, idempotency, privacy, and observability

Existing commands use idempotency keys, claims, leases, attempt records, and retryable status. Sync uses monotonic history IDs, transactions, unique provider IDs, advisory locking, and reconciliation. The proposed evaluator must be replay deterministic for identical inputs/clock/version/parameters; cache or retry order cannot affect canonical output.

No mailbox content is logged. Telemetry allowlists operational IDs and redacts content, addresses, tokens, provider IDs, payloads, and encrypted data. PPV1 runtime verification may use policy-version-scoped pseudonymous measurements and approved keyed fingerprints, but must not retain mailbox content solely for evaluation.

## Performance, deployment, and security

Existing projection upserts avoid writes when values are unchanged; outbox dispatch is bounded; pagination is provider-token based. Scale PPV1 via owner/mailbox partitioning, canonical batch processing, and bounded cache storage without changing eligibility. Deployment assumes PostgreSQL, Redis, API, worker, Gmail OAuth/Pub/Sub, HTTPS/proxy configuration, encrypted secrets, migrations, and monitoring. Security controls include least scopes, encrypted refresh tokens/payloads, strict CSP/sandboxed email rendering, rate limits, webhook verification, origin/CSRF checks, redacted logs, and owner-scoped lookups.

Threats requiring PPV1 controls include cross-owner cache disclosure, stale-as-current presentation, forged invalidation omission, cache-key collision, policy-version mixing, inference of missing evidence, and AI confidence leakage. All are **Not yet implemented** for PPV1.

## Known gaps, risks, and Founder decisions

- Priority evaluator, corrections/history, envelopes, evaluation cache, runtime verification, and invalidation outbox consumer are not implemented.
- F01 supporting-reason behavior is resolved by PPV1-012 and PPV1-016 through PPV1-019; executable contracts and tests remain not implemented.
- F02 future-skew behavior and parameter are resolved by WSF-008 and PPV1-024; executable parameter contracts and boundary tests remain not implemented.
- F03 canonical application `threadId`, Provider Binding lifecycle, projection rebuild, provider replacement, and non-reuse are resolved by WSF-011 and PPV1-022; durable binding persistence is not implemented.
- Provider Star and the Manual Star provenance boundary are resolved by WSF-009 and PPV1-010A/011A; the normalized three-state adapter contract is not implemented.
- Canonical reason wording is resolved by WSF-010 and PPV1-017A; executable registry contracts and tests are not implemented.
- F04 atomic active-correction invariant, F05 read verification, F06 fingerprint design, F07 command invalidation, F08 AI-confidence boundary enforcement, and F11 PPV1 accessibility documentation are future work.
- Retention duration, legal deletion, and operational lifecycle requirements for PPV1 artifacts remain unresolved operational decisions. Reconnect identity semantics are governed by WSF-011 and PPV1-022.

## Required architecture tests (proposed)

Test owner/mailbox isolation; policy/parameter cache separation; keyed snapshot collision resistance; read-time verification; all PPV1-031 producers including reconciliation; fixed-clock validity/retention boundaries; deterministic permutations and replay; Unknown/malformed evidence; cache failure/provider unavailable/partial coverage; correction atomicity and idempotent Undo; F01 reason retention and non-determining presentation in both ordinary higher-tier and correction-dominant inverse cases; F02 within-, exactly-at-, and strictly-beyond-tolerance behavior using the WSF-008 duration; no AI-confidence field; and telemetry redaction. PPV1-046 additionally requires the product-policy-specified replay, fault-injection, staging, and privacy verification evidence before release claims.

## Traceability to Priority Policy

| Architecture responsibility | PPV1 sections |
| --- | --- |
| provider-neutral eligible normalized metadata | PPV1-001–004, 6.3 |
| deterministic, non-AI evaluation | §§2, 6.4, PPV1-046 |
| corrections and Undo | PPV1-025–029, PPV1-041 |
| semantic invalidation, validity, stale/cache lifecycle | PPV1-030–033, PPV1-046 |
| scope and envelope truthfulness | PPV1-034–035, PPV1-039–040 |
| reasons, supporting-reason behavior, correction dominance, and future timestamps | PPV1-012, PPV1-016–029 |
| privacy, research, accessibility release evidence | PPV1-044–046 |

## Source Evidence

- `README.md`; `docs/architecture/milestone-1-gmail-sync.md`; `docs/architecture/worker-runtime.md`; `docs/architecture/security-baseline.md`; `docs/architecture/observability.md`; `docs/architecture/performance.md`
- `apps/api/src/routes/gmail-webhook.ts`, `thread-mutations.ts`, `provider-commands.ts`; `apps/worker/src/worker-runtime.ts`, `provider-command-executor.ts`, `sync-state.ts`
- `packages/database/migrations/001_milestone_one.sql` through `015_normalize_thread_projection_metadata.sql`; `packages/database/src/repositories/*`
- `packages/contracts/src/index.ts`; `packages/gmail/src/thread-metadata.ts`; `packages/security/src/index.ts`; `packages/observability/src/index.ts`; [Priority Policy](../product/priority-policy-v1.md)

## Claims Not Yet Supported by Source

Any PPV1 evaluator, correction model, evaluation/cache schema, envelope API, invalidation topic, AI Insight UI, formal retention policy, and PPV1-specific operational verification described as proposed above is not present in repository code.
