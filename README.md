# AI Email Organizer

AI Email Organizer is an official Wong Studio product and the studio's first official product. It inherits the Wong Studio constitutional framework while retaining authority over its product requirements, architecture, implementation decisions, user experience, deployment, testing, and operations.

This repository has progressed beyond its original Gmail synchronization milestone. The implemented foundation now includes Gmail-authoritative mailbox views and thread reading, application-owned Gmail drafts, an explicit `gmail.modify` permission upgrade, and durable provider-command processing for archive, mark unread, and draft operations. Gmail remains authoritative for mailbox and provider state.

The active next milestone is the **deterministic Priority Policy MVP**. Its policy foundation is complete under WSF-008 through WSF-011 and it is ready for implementation. Priority Policy is application-owned, deterministic, and non-AI. The MVP excludes generative AI, AI Insight, semantic search, and reusable evaluation caching.

## Governance Inheritance

Company-wide standards are maintained exclusively in the [Wong Studio repository](https://github.com/RampleStealth/Wong-Studio/tree/v1.0.0). AI Email Organizer inherits those standards and does not redefine them. The applicable approved sources are:

- [Wong Studio Constitution v1](https://github.com/RampleStealth/Wong-Studio/blob/v1.0.0/docs/01-constitution/constitution-v1.md)
- [Repository Policy](https://github.com/RampleStealth/Wong-Studio/blob/v1.0.0/docs/01-constitution/repository-policy.md)
- [Engineering Principles](https://github.com/RampleStealth/Wong-Studio/blob/v1.0.0/docs/05-engineering/engineering-principles.md)
- [Trust Model](https://github.com/RampleStealth/Wong-Studio/blob/v1.0.0/docs/05-engineering/trust-model.md)
- [AI Principles](https://github.com/RampleStealth/Wong-Studio/blob/v1.0.0/docs/05-engineering/ai-principles.md)
- [Wong Design System v1](https://github.com/RampleStealth/Wong-Studio/blob/v1.0.0/docs/04-design/wong-design-system-v1.md)
- [Wong Language System v1](https://github.com/RampleStealth/Wong-Studio/blob/v1.0.0/docs/03-language/wong-language-system-v1.md)

This repository begins where those company standards end: it defines the product-specific policy and specifications required to build and operate AI Email Organizer.

## Project roadmap

- [Project roadmap](docs/architecture/project-roadmap.md)
- [Milestone 1 — Gmail connection and synchronization](docs/architecture/milestone-1-gmail-sync.md) — complete historical milestone
- [Milestone 2 — Mailbox workspace and provider command foundation](docs/architecture/milestone-2-mailbox-workspace-and-commands.md) — implemented foundation
- [Milestone 3 — Deterministic Priority Policy MVP](docs/architecture/milestone-3-priority-policy-mvp.md) — constitutionally complete; ready for implementation

Milestones 4–6—bounded AI assistance, advanced retrieval and performance, and production hardening and launch gates—are planned or deferred as described in the roadmap; they are not current implementation claims.

## Product sources

- [Priority Policy v1](docs/product/priority-policy-v1.md)
- [Product Architecture v1](docs/architecture/product-architecture-v1.md)
- [Data and State Model v1](docs/architecture/data-state-model-v1.md)
- [AI Email Organizer Interface Specification v1](docs/design/ai-email-organizer-interface-spec-v1.md)

## Local setup

1. Populate `.env` with Google OAuth, Pub/Sub, encryption, and session values. Set `DRAFT_MESSAGE_ID_DOMAIN=drafts.localhost.test` for local development; production must use a DNS domain controlled by the deployment owner.
2. Start PostgreSQL and Redis with `docker compose up -d`.
3. Enable Corepack and install the pinned workspace dependencies with `pnpm install --frozen-lockfile`.
4. Run `pnpm db:migrate`.
5. Run the API and worker from their workspace scripts.

Mailbox content and secrets are excluded from logs. PostgreSQL stores a normalized, recoverable projection and encrypted workflow state; it does not replace Gmail as the source of truth.
