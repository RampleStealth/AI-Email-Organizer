# Priority Policy v1 and Attention Contract v1

## Document control

| Field | Value |
| --- | --- |
| Status | Approved |
| Version | 1.0 |
| Owner | Wong Studio |
| Effective sprint | Sprint 1 |
| Founder decision | FD-001 |

This document is the constitutional engineering source of truth for Priority Policy v1 and Attention Contract v1. Implementations must not infer, extend, or silently reinterpret unresolved policy. A section marked `TODO (Founder Approval Required)` is non-operative until the Founder approves a concrete replacement in this document.

## Constitutional Scope

This document defines the deterministic attention policy used by Wong Email.

It intentionally excludes semantic interpretation, AI reasoning, provider-specific implementations, engineering optimizations, and implementation details unless explicitly stated.

Its purpose is to establish constitutional guarantees that remain stable across implementations and providers.

## Table of contents

1. [Purpose](#1-purpose)
2. [Philosophy](#2-philosophy)
3. [Design promise](#3-design-promise)
4. [Candidate scope](#4-candidate-scope)
5. [Priority tiers](#5-priority-tiers)
6. [Deterministic rule set](#6-deterministic-rule-set)
   1. [Signal classification](#61-signal-classification)
   2. [Recency](#62-recency)
   3. [Provider Mapping](#63-provider-mapping)
   4. [AI Independence](#64-ai-independence)
7. [Reason codes](#7-reason-codes)
8. [Ordering rules](#8-ordering-rules)
9. [Future timestamp handling](#9-future-timestamp-handling)
10. [User overrides](#10-user-overrides)
11. [Freshness policy](#11-freshness-policy)
12. [Attention Contract v1](#12-attention-contract-v1)
13. [UX contract](#13-ux-contract)
14. [Non-goals](#14-non-goals)
15. [Success metrics](#15-success-metrics)
16. [Known risks](#16-known-risks)
17. [Future evolution](#17-future-evolution)
18. [Founder approval record](#18-founder-approval-record)
19. [Revision history](#19-revision-history)

## 1. Purpose

Priority Policy v1 helps a user identify which eligible inbox threads have trustworthy evidence that they may deserve attention. It reduces the burden of deciding where to begin when opening a busy inbox.

The policy produces an explainable recommendation from deterministic mailbox metadata. It does not claim to know a user's intent, relationships, deadlines, emotional context, or the true importance of a message.

The policy does not replace Gmail, modify Gmail's classifications, or decide on the user's behalf.

## 2. Philosophy

All policy and implementation decisions must uphold these principles:

- Truth before intelligence
- Explainability before automation
- Trust before delight
- Calm before productivity
- Evidence before assumptions

Priority Policy v1 is deterministic and non-AI. It may use only evidence explicitly authorized by this document. Missing evidence must remain missing; it must not be inferred.

## 3. Design promise

The Priority Policy exists to reduce uncertainty.

It does not replace the user's judgment.

It does not compete with Gmail.

It simply helps people begin.

Every recommendation should make the first step feel lighter—not make the decision for them.

## 4. Candidate scope

The candidate set must be policy-scoped, owner-scoped, and described truthfully to the user. The system must never imply that it evaluated an entire mailbox when it evaluated only the eligible candidate scope.

The policy evaluates thread-level normalized metadata. Message bodies, snippets, attachment contents, and generated summaries are not candidate evidence.

Constitutional candidate-scope decisions:

- **PPV1-001 — Eligible Gmail location:** Current Inbox membership defines constitutional location eligibility.

  A thread is location-eligible when:

  - its normalized current location includes verified Inbox membership; and
  - it is not currently located in Spam or Trash.

  Approved behavior:

  - Current Inbox thread → eligible
  - Archived thread without Inbox membership → ineligible
  - Sent-only thread → ineligible
  - Draft-only thread → ineligible
  - Spam thread → ineligible
  - Trash thread → ineligible
  - Inbox thread that also contains sent messages → remains eligible
  - Inbox thread that also contains a draft → remains eligible

  Eligibility is determined by the thread's current normalized location membership. Sent or Draft participation within a conversation does not disqualify an otherwise eligible Inbox thread.

  Priority Policy v1 does not evaluate archived-only mail, Sent-only conversations, Draft-only conversations, Spam, or Trash.

  This decision governs location eligibility only. Lookback duration, candidate timestamps, missing-label handling, synchronization readiness, and provider mappings remain governed by separate Founder decisions.

  The constitutional policy consumes provider-neutral normalized location membership; Gmail-specific labels remain adapter concerns.
- **PPV1-002 — Maximum candidate count:** The policy defines no maximum candidate count. Implementations may batch, paginate, stream, parallelize, or otherwise optimize evaluation provided every eligible candidate remains eligible for deterministic evaluation.
  - **PPV1-002A — Time-to-first-result guarantee:** TODO (Founder Approval Required): Define the maximum permitted time before the first eligible deterministic result is available.
  - **PPV1-002B — Candidate lookback duration:** Priority Policy v1 establishes no temporal lookback limit. Every thread satisfying PPV1-001 location eligibility remains constitutionally eligible regardless of age.

    Priority Policy v1 defines no age-based eligibility cutoff and no maximum candidate count. Constitutional eligibility is determined independently of implementation strategy.

    Batching, pagination, streaming, parallelization, caching, and progressive delivery shall never redefine candidate eligibility.

    Recency affects deterministic ordering only and never determines eligibility. Users naturally control candidate scope through current Inbox membership. Archived-only threads remain governed by PPV1-001 and remain outside the candidate set.

    PPV1-002A remains a separate operational guarantee.
- **PPV1-003 — Candidate timestamp:** The candidate timestamp is the latest valid provider-confirmed timestamp from a verifiably incoming message in the thread.

  1. **Incoming activity:** A newly received incoming message may advance the candidate timestamp.
  2. **User-authored activity:** Sent replies, draft creation, draft updates, and other owner-authored message activity shall not advance the candidate timestamp.
  3. **Provider and local metadata:** Provider history identifiers, synchronization timestamps, watch-renewal timestamps, local `created_at` timestamps, local `updated_at` timestamps, and projection-write timestamps are not candidate timestamps.
  4. **Verified direction:** Message direction must come from provider-verifiable normalized metadata. If direction cannot be verified, the implementation shall not infer that the message is incoming.
  5. **Missing timestamp:** If no valid incoming-message timestamp exists, the candidate timestamp is missing. PPV1-004A and PPV1-023 govern the resulting behavior.
  6. **No synthesis:** The implementation shall not synthesize a candidate timestamp from unrelated or locally generated fields.
  7. **Future timestamps:** Future timestamp handling remains governed by the existing age-zero rule and PPV1-024.

  The candidate timestamp affects deterministic ordering and future approved temporal rules only. It does not affect eligibility under PPV1-002B.
- **PPV1-004 — Missing metadata fallback:** Missing metadata must never be inferred. Each missing field follows the approved deterministic behavior below.

  | Missing Metadata | Deterministic Behavior | Founder Status |
  | --- | --- | --- |
  | Candidate timestamp (`PPV1-004A`) | Retain the candidate with an Unknown temporal state; apply no temporal effect. | Approved |
  | Sender (`PPV1-004B`) | Preserve independent Unknown states for display name and address; apply no policy effect. | Approved |
  | Labels (`PPV1-004C`) | Preserve independent verified-present, verified-absent, or Unknown states; evaluate only rules whose required label evidence is verified. | Approved |
  | User overrides (`PPV1-004D`) | Preserve verified-active-present, verified-active-absent, or Unknown state; evaluate only rules whose required override evidence is verified. | Approved |

### PPV1-004A — Missing candidate timestamp

When an otherwise eligible candidate has no valid PPV1-003 candidate timestamp:

1. **Candidate retention:** The candidate remains constitutionally eligible under PPV1-001 and PPV1-002B.
2. **Unknown temporal state:** The candidate timestamp remains missing. No replacement timestamp may be generated, inferred, copied, or synthesized. Prohibited substitutes include:
   - zero or epoch time;
   - `evaluatedAt`;
   - current time;
   - synchronization time;
   - local insertion time;
   - local update time;
   - another unrelated timestamp.
3. **Available evidence:** All other available approved constitutional rules continue to evaluate normally. A Manual Star may still assign `REVIEW_LATER`. Future approved user corrections may still apply.
4. **No temporal effect:** A missing candidate timestamp:
   - produces no Recency effect;
   - emits no `RECENCY` reason;
   - does not promote or demote a tier;
   - does not itself assign `NO_IMMEDIATE_SIGNALS`.

   If no other applicable rule assigns a higher tier, PPV1-009 independently assigns `NO_IMMEDIATE_SIGNALS` with empty reasons.
5. **Ordering:** PPV1-023 remains the sole authority for deterministic placement of candidates with missing timestamps. PPV1-004A shall not resolve that ordering decision.
6. **Truthful disclosure:** A collection containing one or more candidates with missing candidate timestamps shall disclose incomplete temporal evidence through the future PPV1-035 collection envelope. PPV1-035 remains responsible for the exact field names, shape, and serialization.

Tier evaluation may remain constitutionally valid when temporal evidence is incomplete. The disclosure communicates the limitation affecting temporal comparison and presentation; it does not imply that every tier result is invalid.

### PPV1-004B — Missing sender

Priority Policy v1 adopts independent Unknown states for sender display name and sender address.

1. **Candidate retention:** Missing or malformed sender metadata shall never exclude an otherwise eligible candidate.
2. **Independent normalization:** Sender display name and sender address are evaluated independently. Each field preserves its own verified state. A missing or malformed field does not invalidate another independently verified field.
3. **Unknown preservation:** Missing or malformed sender fields remain Unknown. No identity may be guessed, synthesized, inferred, or fabricated. Prohibited substitutions include:
   - `"Unknown Sender"` as factual identity;
   - mailbox-owner identity;
   - empty address as verified address;
   - guessed email addresses;
   - malformed provider values treated as normalized identity.
4. **No constitutional evaluation effect:** Missing sender metadata:
   - does not affect eligibility;
   - does not affect ordering;
   - does not assign or modify tiers;
   - emits no reasons;
   - provides no affirmative or negative evidence.
5. **Presentation:** Presentation layers may display neutral interface text indicating unavailable sender information. Presentation fallback is interface copy only. It is not normalized sender identity, constitutional evidence, or provider metadata.
6. **Collection disclosure:** Because sender is non-operative in Priority Policy v1, missing sender metadata requires no collection-level incomplete-evidence disclosure. Future sender-based constitutional rules remain governed by PPV1-015 and future amendments.

### PPV1-004C — Missing labels

Priority Policy v1 adopts independent three-state knowledge for every normalized constitutional label concept:

- verified present;
- verified absent;
- Unknown.

1. **Candidate retention:** Missing, incomplete, malformed, or unavailable policy-evidence labels shall not exclude an otherwise PPV1-001-eligible candidate.
2. **Independent label state:** Each normalized label concept preserves its own independently verified state. An Unknown or malformed label does not invalidate another independently verified label.
3. **Unknown preservation:** A label is Unknown unless an authoritative provider-normalized result verifies its presence or absence. Unknown shall never be serialized or evaluated as:
   - `false`;
   - absent;
   - an empty label set;
   - no Manual Star;
   - no Inbox membership;
   - no future mapped provider signal.
4. **Label-dependent rules:** A label-dependent rule evaluates only when its required label condition is verified. For Manual Star:
   - verified present → apply PPV1-011 and emit `MANUAL_STAR`;
   - verified absent → Manual Star does not apply;
   - Unknown → do not evaluate Manual Star and emit no `MANUAL_STAR` reason.
5. **Label-independent rules:** All approved rules that do not depend on unavailable label evidence continue to evaluate normally.
6. **Default tier:** If no available approved rule assigns a higher tier, PPV1-009 may independently assign `NO_IMMEDIATE_SIGNALS`. That result shall not be represented as proof that Manual Star was absent when its state was Unknown.
7. **Disclosure:** Because incomplete label metadata can prevent evaluation of an operative constitutional signal, a collection containing affected candidates shall disclose incomplete label evidence through PPV1-035. PPV1-035 remains responsible for the exact public field names, shape, and serialization.
8. **Recalculation:** When authoritative label metadata becomes available or changes, the candidate shall be reevaluated under the PPV1-031 trigger rules.

PPV1-004C governs policy-evidence label availability after location eligibility has otherwise been established. It does not authorize synthesis of Inbox membership or any other provider mapping.

### PPV1-004D — Missing user override metadata

Priority Policy v1 adopts three-state knowledge for owner-scoped user-override metadata:

- verified active override present;
- verified active override absent;
- Unknown.

1. **Verified presence:** An override is present only when a valid authoritative owner-scoped record confirms an active explicit user correction. Active corrections operate under the approved mapping, precedence, lifetime, and Undo semantics in PPV1-025 through PPV1-029.
2. **Verified absence:** Override absence is established only when a successful authoritative owner-scoped lookup confirms that no active override exists.
3. **Unknown state:** The following produce Unknown:
   - failed lookup;
   - unavailable storage;
   - incomplete metadata;
   - malformed metadata;
   - ambiguous state;
   - unverifiable activity.

   Unknown shall never be interpreted as:

   - no active correction;
   - not prioritized;
   - not marked Not Important;
   - an inferred Undo;
   - an empty override treated as verified absence.
4. **Candidate retention:** Missing, unavailable, incomplete, or malformed override metadata shall not exclude an otherwise eligible candidate.
5. **Partial evaluation:** When override state is Unknown:
   - override-dependent rules do not evaluate;
   - every approved override-independent rule continues to evaluate normally.
6. **Default tier:** If no available approved rule assigns a higher tier, PPV1-009 may independently assign `NO_IMMEDIATE_SIGNALS`. That result shall not be represented as proof that no active user correction exists.
7. **Disclosure:** Because Unknown override metadata may conceal the highest-authority constitutional input, a collection containing affected candidates shall disclose incomplete user-correction evidence through PPV1-035. PPV1-035 remains responsible for the exact public fields, shape, and serialization.
8. **Recalculation:** When authoritative override state becomes available or changes, the candidate shall be reevaluated under PPV1-031.

Tier evaluation may proceed from available evidence while override metadata is Unknown, but the result must remain truthfully qualified through collection-level disclosure.

- **PPV1-005 — Synchronization requirement:** Priority Policy v1 adopts an explicit synchronization-readiness boundary with truthful partial-result support.

  1. **Synchronization-ready:** A collection may be described as synchronization-ready only when an authoritative synchronization checkpoint establishes complete PPV1-001 candidate-location coverage for the normalized snapshot being evaluated. All known provider changes through that checkpoint must be durably reflected or explicitly represented as unresolved.
  2. **Partial synchronization:** Deterministic evaluation may proceed for candidates already represented in a partial snapshot. Partial results may be presented only when explicitly identified as partial. They shall never be described as:
     - complete candidate coverage;
     - current complete mailbox evaluation;
     - evidence that every eligible candidate was evaluated.
  3. **Eligibility preservation:** Partial synchronization does not make undiscovered candidates ineligible. Batching, pagination, streaming, parallelization, and progressive delivery shall not redefine PPV1-001 or PPV1-002B.
  4. **Evidence completeness:** Missing timestamp, label, or override evidence within a known candidate does not automatically make candidate coverage synchronization-unready. Those field-level limitations remain governed by PPV1-004 and disclosed separately through PPV1-035.
  5. **Freshness separation:** Synchronization readiness establishes coverage integrity at a checkpoint. It does not establish how long that checkpoint may be called current. PPV1-030 through PPV1-033 remain responsible for validity, recalculation, stale presentation, and caching.
  6. **Provider unavailability:** A previously synchronization-ready snapshot does not become partial solely because the provider becomes temporarily unavailable. Whether that snapshot may still be presented, and whether it may be called current, remains governed by future freshness and stale-presentation rules.
  7. **Collection disclosure:** PPV1-035 shall distinguish:
     - synchronization-ready coverage;
     - partial synchronization coverage;
     - field-level incomplete evidence.

     The exact public field names, shape, and serialization remain governed by PPV1-035.

  The evaluator may produce a valid deterministic result over the exact inputs supplied while the collection remains partial. Validity of an individual deterministic calculation does not imply complete candidate coverage.
- **PPV1-006 — Empty candidate behavior:** Priority Policy v1 adopts status-qualified empty collections.

  1. **Synchronization-ready empty evaluation:** A collection may state that it contains zero eligible candidates only when:
     - PPV1-005 synchronization-ready coverage is established;
     - the complete PPV1-001 candidate scope is represented at the authoritative checkpoint;
     - zero candidates satisfy that scope; and
     - applicable freshness and stale-presentation rules permit the snapshot to be presented as current.
  2. **Constitutional meaning:** A synchronization-ready empty result means only:

     > No candidates satisfy the approved Priority Policy candidate scope in this synchronization-ready snapshot.

     It shall not mean or imply:

     - the mailbox is empty;
     - no email is important;
     - no email requires human judgment;
     - archived mail is empty;
     - Sent is empty;
     - Drafts are empty;
     - Spam is empty;
     - Trash is empty;
     - the user has no work.
  3. **Partial synchronization:** Zero currently represented candidates in a partial snapshot is a partial empty result. It is not proof that zero eligible candidates exist. It must remain explicitly identified as partial.
  4. **Provider unavailable or stale:** Provider unavailability and stale coverage are not empty candidate results. PPV1-032 remains responsible for whether a previously ready snapshot may remain visible.
  5. **Contract behavior:** Return an empty candidate collection together with truthful:
     - readiness metadata;
     - freshness metadata;
     - candidate-scope metadata;
     - evidence-completeness metadata.

     PPV1-034 and PPV1-035 remain responsible for exact public representation. Do not create:

     - fabricated candidates;
     - synthetic reasons;
     - transport-level absence as a substitute for constitutional state.
  6. **Presentation:** PPV1-039 remains responsible for exact user-facing wording for synchronization-ready empty, partial empty, stale, and unavailable states.

  The evaluator may deterministically return zero items for the exact inputs supplied. That fact alone does not prove complete candidate coverage or mailbox emptiness.

Candidate selection must be deterministic. Given the same normalized projection, evaluation instant, and approved scope, candidate membership must be identical.

## 5. Priority tiers

The constitutional tier identifiers are:

- `NEEDS_ATTENTION`
- `REVIEW_LATER`
- `NO_IMMEDIATE_SIGNALS`

- **PPV1-007 — Tier identifiers:** The identifiers above are the complete Priority Policy v1 tier registry. No implementation may introduce an additional tier under policy version `1.0`.
- **PPV1-008 — Tier semantics:** Priority Policy v1 uses rule-assigned evidence semantics:
  - `NEEDS_ATTENTION`: At least one approved constitutional rule explicitly assigns the candidate to the highest attention tier.
  - `REVIEW_LATER`: At least one approved constitutional rule assigns the candidate for later review, and no applicable rule assigns `NEEDS_ATTENTION`.
  - `NO_IMMEDIATE_SIGNALS`: No approved constitutional rule assigns either higher tier, subject to active user-correction rules.

  These tiers express evidence-based attention guidance. They do not claim urgency, objective importance, certainty, or required action.

  PPV1-008 does not decide which signals map to which tiers. Signal mappings, combinations, correction mappings, and UI labels remain governed by their separate Founder decisions.
- **PPV1-009 — Default tier:** When an eligible candidate has no affirmative constitutional signal and no active user correction, Priority Policy v1 shall assign:
  - `tier`: `NO_IMMEDIATE_SIGNALS`
  - `reasonCodes`: `[]`
  - `reasons`: `[]`

  `NO_IMMEDIATE_SIGNALS` does not mean unimportant, irrelevant, or safe to ignore. It means no approved constitutional rule currently assigns `REVIEW_LATER` or `NEEDS_ATTENTION`.

  Eligible candidates shall not be omitted merely because they have no affirmative signal. Missing or unavailable metadata remains governed separately by PPV1-004 and must not be treated as equivalent to confirmed absence of evidence.

Tier assignment must be deterministic. The engine must not emit confidence, inferred urgency, or an unapproved intermediate tier. PPV1-020 is authoritative for the constitutional ordering of the approved identifiers.

## 6. Deterministic rule set

The evaluator may consume only normalized metadata already available from the mailbox projection and explicitly approved in this section.

Available normalized evidence includes:

- Gmail system-label presence, including `UNREAD`, `STARRED`, `IMPORTANT`, and `INBOX`
- normalized candidate timestamp defined by PPV1-003
- normalized sender and recipient addresses
- thread-level attachment presence
- owner-scoped user override metadata when that contract is implemented

Availability does not authorize a field as a ranking signal. The exact operative rules remain unresolved:

- **PPV1-010 — Remaining signal decisions:** TODO (Founder Approval Required): Identify which available metadata fields other than Manual user star and Recency are operative Priority Policy v1 signals.
- **PPV1-010A — Provider-Verifiable Signal Origin:** Every approved signal must have a provider-verifiable origin. Signals whose origin cannot be distinguished from provider inference or AI classification are not constitutional inputs to Priority Policy.
- **PPV1-011 — Rule-to-tier mapping:** Individual constitutional signals map as follows:
  - **Provider-verifiable Manual Star**
    - `tier`: `REVIEW_LATER`
    - `reasonCode`: `MANUAL_STAR`

    A Manual Star is explicit, user-verifiable intent that the candidate should remain visible for review. A Manual Star does not necessarily mean urgency, immediate action, or a request to begin with that candidate. Therefore, Manual Star elevates the candidate above `NO_IMMEDIATE_SIGNALS` but does not independently assign `NEEDS_ATTENTION`.
  - **Recency alone**
    - `tier`: `NO_IMMEDIATE_SIGNALS`
    - `reasonCodes`: `[]`
    - `reasons`: `[]`

    Recency tells time, not importance. Recency alone does not promote a tier and does not constitute a reason for the assigned tier. Recency may be used only as a deterministic ordering rule among otherwise constitutionally equal candidates.

  Do not emit `RECENCY` merely because a valid timestamp exists. The `RECENCY` reason code remains registered but inactive unless a future Founder-approved rule gives it an explanatory constitutional condition.

  `NEEDS_ATTENTION` remains available for explicit correction mappings or other future Founder-approved rules. This decision does not resolve corrections, missing metadata, or provider-specific mappings.
- **PPV1-012 — Combined-signal behavior:** Highest assigned tier wins, with no combinational promotion.
  1. **Individual rule evaluation:** Each applicable approved constitutional rule evaluates independently and may produce only its Founder-approved tier assignment and authorized reason.
  2. **Correction handling:** Active user corrections are resolved under PPV1-025 through PPV1-027 before ordinary rule conflict resolution.
  3. **Final tier assignment:** PPV1-027 determines whether exactly one verified active correction fixes the final tier. When authoritative correction state confirms that no active correction exists, the final tier is the constitutionally highest tier actually assigned by an applicable approved ordinary rule.
  4. **No accumulation:** Multiple signals shall not accumulate, add weight, or combine into a higher tier merely because they coexist. A combination may produce a distinct or higher tier only when a separate Founder-approved constitutional combination rule explicitly assigns that outcome.
  5. **Reasons:** Reasons remain governed by PPV1-018 and PPV1-019. PPV1-019 determines the visibility of lower-tier supporting reasons in a higher-tier result.

  Current approved example:

  - Manual Star plus Recency:
    - `tier`: `REVIEW_LATER`
    - `reasonCodes`: [`MANUAL_STAR`]

  `RECENCY` remains inactive and is not emitted. Recency may still order otherwise constitutionally equal candidates.

  The policy shall not use scores, weights, confidence values, probabilistic ranking, or inferred promotion.
- **PPV1-014 — Attachment treatment:** TODO (Founder Approval Required): State explicitly whether attachment presence affects Priority Policy v1 or is projection metadata only.
- **PPV1-015 — Sender and recipient treatment:** TODO (Founder Approval Required): State explicitly whether normalized addresses affect Priority Policy v1 or are projection metadata only.

The engine must not:

- inspect message bodies, snippets, or attachment contents;
- inspect AI summaries;
- add unapproved weights or scores;
- infer urgency, intent, relationship strength, deadlines, or sentiment;
- use randomness, hidden heuristics, or wall-clock access;
- silently treat missing metadata as affirmative evidence.

The caller must supply a fixed `evaluatedAt` instant. Identical policy inputs, including `evaluatedAt`, must produce structurally identical outputs.

### 6.1 Signal classification

#### Approved signals

| Signal | Founder Status | Constitutional Basis |
| --- | --- | --- |
| Manual user star | Approved | A manually applied star is an explicit user action and therefore satisfies the constitutional requirements of objective, deterministic, and user-verifiable evidence. |
| Recency | Approved | Recency provides objective temporal context. It does not represent importance and cannot promote a tier by itself. |

The individual tier mappings are governed by PPV1-011. Combined-signal behavior, canonical human-readable wording, and Recency parameter values remain governed by PPV1-012, PPV1-017A, and the unresolved Recency parameters below.

#### Not approved signals

| Signal | Founder Status | Constitutional Boundary |
| --- | --- | --- |
| Manual/provider importance | Not Approved | A provider importance signal is approved only if its origin can be verified as an explicit user action. If the implementation cannot distinguish user-applied importance from provider-generated importance, the signal shall not participate in Priority Policy. |

### 6.2 Recency

- **PPV1-013 — Constitutional role of Recency:** Recency is an approved deterministic signal. Its purpose is to provide objective temporal context. Recency does not represent importance.
- **PPV1-013A — Recency Represents Time:** Recency tells time, not importance. Priority Policy shall treat recency solely as objective temporal evidence. Importance shall never be inferred from recency alone.
- **PPV1-013B — No Tier Promotion:** Recency alone shall never increase an email's Priority Policy tier. It may participate only according to the deterministic constitutional rules.
- **PPV1-013C — Explicit User Intent Dominance:** Explicit user actions always take precedence over passive metadata.

  Examples of explicit actions include:

  - Manual Star
  - User Override
  - Future Founder-approved manual controls

  Examples of passive metadata include:

  - Timestamp
  - Arrival order
  - Provider-generated metadata

  Passive metadata shall not override explicit user intent.

- **PPV1-013D — Deterministic Ordering:** When two candidates are otherwise constitutionally equal, recency may be used solely as a deterministic ordering rule. It shall not create, modify, or elevate Priority Policy tiers.

#### Time and Importance

Priority Policy separates objective temporal facts from constitutional attention decisions.

Time describes when an event occurred.

Importance is not inferred from time.

Recency may provide temporal context and deterministic ordering only within the constitutional boundaries above.

**Recency parameter values:** TODO (Founder Approval Required): Define the Recency window, number of hours, lookback duration, and exact boundary semantics.

Evaluation validity and cache retention are governed by PPV1-030 and PPV1-033. The Constitution defines the role of Recency before defining its unresolved parameter values.

### 6.3 Provider Mapping

Priority Policy operates exclusively on provider-neutral normalized signals.

Provider-specific concepts such as Star, Flag, Category, and equivalent concepts must be translated by provider adapters. The constitutional policy itself shall not depend on provider-specific terminology.

The provider-neutral mapping contract will be defined in [`docs/product/provider-mapping-spec-v1.md`](provider-mapping-spec-v1.md).

**TODO (Future Specification):** Create and approve `docs/product/provider-mapping-spec-v1.md`.

### 6.4 AI Independence

No AI component may directly assign, modify, or reorder Priority Policy tiers.

AI systems may produce recommendations, explanations, summaries, or future assistant suggestions.

Priority Policy remains solely determined by constitutional deterministic rules.

## 7. Reason codes

Every affirmative policy conclusion must be explainable through stable, localization-friendly reason codes and approved human-readable wording.

### PPV1-016 — Evidence-specific reason-code registry

The constitutional reason-code registry is:

| Reason code | Constitutional evidence | Emission dependency |
| --- | --- | --- |
| `USER_PRIORITIZE` | Active Prioritize correction | PPV1-025 |
| `USER_NOT_IMPORTANT` | Active Not Important correction | PPV1-026 |
| `MANUAL_STAR` | Provider-verifiable Manual Star | PPV1-011 |
| `RECENCY` | Objective temporal context | Inactive unless a future Founder-approved rule defines an explanatory constitutional condition |

Reason codes identify approved constitutional evidence. They shall never infer importance, urgency, confidence, or AI judgment.

Registration does not authorize emission before the referenced constitutional condition is approved.

### PPV1-017 — Human-readable reason representation

Each reason shall define:

- a stable localization key;
- canonical Founder-approved English wording.

The Constitution owns semantic meaning. Presentation layers may localize the wording but shall not reinterpret constitutional meaning.

- **PPV1-017A — Localization keys and canonical English wording:** TODO (Founder Approval Required): Approve the exact stable localization key and canonical English wording for each reason code in PPV1-016.

### PPV1-018 — Reason precedence

When simultaneous reasons are emitted, they shall be returned in this constitutional precedence:

1. Active User Correction
2. Manual Star
3. Recency

The applicable Active User Correction reason or reasons are governed by PPV1-025 through PPV1-029.

This ordering preserves the constitutional rule that explicit user intent outranks passive metadata.

### PPV1-019 — Negative reasons

Priority Policy v1 shall retain all applicable authorized affirmative evidence reasons and all active explicit user-correction reasons, including lower-tier supporting reasons, even when another rule determines the final tier.

1. **Affirmative evidence:** An authorized reason may be emitted only when its Founder-approved constitutional condition is satisfied.
2. **Explicit corrections:** An explicit user-correction reason may be emitted only under the approved mapping, active-state semantics, precedence, lifetime, and Undo behavior in PPV1-025 through PPV1-029. Canonical human-readable wording remains governed by PPV1-017A.
3. **Supporting reasons:** A reason associated with a lower individually assigned tier may remain visible when a higher tier wins. Supporting reasons must not be represented as though each one independently determined the final tier.
4. **Prohibited negative inference:** Never emit reasons inferred from absent signals or passive negative conclusions. Prohibited examples include:
   - `NOT_STARRED`
   - `NOT_RECENT`
   - `NOT_IMPORTANT`
   - `SAFE_TO_IGNORE`
   - `NO_ATTENTION_NEEDED`

   Absence of evidence shall not become negative evidence.
5. **Ordering and deduplication:** Reasons shall be deduplicated and ordered under PPV1-018.
6. **Recency:** `RECENCY` remains registered but inactive and shall not be emitted under the currently approved policy.

Implementations must not derive user-facing text from enum names. Codes and wording are separate contract fields.

## 8. Ordering rules

Candidate ordering must be stable and fully deterministic. Database row order, provider response order, object-property order, locale defaults, and asynchronous completion order must never affect the result.

- **PPV1-020 — Tier ordering:** Priority Policy v1 adopts the following strict descending constitutional tier order:
  1. `NEEDS_ATTENTION`
  2. `REVIEW_LATER`
  3. `NO_IMMEDIATE_SIGNALS`

  1. **Tier ordering:** The above order is the sole constitutional ordering of approved tiers. No implementation shall derive ordering from:
     - declaration order;
     - enum values;
     - numeric values;
     - scores;
     - weights;
     - confidence;
     - heuristics;
     - implementation-specific ordering.
  2. **Conflict resolution:** After individual rule evaluation and correction handling under PPV1-025 through PPV1-027, PPV1-012 shall select the highest ordinary-rule tier according to this constitutional order only when no verified active correction fixes the final tier.
  3. **No accumulation:** Multiple assigned tiers shall never accumulate or promote beyond the highest tier actually assigned by an approved constitutional rule.
  4. **Collection grouping:** Primary collection grouping shall follow this constitutional tier order. Candidates within the same final tier remain governed exclusively by PPV1-021.
  5. **Separation of concerns:** This ordering governs only:
     - constitutional tier ordering;
     - final-tier conflict resolution;
     - primary collection grouping.

     It shall not define:

     - rule precedence;
     - reason ordering;
     - within-tier ordering;
     - urgency;
     - objective importance;
     - certainty;
     - confidence;
     - required action.
  6. **Future compatibility:** Any future Founder-approved tier shall require explicit placement within the constitutional ordering before implementation.

  This ordering makes the approved tier semantics executable. It does not redefine those semantics.
- **PPV1-021 — Within-tier comparator:** Priority Policy v1 adopts the following lexicographic within-tier comparator. This comparator applies only after final tier assignment and primary tier grouping under PPV1-020.

  1. **Timestamp availability:** Apply PPV1-023 to determine the placement of candidates whose PPV1-003 candidate timestamp is missing relative to candidates with valid timestamps. PPV1-021 does not resolve that placement.
  2. **Effective candidate timestamp:** For ordering only, derive the effective timestamp using the caller-supplied fixed `evaluatedAt`:
     - candidate timestamp at or before `evaluatedAt` → use the verified candidate timestamp;
     - candidate timestamp after `evaluatedAt` → use `evaluatedAt`, preserving the approved age-zero treatment.

     This evaluation-only comparison key shall not rewrite, normalize, or replace the persisted provider-confirmed timestamp.
  3. **Temporal direction:** Among candidates with valid effective timestamps, sort in descending order:
     - newest verified incoming work first;
     - older verified incoming work later.
  4. **Final identity tie-breaker:** When effective timestamps are equal, apply the PPV1-022 stable identity comparator.
  5. **Prohibited comparators:** Within-tier ordering shall not use:
     - sender;
     - subject;
     - recipients;
     - attachment state;
     - reason count;
     - rule count;
     - label count;
     - provider response order;
     - synchronization order;
     - database row order;
     - insertion order;
     - local created or updated timestamps;
     - scores;
     - weights;
     - confidence;
     - AI inference.
  6. **Constitutional boundaries:** The within-tier comparator:
     - does not affect eligibility;
     - does not assign or change tiers;
     - does not create reasons;
     - does not alter rule precedence;
     - does not imply importance, urgency, or required action.
  7. **Deterministic replay:** Identical constitutional candidate inputs and an identical `evaluatedAt` shall produce identical ordering.

  PPV1-024 remains responsible for excessive future-skew policy. This decision applies only the already approved age-zero treatment to the ordering comparison key and does not resolve PPV1-024's remaining behavior.
- **PPV1-022 — Final identity tie-breaker:** Priority Policy v1 uses the immutable owner-scoped application `threadId` as the final non-semantic tie-breaker.

  1. **Identity:** `threadId` shall be:
     - application-owned;
     - owner-scoped;
     - immutable for the lifetime of the logical thread projection;
     - provider-neutral;
     - distinct from any raw provider identifier.
  2. **Comparator:** Compare `threadId` values using their canonical UUID 16-byte representation in unsigned ascending byte order. The implementation shall not use:
     - locale-sensitive string comparison;
     - database default collation;
     - case folding;
     - provider identifier ordering;
     - insertion order;
     - synchronization order;
     - database row order;
     - runtime iteration order.
  3. **Comparator position:** The `threadId` comparator runs only after PPV1-020 tier ordering and every preceding PPV1-021 within-tier comparison are equal.
  4. **No semantic meaning:** The `threadId` value carries no constitutional or user-facing meaning. It shall not affect:
     - eligibility;
     - tier assignment;
     - reasons;
     - rule precedence;
     - timestamp ordering;
     - importance;
     - urgency.
  5. **Stability:** The application shall preserve the same owner-scoped `threadId` across ordinary synchronization and projection updates.
  6. **Invalid input:** An absent or malformed constitutional `threadId` is invalid evaluator input. The evaluator shall fail safely. It shall not:
     - generate a replacement UUID;
     - fall back to a provider ID;
     - derive an identity from sender or subject;
     - use database or runtime ordering.

  PPV1-022 exists solely to complete a deterministic total order when all higher-order constitutional comparators are equal.
- **PPV1-023 — Missing timestamp ordering:** Priority Policy v1 requires candidates with verified PPV1-003 timestamps to appear before candidates with Unknown timestamps within the same final tier.

  1. **Tier authority:** PPV1-020 tier grouping remains the primary collection order. Timestamp availability shall never move a candidate across tiers.
  2. **Verified temporal evidence:** Within the same final tier, candidates with valid PPV1-003 timestamps appear first. They are ordered under PPV1-021:
     - effective candidate timestamp descending;
     - PPV1-022 `threadId` comparator when effective timestamps are equal.
  3. **Unknown temporal evidence:** Candidates whose PPV1-003 timestamp is Unknown appear after timestamped candidates within the same tier. Unknown-timestamp candidates are ordered solely by the PPV1-022 `threadId` comparator.
  4. **Unknown preservation:** The implementation shall not synthesize or substitute:
     - epoch time;
     - current time;
     - `evaluatedAt`;
     - synchronization time;
     - insertion time;
     - local persistence time;
     - any unrelated timestamp.
  5. **No semantic implication:** Placement after timestamped peers shall not mean or imply that an Unknown-timestamp candidate is:
     - older;
     - less important;
     - lower priority;
     - less urgent;
     - safe to ignore.

     The placement exists only because verified chronological comparison is unavailable.
  6. **Disclosure:** Collections containing Unknown candidate timestamps shall disclose incomplete temporal evidence through PPV1-035. The exact field names, shape, serialization, and user-facing presentation remain governed by PPV1-035 and related UX decisions.
  7. **Future skew:** PPV1-024 remains responsible for determining whether excessively future-skewed timestamps continue to count as valid temporal evidence.

  PPV1-023 completes deterministic ordering without assigning chronology to Unknown evidence.

## 9. Future timestamp handling

The mailbox projection preserves a valid provider timestamp unchanged so repeated synchronization remains deterministic.

During evaluation, if a provider timestamp is later than the fixed `evaluatedAt` instant, the calculated age is clamped to zero. A future timestamp must never create a negative age or additional priority beyond the approved rule for an age of zero.

The evaluator must not rewrite the persisted provider timestamp and must not use the current system clock implicitly.

- **PPV1-024 — Excessive future skew:** Priority Policy v1 defines a single explicit future-skew tolerance parameter.

  **Future-skew tolerance duration:** TODO (Founder Approval Required): Approve the exact duration. The implementation shall not invent, default, or hard-code a duration before that approval.

  1. **Within tolerance:** A valid provider-confirmed candidate timestamp later than `evaluatedAt` but not beyond the approved future-skew tolerance remains valid temporal evidence. For PPV1-021 ordering, its effective timestamp is `evaluatedAt`. The original provider timestamp remains unchanged.
  2. **Beyond tolerance:** A candidate timestamp strictly later than `evaluatedAt` plus the approved tolerance is excessive future skew. For constitutional temporal evaluation, it becomes Unknown.
  3. **Candidate behavior:** Excessive future skew:
     - does not affect eligibility;
     - does not assign or change a tier;
     - emits no reason;
     - does not rewrite provider metadata.

     PPV1-023 governs within-tier placement.
  4. **Disclosure:** Collections containing excessive-future-skew candidates shall disclose incomplete temporal evidence through PPV1-035.
  5. **Recalculation:** PPV1-031 shall govern reevaluation when:
     - `evaluatedAt` advances;
     - provider timestamp metadata changes; or
     - the approved tolerance changes in a future policy version.
  6. **Boundary semantics:** Once the duration is approved:
     - timestamps at exactly `evaluatedAt` plus the tolerance remain valid;
     - timestamps strictly beyond that boundary become Unknown.

  The constitutional excessive-future-skew rule is approved. The exact future-skew tolerance duration remains unresolved and must not be inferred.

## 10. User overrides

Priority Policy v1 reserves three user correction intents:

- Prioritize
- Not Important
- Undo

User Override means only an explicit action intentionally performed by the user.

Behavioral inference, usage history, reopening frequency, hover duration, AI prediction, or similar inferred behavior shall not constitute a User Override.

Corrections must be:

- owner-scoped;
- reversible;
- explicit;
- independent of Gmail labels;
- applied without silently mutating Gmail.

The persistence and product workflow for corrections are outside the current implementation task. Constitutional correction behavior is defined below:

- **PPV1-025 — Prioritize mapping:** Priority Policy v1 maps a verified active Prioritize correction to:
  - `tier`: `NEEDS_ATTENTION`
  - `reasonCode`: `USER_PRIORITIZE`

  1. **Mapping:** A verified active Prioritize correction assigns `NEEDS_ATTENTION` and `USER_PRIORITIZE`.
  2. **Meaning:** This assignment represents only explicit user intent. It shall not imply:
     - objective importance;
     - urgency;
     - certainty;
     - required action;
     - independent constitutional evidence.
  3. **Reason:** `USER_PRIORITIZE` becomes operative only when an active verified Prioritize correction exists. It shall not be emitted from inference, prediction, heuristics, or provider metadata.
  4. **Interaction:** Conflict resolution remains governed by PPV1-027. Lifetime remains governed by PPV1-028. Undo remains governed by PPV1-029. Localization and canonical wording remain governed by PPV1-017A.
  5. **Reevaluation:** PPV1-031 shall require reevaluation whenever a Prioritize correction becomes active, changes, or is removed.

  `NEEDS_ATTENTION` in this case results solely from the user's explicit correction and shall not be interpreted as confirmation of any underlying constitutional signal.
- **PPV1-026 — Not Important mapping:** Priority Policy v1 maps a verified active Not Important correction to:
  - `tier`: `NO_IMMEDIATE_SIGNALS`
  - `reasonCode`: `USER_NOT_IMPORTANT`

  1. **Mapping:** A verified active Not Important correction assigns `NO_IMMEDIATE_SIGNALS` and `USER_NOT_IMPORTANT`.
  2. **Meaning:** This assignment represents only explicit user intent. It means the user intentionally chose not to have the candidate presented in a higher attention tier while the correction is active. It shall not imply that the candidate is:
     - objectively unimportant;
     - irrelevant;
     - safe to ignore;
     - incapable of requiring human judgment;
     - negatively classified by AI or provider metadata.
  3. **Reason:** `USER_NOT_IMPORTANT` becomes operative only when an authoritative verified active Not Important correction exists. It shall not be emitted from:
     - absent signals;
     - passive metadata;
     - inference;
     - prediction;
     - heuristics;
     - provider importance;
     - AI judgment.
  4. **Conflict handling:** PPV1-027 remains responsible for conflicts involving Prioritize, Not Important, Manual Star, and ordinary constitutional signals. PPV1-026 approves the isolated mapping only.
  5. **Lifecycle:** PPV1-028 remains responsible for correction lifetime. PPV1-029 remains responsible for Undo semantics. PPV1-031 shall require reevaluation whenever the correction becomes active, changes, or becomes inactive through an approved transition.
  6. **Wording:** PPV1-017A remains responsible for the localization key and canonical Founder-approved English wording.

  `NO_IMMEDIATE_SIGNALS` in this case results from the user's explicit correction. It does not represent absence of evidence and must remain distinguishable from the PPV1-009 default outcome through `USER_NOT_IMPORTANT`.
- **PPV1-027 — Override precedence:** Priority Policy v1 adopts exclusive active-correction dominance.

  1. **Authoritative correction resolution:** Resolve the authoritative owner-scoped correction state before ordinary final-tier conflict resolution.
  2. **Exactly one verified active correction:** When exactly one verified active correction exists:
     - **Prioritize:**
       - fixes the final tier at `NEEDS_ATTENTION`;
       - emits `USER_PRIORITIZE`.
     - **Not Important:**
       - fixes the final tier at `NO_IMMEDIATE_SIGNALS`;
       - emits `USER_NOT_IMPORTANT`.

     The correction-assigned tier is final while that correction remains active.
  3. **Ordinary constitutional rules:** Ordinary rules continue evaluating so that all applicable authorized evidence remains truthfully available as supporting reasons. Ordinary rules shall not alter the correction-assigned final tier.
  4. **No verified active correction:** When authoritative correction state confirms that no active correction exists, ordinary rules determine the final tier under PPV1-012.
  5. **Conflicting or ambiguous correction state:** Correction state becomes Unknown under PPV1-004D if:
     - Prioritize and Not Important are both active;
     - correction state is internally contradictory;
     - correction authority cannot be determined; or
     - correction metadata is otherwise ambiguous.

     In that state:

     - apply no correction mapping;
     - continue evaluating all correction-independent rules;
     - disclose incomplete user-correction evidence through PPV1-035;
     - do not infer which correction is newer, stronger, or intended.
  6. **Reasons:** All authorized applicable reasons remain governed by PPV1-019. Reason ordering remains governed by PPV1-018, with the active correction reason first when exactly one verified active correction exists. Supporting reasons must not be presented as though they determined the final tier.
  7. **Prohibited precedence mechanisms:** The implementation shall not resolve correction conflicts through:
     - highest tier wins;
     - latest timestamp wins;
     - database row order;
     - insertion order;
     - synchronization order;
     - provider order;
     - AI inference;
     - heuristics;
     - confidence;
     - scoring.
  8. **Lifecycle:** PPV1-028 remains responsible for when a correction is active. PPV1-029 remains responsible for Undo semantics. PPV1-031 shall require reevaluation whenever authoritative correction state changes.

  Verified user intent governs the final attention tier. It does not erase independently verified constitutional evidence.
- **PPV1-028 — Override lifetime:** Priority Policy v1 adopts indefinite correction lifetime.

  1. **Lifetime:** A verified active correction remains active indefinitely until the owner explicitly:
     - performs Undo under PPV1-029; or
     - replaces it through an authoritative atomic transition.
  2. **No automatic expiration:** Priority Policy v1 defines no automatic expiration. The following shall not create, extend, suspend, expire, or remove a correction:
     - new incoming messages;
     - outgoing replies;
     - drafts;
     - archive;
     - Inbox restoration;
     - label changes;
     - read/unread changes;
     - provider synchronization;
     - provider history advancement;
     - projection updates;
     - reevaluation;
     - application restart;
     - elapsed time.
  3. **Eligibility independence:** Correction lifetime is independent of candidate eligibility. Eligibility determines only whether the correction participates in evaluation. A correction continues to exist even while its thread is temporarily outside PPV1-001 candidate scope. If the same logical thread later becomes eligible again, the existing correction applies.
  4. **Reevaluation:** PPV1-031 may observe lifecycle changes. Reevaluation itself shall never create, extend, expire, suspend, or remove a correction.
  5. **Future amendments:** A future policy version may introduce expiration only through explicit Founder approval defining:
     - the triggering condition;
     - migration behavior;
     - treatment of existing corrections;
     - disclosure requirements;
     - recalculation requirements.

     Implementations shall not invent expiration behavior before such approval.
  6. **Existing authorities:** PPV1-027 continues to govern precedence while active. PPV1-029 continues to govern Undo.

  Explicit user intent remains authoritative until explicit user intent changes.
- **PPV1-029 — Undo semantics:** Priority Policy v1 defines Undo as an idempotent atomic deactivation of the authoritative active correction.

  1. **Target:** Undo applies only to the authoritative verified active correction for the owner-scoped thread.
  2. **State transition:** A successful Undo transitions that correction from active to inactive or undone. The correction's immutable historical record remains preserved.
  3. **No historical reactivation:** Undo shall not:
     - reactivate a previous correction;
     - restore a correction stack;
     - restore an earlier tier result;
     - restore a cached evaluation snapshot;
     - infer prior user intent.
  4. **Active-state result:** After a successful authoritative Undo:
     - correction state becomes verified active-absent;
     - PPV1-027 correction dominance ends;
     - the undone correction reason is no longer emitted.
  5. **Reevaluation:** The candidate shall be reevaluated from current constitutional evidence. Ordinary rules determine the final tier under PPV1-012 unless another authoritative active correction exists through a separate approved transition.
  6. **Historical records:** Inactive and undone correction records remain auditable. They are historical evidence of past user actions, but they are non-operative evaluator inputs.
  7. **Idempotency:** Repeating Undo for the same already-undone correction creates no additional constitutional effect. It shall not create duplicate history, reactivate another correction, or alter the resulting tier beyond any required deterministic reevaluation.
  8. **Failed or ambiguous Undo:** A failed, incomplete, or ambiguous persistence transition shall not establish verified absence. Correction state remains Unknown under PPV1-004D until authoritative state is confirmed. PPV1-035 governs incomplete-correction-evidence disclosure.
  9. **Existing authorities:** PPV1-027 governs correction precedence before Undo. PPV1-028 governs correction lifetime. PPV1-031 shall require reevaluation after a confirmed Undo transition. PPV1-041 remains responsible for user-facing correction and Undo wording.

  Undo changes authority going forward. It does not rewrite history or automatically restore earlier intent.

## 11. Freshness policy

An evaluation is a statement about a specific normalized projection at a specific `evaluatedAt` instant. It must not be presented as current after its inputs become stale.

- **PPV1-030 — Evaluation validity interval:** Priority Policy v1 defines exactly one Founder-approved evaluation-validity interval.

  **Founder-approved evaluation-validity interval:** 5 minutes

  1. **Current boundary:** An evaluation may be represented as current only through `evaluatedAt` plus the Founder-approved evaluation-validity interval.
  2. **Inclusive boundary:** The interval boundary is inclusive. Strictly after that boundary, the evaluation is stale.
  3. **Immediate invalidation:** Any PPV1-031 trigger invalidates the evaluation immediately regardless of elapsed time.
  4. **Timestamp integrity:** Reformatting, serialization, rereading, cache retrieval, or transport shall never advance `evaluatedAt`. Only deterministic reevaluation may produce a new `evaluatedAt`.
  5. **Separation of concerns:** Evaluation freshness shall remain independent from:
     - synchronization readiness;
     - provider freshness;
     - candidate coverage;
     - evidence completeness.
  6. **Existing authorities:** PPV1-032 governs stale presentation. PPV1-033 governs cache behavior.
  7. **Evaluator purity:** The evaluator shall continue using only its caller-supplied fixed `evaluatedAt`.
  8. **Implementation requirement:** Implementations shall use the Founder-approved evaluation-validity interval and shall not invent, substitute, or locally configure another duration.
- **PPV1-031 — Recalculation triggers:** Priority Policy v1 adopts semantic normalized-input invalidation. An evaluation shall be invalidated immediately whenever an authoritative change could alter:
  - candidate membership;
  - final tier;
  - emitted reasons;
  - deterministic ordering;
  - correction authority;
  - evidence completeness;
  - synchronization coverage;
  - collection truthfulness;
  - policy identity or approved parameters.

  1. **Evaluation-validity expiration:** Expiration of the PPV1-030 Founder-approved evaluation-validity interval requires recalculation before the result may again be represented as current.
  2. **Policy identity and parameter changes:** Invalidate when:
     - `policyVersion` changes;
     - any Founder-approved parameter affecting evaluation changes;
     - the future-skew tolerance changes;
     - a constitutional rule becomes newly operative, changes, or is removed under a new approved policy version.
  3. **Candidate-scope changes:** Invalidate when:
     - verified Inbox membership changes;
     - verified Spam or Trash membership changes;
     - a thread enters or leaves PPV1-001 scope;
     - a normalized candidate is added, removed, merged, or replaced;
     - authoritative synchronization coverage discovers or removes an eligible candidate.
  4. **Operative candidate-input changes:** Invalidate when:
     - the PPV1-003 candidate timestamp changes;
     - verified incoming-message direction changes;
     - timestamp state changes between valid and Unknown;
     - future-skew classification changes;
     - Manual Star changes between verified present, verified absent, and Unknown;
     - any future Founder-approved operative constitutional input changes.
  5. **Correction-state changes:** Invalidate when:
     - Prioritize becomes active;
     - Not Important becomes active;
     - one correction is authoritatively replaced by another;
     - Undo is authoritatively confirmed;
     - correction state becomes ambiguous or Unknown;
     - Unknown correction state becomes authoritative;
     - active correction authority otherwise changes.
  6. **Evidence-completeness changes:** Invalidate when policy-relevant evidence becomes available, unavailable, malformed, or changes state, including:
     - candidate timestamp evidence;
     - policy-relevant label evidence;
     - correction evidence;
     - any field-level state represented through PPV1-035.
  7. **Collection-state changes:** Invalidate when:
     - synchronization readiness changes;
     - coverage changes between partial and ready;
     - the authoritative checkpoint changes in a way that alters normalized constitutional inputs or coverage;
     - collection-level evidence-completeness state changes.
  8. **Invalidation scope:** A candidate-level trigger invalidates:
     - the affected candidate evaluation;
     - any collection ordering containing that candidate;
     - any collection envelope derived from the invalidated state.

     A collection-level trigger invalidates the affected collection representation.
  9. **Recalculation requirements:** Recalculation shall use:
     - one internally consistent normalized snapshot;
     - the applicable `policyVersion` and approved parameters;
     - a new caller-supplied fixed `evaluatedAt`.

     Only completed deterministic reevaluation may produce a replacement current result.
  10. **Non-triggers:** The following shall not independently require recalculation when normalized constitutional inputs and collection truth remain unchanged:
      - provider history identifiers alone;
      - synchronization timestamps alone;
      - watch-renewal timestamps;
      - projection-write timestamps;
      - database created or updated timestamps;
      - repeated synchronization with identical normalized results;
      - cache retrieval;
      - serialization;
      - transport;
      - UI navigation;
      - provider response order;
      - sender, recipient, or attachment metadata while constitutionally non-operative;
      - message bodies, snippets, or attachment content.
  11. **No hidden mutation:** Recalculation observes authoritative changes. It shall not itself create, modify, expire, undo, or repair provider facts or user corrections.

  Operational activity is not a constitutional trigger merely because it occurred. Only a change to constitutional inputs, authority, coverage, completeness, policy identity, or validity status requires recalculation.
- **PPV1-032 — Stale presentation:** Priority Policy v1 adopts conditional stale visibility.

  1. **Presentation state:** Staleness is a presentation state rather than an evaluation state. A completed deterministic evaluation remains immutable after completion. Becoming stale changes only whether and how that evaluation may be represented. It shall not modify the evaluation's:
     - constitutional outputs;
     - `evaluatedAt`;
     - `policyVersion`;
     - candidate ordering;
     - tiers;
     - reasons;
     - readiness;
     - coverage;
     - evidence completeness;
     - any other evaluated fact.
  2. **Permitted stale visibility:** A stale evaluation may remain visible only when it is the last successfully completed deterministic evaluation and staleness results from:
     - PPV1-030 interval expiration without a known semantic input change; or
     - temporary provider or synchronization unavailability without evidence that the evaluated normalized snapshot changed.
  3. **Required preservation and disclosure:** A visible stale result must:
     - be explicitly identified as stale;
     - preserve its original `evaluatedAt`;
     - preserve its original `policyVersion`;
     - preserve its original readiness, coverage, and evidence-completeness state;
     - never be represented as current;
     - never have its timestamp refreshed by retrieval or presentation;
     - remain subject to PPV1-033 retention limits;
     - be replaced only by completed deterministic reevaluation.
  4. **Known invalidation:** A stale result shall be withheld when a known PPV1-031 trigger establishes that its constitutional state may no longer be accurate, including:
     - authoritative correction changes;
     - known candidate-scope changes;
     - known operative evidence changes;
     - known collection-coverage changes;
     - `policyVersion` changes;
     - approved parameter changes.
  5. **Scoped invalidation:** A known candidate-level change requires withholding:
     - the affected candidate evaluation;
     - any ordering derived from it;
     - any collection envelope derived from it.

     Unrelated independently valid information need not be withheld if it can still be represented truthfully without the invalidated derived state.
  6. **No truth upgrade:** Stale presentation shall not upgrade partial coverage, incomplete evidence, unavailable provider state, or any other limitation recorded by the completed evaluation.
  7. **Existing authorities:** PPV1-033 governs retention. PPV1-035 governs exact stale-state representation. PPV1-039 governs user-facing stale and unavailable wording.
- **PPV1-033 — Cache policy:** Priority Policy v1 adopts exact owner-scoped immutable cache identity.

  1. **Cache identity:** Each cached evaluation shall bind to:
     - authenticated owner identity;
     - mailbox identity;
     - exact candidate-scope identity;
     - `policyVersion`;
     - complete Founder-approved parameter set;
     - exact normalized constitutional input-snapshot identity;
     - authoritative correction-state identity;
     - synchronization readiness and coverage identity;
     - evidence-completeness identity;
     - original `evaluatedAt`.

     Cached evaluations shall never cross owners, mailboxes, policy versions, parameter sets, scopes, correction states, coverage states, or constitutional input snapshots.
  2. **Immutability:** A cached evaluation is immutable. Cache retrieval, serialization, transport, display, or provider unavailability shall not modify:
     - `evaluatedAt`;
     - `policyVersion`;
     - tiers;
     - reasons;
     - ordering;
     - readiness;
     - coverage;
     - evidence completeness;
     - constitutional inputs;
     - retention boundaries.
  3. **Current use:** A compatible cached entry may be presented as current only while:
     - PPV1-030 permits; and
     - no PPV1-031 trigger has invalidated it.
  4. **Stale use:** After PPV1-030 expiration, the same immutable entry may be presented only when PPV1-032 permits conditional stale visibility.
  5. **Founder-approved stale-retention interval:** Priority Policy v1 defines exactly one Founder-approved stale-retention interval.

     **Founder-approved stale-retention interval:** 24 hours from the original `evaluatedAt`

     The boundary is inclusive:

     - at exactly `evaluatedAt` plus 24 hours, the entry remains within retention;
     - strictly after that boundary, it shall not be presented and shall be evicted from the evaluation cache.

     Implementations shall not invent, substitute, extend, or locally configure another duration.
  6. **No sliding retention:** Retrieval, use, transport, serialization, display, cache access, application restart, or provider unavailability shall not extend the current-validity or stale-retention interval.
  7. **Immediate semantic invalidation:** A PPV1-031 trigger immediately removes the affected entry from both current and stale presentation eligibility. Known-invalid entries shall never be used as PPV1-032 stale fallback, even if physical deletion is asynchronous.
  8. **Cache authority:** Cache is an optimization and never a source of constitutional truth. A cache miss does not alter evaluation semantics. A cache failure shall result only in:
     - deterministic reevaluation; or
     - truthful unavailability.
  9. **Privacy and identity boundaries:** Cache keys and entries shall not expose or derive identity from:
     - message bodies;
     - snippets;
     - subjects;
     - recipients;
     - authentication tokens;
     - raw provider payloads;
     - raw provider identifiers.

     Application-owned `threadId` values may appear only within their authorized owner-scoped cached evaluations.
  10. **Policy compatibility:** A `policyVersion` or Founder-approved parameter change invalidates every incompatible cached entry.
  11. **No claim upgrades:** Stale retention shall never upgrade:
      - synchronization readiness;
      - candidate coverage;
      - evidence completeness;
      - freshness;
      - provider availability.

  Cache may preserve an immutable last-known evaluation. It may never preserve that evaluation's authority after a known constitutional invalidation.

An implementation must always expose `evaluatedAt` and `policyVersion`. Cached evaluations must be scoped to the authenticated owner and exact policy inputs.

## 12. Attention Contract v1

The evaluation contract is a pure data contract. It does not define an HTTP route, database schema, persistence model, or background job.

At minimum, one evaluated candidate returns:

```text
threadId
tier
reasonCodes
reasons
policyVersion
evaluatedAt
```

Contract invariants:

- `threadId` is the application's owner-scoped thread identifier, not a raw provider payload.
- `tier` is one approved tier identifier.
- `reasonCodes` is an ordered list of approved stable identifiers.
- `reasons` is an ordered list of approved human-readable strings corresponding one-to-one with `reasonCodes`.
- `policyVersion` is `1.0`.
- `evaluatedAt` is the caller-supplied fixed instant used for the complete evaluation.
- No confidence score, inferred urgency, raw Gmail response, message content, or hidden diagnostic is returned.
- Identical normalized input and identical `evaluatedAt` produce an identical evaluation object.

Collection contract decisions:

- **PPV1-034 — Candidate-scope disclosure:** Priority Policy v1 adopts the following provider-neutral structured `candidateScope` object:

  ```text
  candidateScope: {
    entityType: "THREAD",
    ownerScope: "AUTHENTICATED_OWNER",
    mailboxScope: "REQUESTED_MAILBOX",
    locationKnowledge: "VERIFIED",
    requiredPresentLocations: ["INBOX"],
    requiredAbsentLocations: ["SPAM", "TRASH"],
    additionalLocationMembership: "DOES_NOT_DISQUALIFY",
    temporalLookback: "UNBOUNDED",
    candidateCountLimit: "UNBOUNDED"
  }
  ```

  1. **Entity type:** `entityType` shall be `THREAD`. The policy evaluates logical owner-scoped thread projections, not individual messages.
  2. **Owner boundary:** `ownerScope` shall be `AUTHENTICATED_OWNER`. This communicates owner isolation without exposing owner identity in the scope object.
  3. **Mailbox boundary:** `mailboxScope` shall be `REQUESTED_MAILBOX`. The collection applies only to the authorized mailbox represented by the response.
  4. **Location knowledge:** `locationKnowledge` shall be `VERIFIED`. Location eligibility requires authoritative provider-neutral normalized location evidence.
  5. **Required present location:** `requiredPresentLocations` shall contain exactly:
     - `INBOX`

     A candidate must have verified normalized Inbox membership.
  6. **Required absent locations:** `requiredAbsentLocations` shall contain exactly:
     - `SPAM`
     - `TRASH`

     A candidate must have verified absence from those locations.
  7. **Additional locations:** `additionalLocationMembership` shall be `DOES_NOT_DISQUALIFY`. Sent, Draft, or other additional location participation shall not disqualify an otherwise eligible Inbox thread.
  8. **Temporal scope:** `temporalLookback` shall be `UNBOUNDED`. The contract shall not use `null`, omission, zero, or a numeric sentinel to represent this rule.
  9. **Candidate-count scope:** `candidateCountLimit` shall be `UNBOUNDED`. This represents constitutional eligibility only and shall not be interpreted as proof that every eligible candidate was discovered, evaluated, or delivered in one response.
  10. **Separation from collection state:** `candidateScope` describes eligibility rules only. It shall not contain or imply:
      - synchronization readiness;
      - partial or complete coverage;
      - pagination state;
      - batching state;
      - streaming state;
      - delivery completeness;
      - freshness;
      - evidence completeness.

      PPV1-035 remains the sole authority for those collection-level facts.
  11. **Provider neutrality:** The normalized identifiers `INBOX`, `SPAM`, and `TRASH` are constitutional concepts. Provider-specific labels and mappings remain governed by the future Provider Mapping Specification.
  12. **Deterministic representation:** Field names and enum values shall be canonical. Array ordering shall be deterministic and exactly as constitutionally defined.

  An `UNBOUNDED` constitutional scope does not claim that the current collection contains every eligible candidate. It means the policy itself imposes no temporal or candidate-count cutoff.
- **PPV1-035 — Collection envelope:** Priority Policy v1 adopts a collection envelope that separates immutable evaluation facts from mutable presentation state.

  Canonical structure:

  ```text
  {
    evaluation: {
      policyVersion,
      evaluatedAt,
      validThrough,
      staleRetentionThrough,
      candidateScope,
      synchronization: {
        coverage: "READY" | "PARTIAL"
      },
      evidenceCompleteness: {
        state: "COMPLETE" | "INCOMPLETE",
        incompleteEvidence: [
          {
            kind:
              "CANDIDATE_TIMESTAMP"
              | "POLICY_LABELS"
              | "USER_CORRECTIONS",
            affectedCandidateCount
          }
        ]
      },
      delivery: {
        state: "COMPLETE" | "PARTIAL",
        evaluatedCandidateCount,
        returnedCandidateCount,
        continuationAvailable
      },
      ordering: {
        scheme: "PRIORITY_POLICY_V1"
      },
      candidates
    },

    presentation:
      {
        state: "CURRENT",
        presentedAt,
        providerAvailability:
          "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN"
      }
      |
      {
        state: "STALE",
        presentedAt,
        staleCause:
          "VALIDITY_EXPIRED"
          | "PROVIDER_UNAVAILABLE"
          | "SYNCHRONIZATION_UNAVAILABLE",
        providerAvailability:
          "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN"
      }
  }
  ```

  1. **Immutable evaluation:** The `evaluation` object becomes immutable when deterministic evaluation completes. Presentation changes shall never mutate:
     - `policyVersion`;
     - `evaluatedAt`;
     - `validThrough`;
     - `staleRetentionThrough`;
     - `candidateScope`;
     - synchronization coverage;
     - evidence completeness;
     - delivery facts;
     - ordering;
     - candidates;
     - candidate tiers or reasons.
  2. **Mutable presentation state:** The `presentation` object communicates whether and how the immutable evaluation is being shown. It may change from `CURRENT` to `STALE` only when PPV1-032 permits. Presentation changes do not create a new evaluation.
  3. **Policy identity and timestamps:** `policyVersion` identifies the exact constitutional policy used. `evaluatedAt` is the original fixed evaluation time. `validThrough` shall be deterministically derived from:
     - `evaluatedAt`; and
     - the Founder-approved PPV1-030 evaluation-validity interval.

     `staleRetentionThrough` shall be deterministically derived from:

     - `evaluatedAt`; and
     - the Founder-approved PPV1-033 stale-retention interval.

     PPV1-035 shall not duplicate or independently redefine those parameter values.
  4. **Candidate scope:** `candidateScope` shall be exactly the PPV1-034 canonical object. It describes constitutional eligibility only.
  5. **Synchronization coverage:** `synchronization.coverage` shall be:
     - `READY` when PPV1-005 authoritative candidate coverage is established;
     - `PARTIAL` otherwise when partial results are truthfully represented.

     Coverage shall not redefine candidate eligibility.
  6. **Evidence completeness:** `evidenceCompleteness.state` shall be `COMPLETE` only when no represented candidate has incomplete operative constitutional evidence. Otherwise it shall be `INCOMPLETE`.

     `incompleteEvidence` kinds are canonical and ordered exactly as follows:

     1. `CANDIDATE_TIMESTAMP`
     2. `POLICY_LABELS`
     3. `USER_CORRECTIONS`

     Entries shall be deduplicated. `affectedCandidateCount` counts affected candidates represented in that immutable evaluation. It shall not imply complete mailbox coverage when `synchronization.coverage` is `PARTIAL`. When `state` is `COMPLETE`, `incompleteEvidence` shall be an empty array.
  7. **Delivery state:** `delivery.state` shall distinguish whether the immutable evaluation's results were completely returned. `evaluatedCandidateCount` counts candidates evaluated in the represented immutable evaluation. `returnedCandidateCount` counts candidate entries included in the current delivery. `continuationAvailable` communicates whether additional results from the same immutable evaluation remain retrievable. Pagination, batching, streaming, and progressive delivery shall not redefine eligibility or synchronization coverage.
  8. **Ordering:** `ordering.scheme` shall be `PRIORITY_POLICY_V1`. This certifies that PPV1-020 through PPV1-023 govern candidate ordering.
  9. **Presentation current state:** `CURRENT` presentation shall contain:
     - `presentedAt`;
     - `providerAvailability`.

     `CURRENT` shall be permitted only while PPV1-030 and PPV1-031 allow the evaluation to be represented as current.
  10. **Presentation stale state:** `STALE` presentation shall contain:
      - `presentedAt`;
      - `staleCause`;
      - `providerAvailability`.

      `staleCause` shall be exactly one of:

      - `VALIDITY_EXPIRED`
      - `PROVIDER_UNAVAILABLE`
      - `SYNCHRONIZATION_UNAVAILABLE`

      `STALE` shall be permitted only under PPV1-032. Known semantic invalidation shall not be represented through `STALE`.
  11. **Provider availability:** `providerAvailability` describes presentation-time provider access only. It shall not modify or upgrade:
      - synchronization coverage;
      - evaluation freshness;
      - candidate scope;
      - evidence completeness;
      - delivery completeness.
  12. **Expired results:** An evaluation strictly beyond `staleRetentionThrough` shall not be presented. No `EXPIRED` presentation state is required. The system shall instead provide a truthful unavailable or no-presentable-evaluation response under the applicable contract and UX rules.
  13. **Timestamp serialization:** All timestamps shall use PPV1-037 canonical RFC 3339 UTC serialization with millisecond precision.
  14. **Empty collections:** An empty `candidates` array remains a valid evaluation result when PPV1-006 permits it. The envelope must preserve the readiness, coverage, evidence, delivery, freshness, and presentation facts explaining that empty result.
  15. **Privacy and provider neutrality:** The envelope shall not expose:
      - raw provider identifiers;
      - owner identifiers;
      - mailbox addresses;
      - authentication tokens;
      - message bodies;
      - snippets;
      - raw provider payloads;
      - implementation diagnostics.
  16. **Deterministic representation:** Field names, enum values, array ordering, and conditional field presence shall be canonical and versioned.

  The collection envelope communicates several independent constitutional dimensions. No single status field shall collapse eligibility, coverage, evidence completeness, delivery, freshness, or provider availability into one aggregate meaning.

### PPV1-036 — No-reason representation

Empty `reasonCodes` and `reasons` arrays are permitted only for the `NO_IMMEDIATE_SIGNALS` tier when no affirmative constitutional evidence exists.

The evaluator must not fabricate synthetic evidence. Absence of affirmative evidence shall not itself become affirmative evidence.

### PPV1-037 — Contract timestamp format

All constitutional timestamps use RFC 3339 UTC serialization with millisecond precision.

The canonical format is:

```text
YYYY-MM-DDTHH:mm:ss.sssZ
```

The `evaluatedAt` output shall conform exactly to this canonical representation.

## 13. UX contract

The interface must:

- use calm, honest language;
- explain the evidence behind every recommendation;
- distinguish evidence from certainty;
- avoid exaggerated confidence;
- disclose bounded or stale candidate scope;
- leave the final judgment with the user;
- make correction and Undo behavior understandable;
- remain accessible by keyboard and assistive technology.

The interface must not:

- claim that the policy understands message content or intent;
- imply that lower-tier mail is unimportant in an absolute sense;
- use anxiety-inducing urgency language without explicit approved evidence;
- conceal why a thread was included;
- silently change Gmail labels.

- **PPV1-038 — Tier display labels:** Priority Policy v1 adopts the following canonical English display labels:

  | Constitutional identifier | Canonical English display label |
  |---|---|
  | `NEEDS_ATTENTION` | Needs attention |
  | `REVIEW_LATER` | Review later |
  | `NO_IMMEDIATE_SIGNALS` | No immediate signals |

  Constitutional rules:

  1. Display labels do not change tier identifiers or semantics.
  2. “Needs attention” communicates evidence-based guidance, not urgency, certainty, objective importance, or required action.
  3. “Review later” does not establish a deadline or imply that review is mandatory.
  4. “No immediate signals” does not mean unimportant, irrelevant, safe to ignore, or requiring no human judgment.
  5. Presentation layers may localize these labels but shall preserve their constitutional meaning.
  6. Localization shall preserve constitutional meaning rather than literal English wording. Localized labels shall not strengthen, weaken, or otherwise alter the constitutional semantics of the approved English display labels.
  7. Explanatory and empty-state wording remains governed separately by PPV1-039 and PPV1-040.
  8. Correction wording remains governed by PPV1-041.
- **PPV1-039 — Empty-state copy:** Priority Policy v1 adopts the following canonical English state-qualified copy.

  1. **Synchronization-ready empty evaluation**

     Condition:

     - `synchronization.coverage` is `READY`;
     - `delivery.state` is `COMPLETE`;
     - `candidates` is empty;
     - `presentation.state` is `CURRENT`.

     Title:

     > No candidates to show

     Description:

     > No threads satisfy the current Priority Policy candidate scope in this synchronization-ready snapshot.

  2. **Partial empty evaluation**

     Condition:

     - `synchronization.coverage` is `PARTIAL`;
     - no candidates are currently represented.

     Title:

     > Results are incomplete

     Description:

     > No candidates are represented in this partial snapshot. Additional eligible threads may still be found.

  3. **Stale because validity expired**

     Condition:

     - `presentation.state` is `STALE`;
     - `staleCause` is `VALIDITY_EXPIRED`.

     Title:

     > Showing an earlier evaluation

     Description:

     > These results were evaluated at {evaluatedAt} and are no longer current.

  4. **Stale because the provider is unavailable**

     Condition:

     - `presentation.state` is `STALE`;
     - `staleCause` is `PROVIDER_UNAVAILABLE`.

     Title:

     > Showing an earlier evaluation

     Description:

     > Your email provider is temporarily unavailable. Showing the last permitted evaluation from {evaluatedAt}.

  5. **Stale because synchronization is unavailable**

     Condition:

     - `presentation.state` is `STALE`;
     - `staleCause` is `SYNCHRONIZATION_UNAVAILABLE`.

     Title:

     > Showing an earlier evaluation

     Description:

     > Synchronization is temporarily unavailable. Showing the last permitted evaluation from {evaluatedAt}.

  6. **No presentable evaluation**

     Condition:

     - no current evaluation exists;
     - no stale evaluation is permitted under PPV1-032 and PPV1-033.

     Title:

     > Attention view unavailable

     Description:

     > No current or permitted previous evaluation can be shown. Try again later.

  7. **Timestamp representation:** `{evaluatedAt}` shall represent the exact PPV1-037 instant. Interfaces may use an accessible localized representation of the same instant. They shall not alter or approximate the underlying instant.
  8. **Localization:** Localization may adapt grammar and natural phrasing while preserving constitutional meaning. Localized copy shall not strengthen, weaken, omit, or alter claims about:
     - readiness;
     - coverage;
     - freshness;
     - evidence completeness;
     - provider availability;
     - candidate scope.
  9. **Prohibited claims:** Ready empty copy shall not use or imply:
     - Inbox zero;
     - All caught up;
     - Nothing important;
     - Nothing needs attention;
     - The mailbox is empty;
     - The user has no work.

     Partial empty copy shall explicitly communicate that additional eligible candidates may still exist. Stale copy shall explicitly communicate that the displayed evaluation is not current. Unavailable copy shall not be presented as an empty candidate result.
  10. **Supplemental interface elements:** Interfaces may add:
      - a retry control;
      - synchronization progress;
      - a loading indicator;
      - accessible supporting context.

      Those elements shall not replace, contradict, or weaken the canonical state disclosure.
  11. **“Try again later” boundary:** “Try again later” is general recovery guidance. It does not promise that availability will recover within a particular duration.
  12. **Existing authority:** PPV1-040 remains responsible for broader candidate-scope explanation.

  State copy explains what the system constitutionally knows about the displayed collection. It shall never convert uncertainty, partial coverage, staleness, or unavailability into a stronger claim.
- **PPV1-040 — Scope disclosure copy:** Priority Policy v1 adopts a layered disclosure consisting of:

  1. an always-available candidate-scope statement;
  2. an expanded scope explanation;
  3. a state-qualified coverage statement derived from PPV1-035.

  **Canonical scope statement**

  > This view evaluates threads currently in your Inbox, excluding Spam and Trash.

  **Canonical expanded scope explanation**

  > Priority Policy applies no age or candidate-count cutoff. Archived-only, Sent-only, Draft-only, Spam, and Trash threads are outside this view. A thread remains eligible when it is in the Inbox even if the conversation also includes sent messages or drafts.

  1. **Synchronization-ready and completely delivered**

     Condition:

     - `synchronization.coverage` is `READY`;
     - `delivery.state` is `COMPLETE`.

     Canonical coverage statement:

     > This evaluation represents the complete synchronized candidate scope for its authoritative synchronization snapshot.

  2. **Synchronization-ready and partially delivered**

     Condition:

     - `synchronization.coverage` is `READY`;
     - `delivery.state` is `PARTIAL`.

     Canonical coverage statement:

     > The synchronized candidate scope was evaluated, but this view shows only part of its results. Additional results may be available.

  3. **Partial synchronization and completely delivered**

     Condition:

     - `synchronization.coverage` is `PARTIAL`;
     - `delivery.state` is `COMPLETE`.

     Canonical coverage statement:

     > This view includes all candidates represented in a partial synchronization snapshot. Additional eligible Inbox threads may still exist.

  4. **Partial synchronization and partially delivered**

     Condition:

     - `synchronization.coverage` is `PARTIAL`;
     - `delivery.state` is `PARTIAL`.

     Canonical coverage statement:

     > Synchronization is partial, and this view shows only part of the represented results. Additional eligible Inbox threads may still exist.

  Constitutional rules:

  1. “Unbounded” describes policy eligibility, not synchronization or delivery completeness.
  2. Pagination, batching, streaming, caching, and progressive delivery must not be described as eligibility limits.
  3. A ready snapshot establishes coverage only at its authoritative synchronization checkpoint.
  4. Coverage statements describe only the represented immutable evaluation snapshot. They shall not be interpreted as guarantees about future synchronization results, future evaluations, or future candidate availability.
  5. Scope disclosure must not imply currentness when presentation is stale.
  6. PPV1-039 state copy remains authoritative for empty, stale, and unavailable states.
  7. The scope and coverage disclosure supplements PPV1-039 and must not contradict it.
  8. Provider-specific labels may be translated into familiar interface terms, but constitutional behavior remains provider-neutral.
  9. Localization may adapt grammar while preserving every claim about eligibility, exclusions, coverage, and delivery.
  10. The interface may progressively disclose the expanded explanation, but the concise scope and applicable coverage statement must remain accessible, including to assistive technology.
- **PPV1-041 — Correction copy:** Priority Policy v1 adopts lifecycle-qualified canonical English copy.

  **Persistent correction disclosure**

  > These choices affect only your Priority Policy result. They do not change your email provider's labels.

  **Action labels**

  | Action | Canonical label |
  |---|---|
  | Create or replace with Prioritize | Prioritize |
  | Create or replace with Not Important | Not important |
  | Deactivate the active correction | Undo correction |

  1. **Correction request pending**

     Title:

     > Saving your correction

     Description:

     > Your correction has not yet been authoritatively confirmed.

     The interface must not update the confirmed tier or reason solely from this pending state. Interfaces shall not animate, celebrate, or otherwise imply successful correction persistence before authoritative confirmation.

  2. **Prioritize confirmed**

     Condition:

     - an authoritative owner-scoped transition confirms exactly one active Prioritize correction;
     - the resulting evaluation is confirmed.

     Title:

     > Moved to Needs attention

     Description:

     > Your Prioritize correction is active for this thread. It remains active until you undo or replace it.

  3. **Not Important confirmed**

     Condition:

     - an authoritative owner-scoped transition confirms exactly one active Not Important correction;
     - the resulting evaluation is confirmed.

     Title:

     > Moved to No immediate signals

     Description:

     > Your Not Important correction is active for this thread. This reflects your explicit choice, not a judgment that the thread is objectively unimportant or safe to ignore. It remains active until you undo or replace it.

  4. **Undo confirmed while reevaluation is pending**

     Title:

     > Correction removed

     Description:

     > Your correction is no longer active. This thread is being reevaluated using its current constitutional evidence.

  5. **Undo and reevaluation confirmed**

     Title:

     > Correction removed

     Description:

     > Your correction is no longer active. This thread was reevaluated using its current constitutional evidence.

  6. **Definitive correction failure**

     Condition:

     - the requested transition definitively did not become authoritative.

     Title:

     > Correction not applied

     Description:

     > We could not apply your correction. The previously confirmed correction state remains unchanged.

     This copy may be used only when authoritative state proves that the previous confirmed state remains unchanged.

  7. **Unknown or ambiguous correction outcome**

     Condition:

     - active correction authority cannot be verified;
     - a transition or Undo outcome is incomplete or ambiguous.

     Title:

     > Correction status unavailable

     Description:

     > We could not verify which correction is active. This result may not reflect your latest choice.

     The interface must also preserve PPV1-035 incomplete user-correction evidence disclosure.

  8. **Idempotent repeated Undo:** A repeated Undo that confirms no active correction exists must not produce duplicate success history or imply another correction was removed.

     Canonical title:

     > No active correction

     Canonical description:

     > There is no active correction to undo. The current result is based on available constitutional evidence.

  Constitutional boundaries:

  1. Success copy appears only after authoritative correction state and the corresponding evaluation are confirmed.
  2. Pending copy must not imply persistence or final-tier confirmation.
  3. Prioritize copy must not imply objective importance, urgency, certainty, or required action.
  4. Not Important copy must not imply irrelevance, safety, or negative AI or provider judgment.
  5. Undo copy must not imply restoration of previous intent, tiers, cached evaluations, or a correction stack.
  6. Failed and Unknown outcomes must remain distinct.
  7. Correction copy must not imply that Gmail or another provider was mutated.
  8. Localization may adapt grammar while preserving correction authority, lifecycle, and uncertainty semantics.
  9. PPV1-017A remains responsible for reason localization keys and canonical reason wording.

## 14. Non-goals

Priority Policy v1 does not include:

- AI or LLM classification;
- prompts or generated explanations;
- semantic analysis;
- message-body intelligence;
- snippet analysis;
- attachment-content analysis;
- inferred relationships;
- inferred deadlines, intent, sentiment, or urgency;
- contact intelligence;
- automatic Gmail label modification;
- automatic archive, send, reply, forward, or notification actions;
- a full-mailbox completeness claim;
- confidence scoring;
- hidden ranking weights;
- personalized learning.

## 15. Success metrics

Success must measure whether the policy reduces uncertainty and earns trust, not whether it maximizes engagement.

- **PPV1-042 — Time-to-first-action target:** Priority Policy v1 adopts the following time-to-first-action measurement protocol with a provisional Founder target.

  1. **Metric purpose:** Time-to-first-action measures user decision time after a usable qualifying evaluation is presented. It shall remain distinct from PPV1-002A system-delivery latency.
  2. **Qualifying evaluation state:** The decision-time clock begins only when:
     - `presentation.state` is `CURRENT`;
     - `synchronization.coverage` is `READY`;
     - at least one candidate is delivered;
     - the first delivered candidate and its available actions are visibly and accessibly interactable.

     Partial, stale, empty, unavailable, and loading states do not begin the decision-time clock. Their frequency shall be reported separately.
  3. **Clock start:** The clock begins at the first instant the qualifying evaluation becomes visibly and accessibly interactable.
  4. **Clock end:** The clock ends when the interface accepts the first explicit user-initiated candidate action:
     - opening a candidate thread;
     - selecting Prioritize;
     - selecting Not Important.

     Provider, API, persistence, and reevaluation latency after accepted input do not extend decision time.
  5. **Non-actions:** The following shall not end the clock:
     - hover;
     - focus movement;
     - scrolling;
     - pagination;
     - loading;
     - automatic selection;
     - route restoration;
     - background refresh;
     - passive visibility;
     - keyboard navigation without activation;
     - programmatic events.
  6. **Session boundary:** A qualifying action session is a qualifying evaluation session in which an approved intentional action occurs before:
     - the user leaves the Attention view; or
     - the session ends after ten minutes of inactivity.

     Sessions without an action shall not enter the within-60-seconds denominator. They shall be reported separately as the no-action session rate.
  7. **Required reporting:** Report at minimum:
     - qualifying evaluation sessions;
     - qualifying action sessions;
     - percentage reaching action within 60 seconds;
     - median time-to-first-action;
     - 75th percentile;
     - 90th percentile;
     - no-action session rate;
     - excluded sessions grouped by partial, stale, empty, unavailable, and loading states.
  8. **Founder-approved reporting threshold:** The initial reporting threshold is:

     **60 seconds**

     Implementations shall not substitute another threshold without Founder approval.
  9. **Provisional Founder target:** The initial provisional target is:

     > At least 75% of qualifying action sessions reach a first intentional candidate action within 60 seconds.

     This target shall be reviewed after the first representative production baseline period. The review must consider, at minimum:

     - no-action session rate;
     - explanation usefulness;
     - correction quality;
     - trust;
     - accessibility;
     - operational correctness;
     - qualifying-session volume and representativeness.

     Until that review is completed, the 75% value shall be treated as a provisional Sprint target rather than a permanent constitutional success boundary.
  10. **Privacy:** Measurement may collect only:
      - pseudonymous session identity;
      - timing boundaries;
      - approved action category;
      - collection presentation state;
      - synchronization coverage;
      - delivery state;
      - `policyVersion`.

      It shall not collect solely for this metric:

      - message bodies;
      - snippets;
      - subjects;
      - sender or recipient data;
      - mailbox addresses;
      - raw provider identifiers;
      - authentication tokens;
      - thread content;
      - application-owned `threadId`.
  11. **Interpretation guardrails:** Faster action is not automatically better. No-action sessions are not automatically failures. Interfaces shall not manufacture urgency, hide explanation, reduce user control, or encourage unnecessary action to improve the metric. A change that improves time-to-first-action while harming trust, correction quality, explanation usefulness, accessibility, or correctness shall not be considered successful.
  12. **Existing authority:** PPV1-002A remains responsible for system time-to-first-result. PPV1-043 through PPV1-046 remain responsible for the supporting quality and trust measures used during target review.

  PPV1-042 measures how quickly users intentionally act after a usable evaluation is available. It does not measure engagement for its own sake and shall not reward unnecessary clicks.
- **PPV1-043 — Correction-rate interpretation:** Priority Policy v1 adopts descriptive, cohort-based correction measurement with no universal success or failure range.

  1. **Metric purpose:** Correction rate measures how often reviewed candidates receive explicit user-directed tier authority. It is a measure of user control and policy interaction. It is not an accuracy, failure, disagreement, or model-quality score.
  2. **Observation unit:** The observation unit is one application-owned, owner-scoped thread under one `policyVersion` during one observation window. Raw provider identifiers shall not be measurement identities.
  3. **Reviewed-candidate denominator:** A candidate enters the denominator when:
     - it is presented in a `CURRENT`, synchronization-`READY` evaluation;
     - it is visibly and accessibly interactable;
     - the user explicitly opens that candidate.

     Passive display, pagination, focus, hover, scrolling, or automatic selection does not make a candidate reviewed. Each qualifying thread appears at most once in the denominator per policy version and observation window.
  4. **Correction-activation numerator:** A reviewed candidate enters the numerator when an authoritative transition confirms:
     - Prioritize became active;
     - Not Important became active; or
     - one correction was atomically replaced by the other.

     Each reviewed candidate appears at most once in the aggregate correction-activation numerator, regardless of subsequent transitions.
  5. **Required directional metrics:** Report separately:
     - Prioritize activation rate;
     - Not Important activation rate;
     - correction replacement rate;
     - Undo rate;
     - rapid Undo rate;
     - ambiguous or unconfirmed correction-outcome rate.

     Prioritize and Not Important must never be collapsed into a single negative “disagreement” count.
  6. **Observation window:** Use a rolling 28-day observation window. For Undo and replacement analysis, use a seven-day follow-up period after each authoritative correction transition. Cohorts without the complete follow-up period remain immature and must be reported separately.

     Also report rapid Undo occurring within ten minutes of authoritative confirmation. Rapid Undo is an investigation signal, not automatic proof of interface failure.
  7. **Acceptable range:** Priority Policy v1 defines no universal minimum or maximum correction-activation rate. The constitutionally acceptable correction-activation range is therefore:

     > 0% through 100%, subject to truthful contextual interpretation.

     No value within that range independently proves success or failure.

     A low rate may indicate:

     - policy alignment;
     - low correction need;
     - undiscoverable controls;
     - low trust;
     - insufficient use.

     A high rate may indicate:

     - healthy use of explicit control;
     - conservative policy behavior;
     - systematic policy mismatch;
     - misunderstanding of correction semantics;
     - cohort-specific needs.

     These possibilities must not be resolved through inference from the rate alone.
  8. **Baseline interpretation:** The first representative 28-day production cohort establishes an observational baseline, not a constitutional target. Subsequent reviews must compare:
     - correction direction;
     - Undo and replacement behavior;
     - explanation usefulness;
     - trust;
     - accessibility;
     - policy version;
     - cohort volume and representativeness.

     Material changes require investigation. Any resulting policy modification requires separate Founder approval.
  9. **Cohort sufficiency:** Aggregate interpretation requires at least:
     - 100 reviewed candidates;
     - 20 distinct pseudonymous owners;
     - a complete 28-day observation window;
     - complete seven-day follow-up for Undo and replacement metrics.

     Smaller cohorts may be reported as insufficient evidence but must not be used for constitutional success or failure claims. Single-user or internal validation may inspect local behavior without being represented as a production-level correction-rate conclusion.
  10. **Privacy:** Measurement may collect only:
      - pseudonymous owner and session identities;
      - policy version;
      - approved correction action category;
      - authoritative transition outcome;
      - tier before and after the transition;
      - event timing required by the approved windows;
      - presentation and synchronization state needed to establish eligibility.

      It shall not collect solely for this metric:

      - message bodies;
      - snippets;
      - subjects;
      - sender or recipient data;
      - mailbox addresses;
      - authentication tokens;
      - raw provider identifiers;
      - thread content.

      Application-owned `threadId` should be transformed into an owner-scoped, non-reversible measurement identity when candidate-level deduplication is required. Owner-scoped measurement identities shall not be reusable outside approved telemetry aggregation.
  11. **Interpretation guardrails:**
      - A correction is evidence of explicit user intent, not evidence that the user is wrong.
      - Corrections must not be hidden, discouraged, or made harder to improve the rate.
      - Undo must not be discouraged to reduce reversal metrics.
      - A zero correction rate is not automatically ideal.
      - A high correction rate is not automatically failure.
      - Metrics shall not be interpreted across different `policyVersion` values without explicit version segmentation.
      - No automatic policy learning, tier modification, or AI inference may result from correction telemetry.
      - Policy changes require separate Founder approval.
- **PPV1-044 — Explanation usefulness:** TODO (Founder Approval Required): Define the research question and success threshold.
- **PPV1-045 — Trust measure:** TODO (Founder Approval Required): Define the qualitative or quantitative release criterion for user trust.
- **PPV1-046 — Operational correctness:** TODO (Founder Approval Required): Approve measurable targets for deterministic replay, stale-result prevention, and policy-version reporting.

Metrics must not collect message bodies, recipient content, or other mailbox content solely for Priority Policy analytics.

## 16. Known risks

1. A bounded candidate set can omit mail that matters to the user.
2. Gmail labels express provider and user state, not objective importance.
3. Unread status does not necessarily mean attention is required.
4. Recency can overemphasize new mail and underemphasize older unresolved work.
5. Normalized sender, recipient, and attachment metadata does not reveal intent.
6. Provider timestamps may be missing, malformed, or future-dated.
7. Synchronization lag can make an otherwise correct evaluation stale.
8. Personal preferences differ; deterministic defaults will require reversible correction.
9. Incomplete policy TODOs prevent a conforming executable implementation.

These risks must be represented honestly in product review and validation. They must not be concealed through confidence language.

## 17. Future evolution

Future versions may consider personal learning, relationship modeling, deadline extraction, or AI assistance only after evidence demonstrates a user need and Wong Studio approves a new versioned policy.

Future possibilities are not Sprint 1 commitments. They must not be introduced under the Priority Policy v1 identifier.

Any evolution must:

- preserve owner control and reversibility;
- maintain an explanation contract;
- distinguish observed evidence from inference;
- receive explicit Founder approval;
- increment the policy version when behavior changes;
- include a migration and compatibility decision for prior evaluations.

## 18. Founder approval record

Approved by:

Founder

Sprint:

Sprint 1

Decision:

Approved as the engineering source of truth for Priority Policy v1 and Attention Contract v1.

Founder directive:

FD-001

Approval date:

**PPV1-047 — Approval date:** TODO (Founder Approval Required)

Approval boundary:

The document structure, philosophy, design promise, deterministic/non-AI boundary, normalized-metadata boundary, future-age clamping rule, correction principles, Attention Contract minimum fields, non-goals, and source-of-truth role are approved. Numbered TODOs are explicit unresolved decisions and are not authorization to implement behavior.

## 19. Revision history

| Version | Status | Date | Decision owner | Change |
| --- | --- | --- | --- | --- |
| 1.0 | Approved amendment | 2026-07-24 | Founder | Recorded Founder Design Session #5 contract vocabulary decisions for tier identifiers, evidence-specific reason codes, localized canonical reasons, reason precedence, empty-reason representation, and canonical timestamps. |
| 1.0 | Approved amendment | 2026-07-24 | Founder | Recorded Founder Design Session #4 decisions defining Recency as objective temporal evidence, prohibiting tier promotion from Recency alone, preserving explicit user-intent precedence, and permitting Recency only as a deterministic tie-breaker when candidates are otherwise constitutionally equal. |
| 1.0 | Approved amendment | 2026-07-24 | Founder | Recorded Founder Design Session #3 decisions for Manual user star, provider-verifiable signal origin, missing-metadata fallbacks, candidate-count scalability, provider neutrality, explicit User Override, and AI independence. |
| 1.0 | Approved | Pending PPV1-047 | Founder | Established the repository source of truth under FD-001. Unresolved policy decisions are enumerated for Founder review before executable implementation. |

Changes to operative policy require:

1. an explicit Founder decision;
2. an update to this document;
3. a revision-history entry;
4. a policy-version compatibility decision;
5. regression tests proving the approved behavior.
