# Milestone 2: Mailbox workspace and provider command foundation

**Status: Implemented foundation.**

Milestone 2 records the repository-supported foundation built after the original Gmail synchronization milestone. It does not claim that Priority Policy is implemented. Gmail remains authoritative for mailbox views, message content, draft resources, sent messages, and the outcome of provider mutations; PostgreSQL holds a normalized projection and durable application workflow state.

## Implemented scope

### Gmail-authoritative mailbox workspace

- Inbox, Sent, and Drafts views are read from Gmail. Provider page tokens are wrapped in encrypted, expiring, owner/mailbox/view-bound application cursors.
- List hydration normalizes provider metadata into the local projection. Gmail remains list authority; the projection is not treated as a complete mailbox index.
- Structured, owner-scoped search is compiled to bounded Gmail queries and uses similarly protected provider pagination.
- A selected thread is fetched from Gmail only after mailbox ownership is verified. The API requests structured full MIME rather than raw MIME.
- Thread display normalization traverses nested MIME, chooses safe text/HTML alternatives, sanitizes HTML, and falls back safely for malformed content. The browser uses an empty-sandbox iframe and restrictive content security policy for sanitized HTML.

Evidence: `apps/api/src/routes/mailbox-workspace.ts`, `apps/api/src/routes/mailbox-search.ts`, `apps/api/src/mailbox-list.ts`, `apps/api/src/mailbox-search.ts`, `packages/gmail/src/index.ts`, `packages/gmail/src/thread-metadata.ts`, `packages/gmail/src/thread-display.ts`, `apps/web/src/safe-iframe.ts`, and their mailbox list/search/thread read/display tests.

### Drafting foundation

- Application-created drafts use validated structured content encrypted at rest. Provider-command payloads contain local draft identity and revision data rather than draft content.
- Create, update, and send use the Gmail Draft resource through the worker. Durable execution markers and conservative read-only recovery avoid blind replay after an uncertain provider outcome.
- Draft reads and edit eligibility are owner scoped. Revision checks, active-command constraints, stable application Message-IDs, and provider preflight checks protect updates and sends.

This is an application-created draft workflow, not a general Gmail-native draft mirror. Attachments, autosave, reply, forward, scheduled send, undo-send, templates, signatures, and AI drafting are outside the implemented scope.

Evidence: `packages/database/migrations/010_gmail_drafts.sql`, `packages/database/src/repositories/draft-repository.ts`, `apps/api/src/routes/drafts.ts`, `apps/worker/src/provider-command-executor.ts`, `packages/gmail/src/draft-mime.ts`, and the API, Gmail, repository, and worker draft tests. See also [Gmail Draft Lifecycle](draft-lifecycle.md).

### Explicit Gmail write-permission upgrade

- Initial connection remains read-only. A mailbox owner must start a separate OAuth/PKCE flow for `gmail.modify`.
- The upgrade uses one-time, expiring state bound to the authenticated user, mailbox, capability, and attempt. Callback checks prevent old or duplicate attempts from regressing a newer grant.
- Credentials, granted scopes, permission state, and the audit event are changed transactionally only after the returned account and scope are verified.

Evidence: `packages/database/migrations/006_mailbox_permission_state.sql`, `packages/database/migrations/007_permission_upgrade_attempts.sql`, `apps/api/src/routes/permissions.ts`, `apps/api/src/write-upgrade.test.ts`, and `apps/worker/src/permission-state-regression.test.ts`.

### Durable provider commands

- Archive, mark unread, and draft mutations use strict, encrypted, versioned payload contracts.
- UUID idempotency is unique within a mailbox. A conflicting replay is rejected rather than treated as the original request.
- Command and outbox persistence are one PostgreSQL transaction. Outbox dispatch and command execution use bounded claims and leases.
- Each command claim creates an immutable attempt row. Retryable provider failures use deterministic exponential backoff capped at eight attempts; expired or uncertain work is recovered without overwriting terminal truth.
- The worker marks archive or mark unread successful only after the Gmail mutation returns successfully and the corresponding local projection update and command completion commit atomically. A post-provider projection failure becomes `recovery_required`, not a false success.
- The web UI polls normalized owner-scoped command state and presents `pending`, `running`, `retryable`, `succeeded`, `failed`, and `recovery_required` through text and `role="status"`.

Evidence: `packages/contracts/src/index.ts`, `packages/security/src/index.ts`, `packages/database/migrations/008_provider_commands.sql`, `packages/database/migrations/009_command_execution_hardening.sql`, `packages/database/src/repositories/provider-command.ts`, `apps/api/src/routes/thread-mutations.ts`, `apps/api/src/routes/provider-commands.ts`, `apps/worker/src/provider-command-executor.ts`, `apps/web/src/command-status.tsx`, and the provider-command, thread-mutation, executor, and command-presentation tests.

### Authorization, observability, and recovery

- Mailbox, thread mutation, command-status, draft, and search paths verify the authenticated owner and mailbox scope before credential decryption or provider access.
- API and worker telemetry use allowlisted operational context. Provider errors are normalized and content, addresses, OAuth material, raw provider identifiers, payloads, and encrypted values are excluded.
- Correlation identifiers connect API command creation, outbox dispatch, worker execution, audit events, and safe diagnostics.
- Sync reconciliation, outbox lease recovery, provider-command lease recovery, draft uncertainty states, read-only verification, worker heartbeats, and conservative orphan repair provide recoverable operational paths without inventing provider success.

Evidence: `apps/api/src/route-helpers/security.ts`, `apps/api/src/routes/mailbox-workspace.ts`, `apps/api/src/routes/provider-commands.ts`, `packages/database/src/repositories/provider-command.ts`, `packages/observability/src/index.ts`, `apps/worker/src/worker-runtime.ts`, and the associated security, authorization, observability, provider-command, and worker-runtime tests. See [Observability architecture](observability.md) and [Worker runtime](worker-runtime.md).

## Not implemented in this milestone

- Priority Policy evaluator
- `Prioritize`, `Not Important`, or `Undo`
- Priority collection envelopes
- PPV1 reusable evaluation cache
- AI Insight
- AI summaries
- Semantic or hybrid search
- Production launch governance

The repository contains no `priority_*` migration or Priority Policy API. Those boundaries are also recorded in [Product Architecture v1](product-architecture-v1.md), [Data and State Model v1](data-state-model-v1.md), and the [AI Email Organizer Interface Specification v1](../design/ai-email-organizer-interface-spec-v1.md).

## Relationship to the roadmap

This foundation supplies normalized mailbox state, owner/mailbox authorization, durable workflow patterns, safe presentation primitives, and recovery mechanisms for the [Deterministic Priority Policy MVP](milestone-3-priority-policy-mvp.md). It does not pre-authorize or implement that policy. See the [project roadmap](project-roadmap.md).
