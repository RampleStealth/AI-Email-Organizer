# AI Email Organizer

This repository has progressed beyond its original Gmail synchronization milestone. The implemented foundation now includes Gmail-authoritative mailbox views and thread reading, application-owned Gmail drafts, an explicit `gmail.modify` permission upgrade, and durable provider-command processing for archive, mark unread, and draft operations. Gmail remains authoritative for mailbox and provider state.

The active next milestone is the **deterministic Priority Policy MVP**. Priority Policy is application-owned, deterministic, and non-AI. The MVP excludes generative AI, AI Insight, semantic search, and reusable evaluation caching.

## Project roadmap

- [Project roadmap](docs/architecture/project-roadmap.md)
- [Milestone 1 — Gmail connection and synchronization](docs/architecture/milestone-1-gmail-sync.md) — complete historical milestone
- [Milestone 2 — Mailbox workspace and provider command foundation](docs/architecture/milestone-2-mailbox-workspace-and-commands.md) — implemented foundation
- [Milestone 3 — Deterministic Priority Policy MVP](docs/architecture/milestone-3-priority-policy-mvp.md) — approved next milestone

Milestones 4–6—bounded AI assistance, advanced retrieval and performance, and production hardening and launch gates—are planned or deferred as described in the roadmap; they are not current implementation claims.

## Canonical sources

- [Priority Policy v1](docs/product/priority-policy-v1.md)
- [Product Architecture v1](docs/architecture/product-architecture-v1.md)
- [Data and State Model v1](docs/architecture/data-state-model-v1.md)
- [Wong Design System v1](docs/design/wong-design-system-v1.md)

## Local setup

1. Populate `.env` with Google OAuth, Pub/Sub, encryption, and session values. Set `DRAFT_MESSAGE_ID_DOMAIN=drafts.localhost.test` for local development; production must use a DNS domain controlled by the deployment owner.
2. Start PostgreSQL and Redis with `docker compose up -d`.
3. Enable Corepack and install the pinned workspace dependencies with `pnpm install --frozen-lockfile`.
4. Run `pnpm db:migrate`.
5. Run the API and worker from their workspace scripts.

Mailbox content and secrets are excluded from logs. PostgreSQL stores a normalized, recoverable projection and encrypted workflow state; it does not replace Gmail as the source of truth.
