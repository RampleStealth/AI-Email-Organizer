# AI Email Organizer Interface Specification v1

## Document control and status

| Field | Value |
| --- | --- |
| Status | Product-specific evaluation design source; existing UI evidence plus proposed PPV1 requirements |
| Version | 1.0 |
| Inherits | [Wong Design System v1](https://github.com/RampleStealth/Wong-Studio/blob/v1.0.0/docs/04-design/wong-design-system-v1.md), [Wong Language System v1](https://github.com/RampleStealth/Wong-Studio/blob/v1.0.0/docs/03-language/wong-language-system-v1.md) |
| Related product sources | [Priority Policy](../product/priority-policy-v1.md), [Product architecture](../architecture/product-architecture-v1.md), [Data/state model](../architecture/data-state-model-v1.md) |

## Purpose and scope

This product specification defines how AI Email Organizer presents Priority Policy results and correction controls. It does not claim a finished component library. The repository has a React/CSS mailbox workspace with keyboard focus, status announcements, responsive layouts, and reduced-motion CSS; it has no Priority Policy screen, tier component, collection envelope, or correction controls.

## Governance inheritance

Company-wide design and language authority is maintained exclusively in Wong Studio. This specification inherits the approved [Wong Design System v1](https://github.com/RampleStealth/Wong-Studio/blob/v1.0.0/docs/04-design/wong-design-system-v1.md), [Design Principles](https://github.com/RampleStealth/Wong-Studio/blob/v1.0.0/docs/04-design/design-principles.md), [Accessibility Philosophy](https://github.com/RampleStealth/Wong-Studio/blob/v1.0.0/docs/04-design/accessibility-philosophy.md), and [Wong Language System v1](https://github.com/RampleStealth/Wong-Studio/blob/v1.0.0/docs/03-language/wong-language-system-v1.md) without restating or redefining them.

This document begins at the product boundary: components, layouts, interaction states, accessibility implementation, and Priority Policy presentation. It presents product-policy output; it does not alter eligibility, tiers, reasons, or freshness.

## Relationship to the policy and architecture

PPV1 exclusively defines deterministic `tier`, `reasonCode`, canonical `reason`, determining/supporting behavior, Provider Star and Manual Star semantics, `threadId`, Provider Binding, scope/envelope facts, state copy, corrections, and non-AI limits. The product architecture defines authoritative Gmail, normalized projections, authorization, and evaluator/cache boundaries. This interface specification defines only how approved facts appear, including no success before authoritative confirmation. The Attention Contract is the minimum information contract; the interface must not omit or reinterpret it.

## Information hierarchy and supported visual baseline

Existing CSS uses an Inter/system UI stack, 12–26px type, muted neutral surfaces, blue/violet accents, focus outlines, a 264px desktop sidebar, responsive single-column behavior, and reduced motion. Those are observed implementation details, not approved product tokens. **Proposed architecture:** establish versioned product tokens, semantic colors, spacing scale, density modes, and component specifications only after product design approval.

For a priority collection, hierarchy should be: (1) scope and state qualification; (2) tier label; (3) tier-determining evidence; (4) supporting evidence, clearly subordinate; (5) correction/control status; (6) freshness and coverage facts. F01 is approved by PPV1-019: retain all applicable authorized affirmative evidence reasons, active explicit correction reasons, and lower-tier supporting reasons when a higher tier wins, but never present supporting reasons as tier-determining.

## Tier, reason, and correction presentation

Use only PPV1-038 canonical tier labels, PPV1-017A canonical `reason` wording, and PPV1-019 `DETERMINING` or `SUPPORTING` roles. Empty reasons use PPV1-036, not invented explanation. Never call a tier objective importance, urgency, or a final decision.

**Correction-dominant results:** Present the ordered canonical result and determining/supporting roles supplied under PPV1-017A through PPV1-019 and PPV1-027. The interface shall not restate, recompute, or paraphrase the policy semantics. The executable component contract and verification are **Not yet implemented**.

Priority routes, selection state, correction controls, Undo, and evaluation presentation use the application `threadId`. Provider identifiers are not interface identity. Provider Binding is an architectural mechanism and is not exposed as user-facing semantics.

Controls are **Not yet implemented**: `Prioritize`, `Not Important`, and `Undo`. Each control needs pending, confirmed, failed, and `Unknown` states. Pending disables duplicate submission and announces work without claiming success. Confirmed requires durable authoritative transition; failed offers recovery; `Unknown` says confirmation is incomplete and must not be rendered as absence. Undo must be idempotent and never imply Gmail labels changed.

## Collection-envelope presentation

Expose, separately, eligibility/candidate scope, synchronization coverage, evidence completeness, delivery completeness, freshness, and provider availability. Never combine these into “all caught up,” “complete,” or a single misleading status. Show current, partial, stale, unavailable, and empty states according to PPV1-035/039; empty is only a truthful evaluated eligible-set result, not a mailbox-empty claim.

Scope disclosure must say what was evaluated, not “your entire mailbox” unless proven. A stale result must retain its stale cause and cannot borrow current readiness/coverage/evidence language. Provider unavailability and synchronization failure require unavailable or partial language, not a reassuring zero-result screen.

### Prohibited claims

- “All caught up” without proof.
- Mailbox-empty claims based on a policy collection.
- Objective importance, inferred intent, or urgency unsupported by approved evidence.
- Stale content shown as current.
- Success before authoritative confirmation.

## AI Insight and uncertainty boundary

Priority Policy tier output is deterministic and must contain no confidence score, confidence wording, probability, or AI-derived basis (F08). A separately authorized AI Insight feature may show uncertainty/confidence only with a distinct feature boundary, source disclosure, and no visual implication that it influenced a PPV1 tier. No AI Insight exists in the repository.

## Accessibility and component-state contracts

Existing UI supplies a skip link, visible focus treatment, buttons, `role=status` command notices, responsive layout, and `prefers-reduced-motion`. These do not satisfy the full PPV1 accessibility contract (F11).

**Proposed component requirements:** keyboard-operable tier/correction controls; predictable focus after mutation; DOM/screen-reader order aligned to visual hierarchy; concise live-region announcements for pending/confirmed/failed/Unknown; text/icon/pattern in addition to color; reduced motion without lost state; localized PPV1 canonical wording and localized accessible timestamps. Controls shall expose disabled/busy/error state semantically and preserve actionable recovery.

| Component | Required states |
| --- | --- |
| tier result | current, stale, partial, unavailable, empty; tier/reasons absent only when contract permits |
| reason list | determining, supporting, no-reason, incomplete evidence |
| correction control | idle, pending, confirmed, failed, Unknown, Undo pending |
| collection envelope | eligible scope, sync coverage, evidence completeness, delivery completeness, freshness, provider availability—independent fields |

## Error and recovery presentation

Retain existing direct command language (`Queued`, `Working`, `Completed`, `Will retry`, `Could not complete`, `Needs your attention`) only for existing provider commands. PPV1 controls need Founder-approved canonical wording under PPV1-041. Offer retry/reload/verification only when safe; no client-side state may overwrite authoritative status.

## Research hooks

PPV1-044 and PPV1-045 require explanation-usefulness and calibrated-trust research. Instrument only approved, policy-version-segmented, privacy-preserving outcomes: comprehension of evidence/limits, correction/Undo understanding, scope-state recognition, and accessibility cohort results. Do not collect mailbox content, identities, raw IDs, token data, or use engagement as a proxy for trust.

## Known gaps and Founder decisions

- Tier UI, correction components, product tokens, envelope API, and AI Insight boundary UI are not implemented.
- WSF-008 through WSF-011 resolve the Priority Policy foundation. This specification references PPV1-010A, PPV1-011A, PPV1-017A, PPV1-022, and PPV1-024 rather than duplicating their semantics.
- PPV1-017A fully defines the canonical localization keys, canonical reason wording, and explanations. This interface specification consumes those definitions without redefining them; component integration and verification remain outstanding.
- Visual-token and component-system details not evidenced by code remain proposed product-design work and do not alter policy semantics.
- Usability/accessibility release research has not been evidenced.

## Evaluation checklist

- Does every view identify scope and independently disclose all envelope dimensions?
- Are current, partial, stale, unavailable, and empty never conflated?
- Are tiers/reasons policy-versioned, deterministic, and non-AI with no confidence?
- When a correction fixes a lower final tier than an ordinary rule would assign, is the correction reason first and the ordinary reason retained only as supporting evidence?
- Are correction success and Undo shown only after authoritative confirmation?
- Can keyboard and assistive-technology users discover, understand, correct, undo, and recover without color or motion dependence?
- Is all canonical policy wording used exactly where approved, with unsupported wording marked TODO?

## Traceability to Priority Policy

| Interface requirement | PPV1 sections |
| --- | --- |
| truthful scope/envelope and states | PPV1-034–035, 039–040 |
| tiers, reasons, precedence | PPV1-016–019, 025–027, 038 |
| correction/Undo states | PPV1-025–029, 041 |
| non-AI and uncertainty boundary | §§2, 6.4, 14, 16 |
| accessibility and research | PPV1-044–046 |

## Source Evidence

- `apps/web/src/styles.css`, `thread-reader.tsx`, `command-status.tsx`, `reader-state.ts`, and associated UI tests
- `docs/product/priority-policy-v1.md`; [product architecture](../architecture/product-architecture-v1.md); [data/state model](../architecture/data-state-model-v1.md)

## Claims Not Yet Supported by Source

No repository evidence proves an AI Email Organizer component library, PPV1 visual implementation, product tokens, correction controls, collection envelopes, localization system, or AI Insight feature.
