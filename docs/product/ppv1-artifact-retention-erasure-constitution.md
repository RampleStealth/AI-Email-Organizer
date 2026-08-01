# PPV1 Artifact Retention & Erasure Constitution

**Status:** Founder Authorized

**Version:** 1.0

**Effective date:** 2026-08-01

**Authority:** AI Email Organizer product governance

## 1. Purpose and authority

This Constitution governs the operational lifetime, retention, minimization, and authorized erasure of every Priority Policy v1 artifact created or retained by AI Email Organizer.

It exists to preserve truthful product behavior while preventing accidental permanence. Deterministic evaluation requires stable evidence and provenance. Privacy requires that the product retain no artifact longer, more broadly, or for more purposes than authorized.

This Constitution distinguishes:

- **policy semantics:** what Priority Policy means and how it evaluates approved evidence;
- **operational lifetime:** the period during which an artifact remains operative in the live product;
- **legal retention:** a documented obligation or prohibition imposed by applicable law or an authorized legal hold;
- **physical persistence:** the period during which an artifact remains stored, including historical storage after it stops being operative;
- **replay availability:** the period during which a retained evaluation run can be reproduced from its retained immutable facts.

These concepts are independent. An artifact may stop being operative while remaining historically retained. A retained artifact may be unavailable to ordinary product use. A lawfully erased artifact is no longer available for replay. Cache lifetime is never evidence-retention authority.

No migration, repository, service, API, worker, cache, user interface, test fixture, or operational process may invent, extend, renew, or substitute its own retention rule.

Priority Policy v1 remains the sole authority for evaluation semantics. This Constitution does not change candidate eligibility, correction meaning, reason wording, precedence, ordering, Unknown handling, or replay equality. It governs only artifact lifecycle.

For PPV1 artifacts, this Constitution supersedes earlier product-document statements that retention duration, legal deletion, or operational lifecycle are unresolved. Applicable law and the inherited Wong Studio constitutional framework remain higher authority.

## 2. Artifact classification

The following classifications are exhaustive for PPV1 v1. A future artifact must be added to this Constitution or assigned in writing to an existing class before persistent use.

| Artifact | Owner | Purpose | Sensitivity | Authority status | Operational lifetime | Retention source | Erasure and dependency closure | Replay significance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Canonical application thread | AI Email Organizer within authenticated owner and mailbox scope | Stable provider-neutral product identity | Owner- and mailbox-linked identifier | Identity authority | Mailbox product lifetime | Section 4.1 | Erased only through an authorized scope closure after dependent artifacts; never reassigned | Identifies candidates and retained provenance |
| Provider Binding | AI Email Organizer; provider locator remains provider-owned fact | Associates one canonical thread with one provider locator | High; contains provider-account and provider-thread locators | Binding authority | Mailbox product lifetime | Section 4.1 | Complete binding closure is erased with its scope after dependent runs; no locator survives ordinary owner erasure | Establishes identity provenance for a snapshot |
| Provider Binding transition | AI Email Organizer | Preserves binding lifecycle and replacement provenance | High; owner-, mailbox-, thread-, and provider-linked | Immutable binding-history authority | Binding-history lifetime | Section 4.1 | Retained as a complete chain; erased with binding closure after dependent runs | Identifies the exact binding applicable to retained evidence |
| Correction aggregate | AI Email Organizer on behalf of the authenticated owner | Resolves current application-owned correction authority | High; explicit personal preference | Correction authority | Mailbox product lifetime | Section 4.1 | Erased with its complete history after dependent runs; erasure is not Undo | Establishes authoritative correction state |
| Correction transition | Authenticated owner action confirmed by AI Email Organizer | Preserves Prioritize, Not Important, replacement, and Undo history | High; explicit preference and action history | Immutable correction-history authority | Correction-history lifetime | Section 4.1 | Retained as a complete chain; erased with correction closure after dependent runs | Identifies exact correction authority applicable to retained evidence |
| Replay snapshot | AI Email Organizer | Preserves complete normalized deterministic replay input | High; owner-, mailbox-, thread-, and evidence-linked | Replay-input authority for its run | Retained-run lifetime | Section 4.2 | Inseparable from its run; erased through the complete run or broader scope closure | Primary replay input authority |
| Evaluation run | AI Email Organizer | Owns one completed immutable evaluation and replay boundary | High; owner-scoped behavioral result | Retained replay-subject authority | Through the mandatory run boundary | Section 4.2 | Erased only as a complete run closure or broader authorized closure | Primary retained replay subject |
| Evaluation provenance, including per-candidate provenance | AI Email Organizer | Binds an evaluation and each candidate to exact identities, evidence, policy, parameters, and clock | High; joins owner-scoped facts | Provenance authority for its run | Retained-run lifetime | Section 4.2 | Inseparable from its run; erased before or with erased upstream authority | Required for truthful replay and audit |
| Collection evaluation | Priority Policy v1 | Preserves canonical immutable collection output | High; contains owner-scoped thread results | Canonical output authority for its run | Retained-run lifetime | Section 4.2 | Inseparable from its run | Canonical replay comparison boundary |
| PPV1 audit event | AI Email Organizer operational authority | Records approved security, correction, evaluation, erasure, and administrative observations | Medium to high according to identifiers and metadata | Observational only; never policy, identity, correction, or replay authority | Purpose-limited evidentiary lifetime | Duration governed by a separate approved operational policy. | Deleted or minimized with dependency closure; minimized residue is non-authoritative and non-linkable | Never replay authority |
| PPV1 outbox event | AI Email Organizer operational authority | Delivers a required PPV1 state-change or invalidation fact | Medium; may contain scoped operational identifiers | Delivery mechanism only; never PPV1 truth | Ends when delivery purpose and required resolution end | Duration governed by a separate approved operational policy. | Deleted or minimized after purpose; participates in owner and legal closure | Never replay authority |
| PPV1 synchronization metadata | AI Email Organizer PPV1 normalization boundary; provider owns provider facts | Establishes PPV1 checkpoint, readiness, and coverage facts | Medium to high; mailbox- and provider-linked | Authoritative only when explicitly classified as the current PPV1 synchronization authority; otherwise operational | Current authority lasts for mailbox product lifetime; other records are purpose-limited | Duration governed by a separate approved operational policy. | Linkable records join source closure and cannot extend source retention | Significant only when retained in a replay snapshot |
| PPV1 cache entry | AI Email Organizer implementation | Avoids repeated computation without becoming product authority | High; owner-scoped derived result | Non-authoritative optimization | PPV1-033 cache lifetime | Section 4.6 and PPV1-033 | Erased on expiry, invalidation, or broader closure; never preserves an erased source | Never independent replay authority |
| PPV1 operational log | AI Email Organizer operations | Diagnoses PPV1 availability, security, and correctness | Potentially sensitive even after redaction | Observational and non-authoritative | Purpose-limited operational lifetime | Duration governed by a separate approved operational policy. | Linkable records join source closure; minimized residue cannot resolve erased authority | Never replay authority |

“Evaluation provenance” includes every per-candidate provenance record, including canonical thread identity, the applicable Provider Binding transition, and the applicable correction transition or explicit absence provenance.

This Constitution governs only PPV1 synchronization metadata, PPV1 operational logs, and records containing PPV1-scoped identities or authority. It does not govern unrelated application synchronization records or general application logs.

Policy definitions, source code, migrations, aggregate non-identifying statistics, and synthetic fixtures are not owner artifacts merely because they support PPV1. A fixture containing real or linkable owner data is an owner artifact and inherits the strictest applicable class.

## 3. Operational lifetime

The following terms are normative and shall not be used interchangeably:

- **Active lifetime** is the period during which an artifact directly controls current behavior. An active correction remains active until authoritative Undo or replacement. A current Provider Binding remains current until an approved binding transition.
- **Operational persistence** is storage required to operate the product truthfully, including reconnect, retry, concurrency control, correction resolution, and identity continuity.
- **Historical persistence** is storage retained after an artifact stops being active because approved audit, provenance, or lifecycle integrity still requires it.
- **Replay persistence** is storage retained solely as part of a retained immutable evaluation run and its dependency closure.
- **Product lifetime** is the period during which the owning owner or mailbox remains retained as an AI Email Organizer product scope. Disconnect, temporary unavailability, or projection deletion does not end product lifetime.

Operational lifetime never creates legal-retention authority. Legal retention never make an artifact operative. Historical persistence never authorizes presentation of stale or invalid evaluation output.

## 4. Retention authority

Retention is authorized only for the purposes and limits below. Retention is not permanence.

### 4.1 Product-lifetime authority

The following are retained for the product lifetime of their owner and mailbox scope, unless earlier erasure is authorized under Section 5:

- canonical application threads;
- Provider Bindings and their complete transition history;
- correction aggregates and their complete transition history;
- the current synchronization authority required to continue or truthfully resume synchronization.

Disconnect does not end this retention. Projection deletion, rebuild, provider unavailability, temporary ineligibility, or application restart does not end this retention.

Complete Provider Binding and correction transition chains are retained together. No historical transition may be removed while a retained current or later transition depends upon it.

### 4.2 Evaluation and replay authority

A completed evaluation run, its replay snapshot, evaluation provenance, and collection evaluation form one indivisible retained run.

The completed Priority Evaluation Run is retained through **`completedAt` plus 30 calendar days, inclusively**. It becomes eligible for mandatory deletion strictly after that instant.

Retrieval, replay, presentation, copying, process restart, audit access, cache access, or operational use does not advance the boundary.

Only an expressly authorized erasure action under Section 5, an applicable legal requirement, an authorized emergency action, or test-environment teardown may delete the complete run earlier. The least-persistence principle does not independently shorten this mandatory window. Partial retention of a run is prohibited.

PostgreSQL is the durable authority for retained Priority Evaluation Runs. The repository is the authority for the eligibility predicate and atomic deletion closure. A future designated retention service or worker is the execution authority for mandatory physical deletion. This Constitution does not authorize or define that implementation.

### 4.3 Audit authority

PPV1 audit events are observational. They are never policy, replay, identity, Provider Binding, correction, or evaluation authority.

An audit event is retained only while an explicit audit, security, erasure-accountability, or legal authority requires its minimum facts. Its exact duration is governed by a separate approved audit policy. No audit record may preserve otherwise erasable PPV1 facts merely because those facts are auditable.

Audit data shall contain only the minimum identifiers and metadata required for its approved purpose. Audit retention does not authorize mailbox content, raw provider payloads, message bodies, subjects, snippets, addresses, tokens, replay snapshots, or unnecessary duplicate provenance.

Audit records participate in dependency closure. They must be deleted or lawfully minimized when their source authority is erased. A minimized residue is non-authoritative, non-replayable, non-linkable, and incapable of resolving or restoring an owner, mailbox, canonical thread, Provider Binding, correction transition, evaluation run, or erased provenance. It may survive only when another explicit authority permits it.

### 4.4 Outbox authority

PPV1 outbox events exist only for operational delivery. They are not PPV1 truth, policy authority, replay authority, identity authority, or audit authority.

An outbox event is retained only while its delivery purpose or authoritative resolution remains necessary. After that purpose ends, it must be deleted or minimized under a separate approved operational outbox policy. It cannot extend the retention of its source artifact.

Outbox records participate in owner-requested and legal erasure closure. They must not retain sensitive payload fields, source identifiers, or reconstructable provenance after source authority is erased. An event shall never be erased and then represented as successfully delivered.

### 4.5 Synchronization authority

This section governs only PPV1 synchronization metadata and synchronization records containing PPV1-scoped identities or authority. It does not govern unrelated application synchronization records.

The explicitly classified current PPV1 synchronization checkpoint or equivalent current authority is retained for the mailbox product lifetime. Other PPV1 synchronization metadata is non-authoritative and purpose-limited. Its duration is governed by a separate approved synchronization policy.

Synchronization metadata must not retain raw provider payloads or provider locators. It cannot extend source-artifact retention. When it remains linkable to an erased source, it participates in that source's dependency closure.

### 4.6 Cache authority

PPV1 cache entries remain governed by PPV1-033. The cache-retention interval begins at the original `evaluatedAt`. The entry remains within retention through **`evaluatedAt` plus 24 hours, inclusively**. It becomes eligible for mandatory eviction strictly after that instant and is removed from use immediately upon known semantic invalidation.

Retrieval, replay, presentation, copying, transport, process restart, or cache access does not advance the boundary. Cache lifetime does not govern evaluation runs, correction history, audit events, replay snapshots, operational logs, or any other artifact class.

### 4.7 Operational-log authority

This section governs only PPV1 operational logs and logs containing PPV1-scoped identities or authority. It does not govern unrelated general application logs.

PPV1 operational logs are observational and non-authoritative unless a Founder-approved amendment explicitly classifies otherwise. They are retained only while an explicit operational, security, incident, or legal purpose requires their minimum facts. Their exact duration is governed by a separate approved logging policy.

Logs shall not contain mailbox content, raw provider payloads, provider locators, authentication secrets, replay snapshots, correction text, or unnecessary duplicate provenance. Logs cannot extend source-artifact retention. A linkable log participates in the source artifact's erasure closure. A documented security or legal hold may retain only the minimum necessary incident evidence under Section 5.

## 5. Erasure authority

Erasure is a governed lifecycle action. It is not Undo, invalidation, cache eviction, provider disconnect, or projection cleanup. Erasure shall never be used to rewrite policy history selectively, change a current tier covertly, or conceal a correctness failure.

Immutable history may be deleted only through an authorized dependency closure. It is never edited, rewritten, selectively truncated, or reinterpreted before deletion.

### 5.1 Owner-requested deletion

An authenticated owner may authorize permanent deletion of:

- one retained mailbox scope; or
- the owner's complete AI Email Organizer account scope.

Temporary suspension, account closure without erasure, mailbox disconnect, provider unavailability, and credential revocation are not permanent deletion. They do not erase PPV1 artifacts or end an artifact's authorized retention unless a separate erasure action is expressly authorized.

Permanent owner-authorized deletion erases the complete dependency closure for the requested scope, including:

- synchronization metadata and projections;
- caches and operational delivery state;
- evaluation runs, replay snapshots, evaluation provenance, and collection evaluations;
- correction aggregates and complete transition history;
- Provider Bindings and complete transition history;
- canonical application threads;
- owner-scoped PPV1 logs and audit/outbox records, except minimum records subject to a documented legal hold.

No owner-linked, mailbox-linked, provider-linked, thread-linked, correction-linked, or evaluation-linked identifier may survive ordinary owner erasure merely for analytics or convenience. Only genuinely non-identifying aggregate statistics and the non-reuse protection authorized by Section 8 may survive.

Tenant deletion is outside PPV1 Artifact Governance v1 because AI Email Organizer has no constitutional tenant model. A tenant model and tenant-deletion authority require a Founder-approved constitutional amendment before implementation.

### 5.2 Administrative deletion

Administrative deletion may be authorized only by the Founder or a formally delegated operational authority acting for one of these documented purposes:

- execute an authenticated owner-erasure request;
- remove demonstrably corrupt or unauthorized data;
- perform approved recovery from an operational incident;
- comply with legal or regulatory authority;
- clean an approved development or test environment.

Administrative access is not independent retention authority. It may not selectively delete authoritative correction or evaluation facts to change a product outcome. Deletion of authoritative PPV1 artifacts must include the complete dependency closure.

### 5.3 Legal or regulatory deletion and legal holds

The Founder or a formally designated Wong Studio legal or privacy authority may authorize deletion, restriction, or temporary legal hold based on a documented legal obligation.

When deletion is legally required, the affected dependency closure is erased completely. Anonymization, tombstoning, or cryptographic detachment may substitute for deletion only when the authorizing legal or privacy authority documents that the resulting record is no longer personal or linkable data and is necessary for an approved purpose.

When retention is legally required, only the minimum necessary artifact and fields may remain. Held data shall be unavailable to ordinary product evaluation, replay, personalization, analytics, or presentation unless the legal authority explicitly permits that use. It is erased when the hold ends unless another authority in this Constitution still applies.

### 5.4 Development cleanup

Synthetic development artifacts may be erased whenever their approved development purpose ends. A development artifact cannot outlive the governing maximum of the production artifact class it represents. Development data derived from or linkable to a real owner is not synthetic and receives the same protection and erasure rights as production owner data.

Development cleanup may erase complete synthetic dependency closures. It may not be used against production owner artifacts.

### 5.5 Test data

Test artifacts shall use synthetic identities and evidence. They may be deleted during test-environment teardown or immediately after verification. A deterministic fixture intended for permanent source control must be demonstrably synthetic and non-linkable.

Test copies do not acquire a new retention clock. Any test artifact derived from or linkable to a real owner inherits the source artifact's authority and must participate in its erasure closure.

### 5.6 Emergency removal

The Founder or the incident authority designated by the approved security-incident process may authorize immediate withholding and erasure when continued retention creates a material security, privacy, legal, or product-truthfulness risk.

Emergency action may precede ordinary operational scheduling but shall remain documented and auditable. Only minimum incident evidence may survive, subject to the audit and legal-hold limits above. Replay unavailability caused by authorized emergency erasure is truthful unavailability, not a mismatch.

### 5.7 Copies, replicas, backups, exports, and restored data

A copy never acquires a new purpose, authority, or retention clock merely because it is stored in another system or environment.

Copies, replicas, backups, exports, diagnostic captures, and restored data inherit the original artifact's classification, retention boundary, dependency relationships, and erasure authority. Backup, restore, replication, export, retrieval, or disaster-recovery activity never advances retention.

Unnecessary duplicate copies must be deleted. Lawful erasure must propagate to every recoverable copy within the approved operational process. A restored artifact whose retention boundary has passed or whose source was lawfully erased must not re-enter product, replay, audit, or operational use and must be erased again through the applicable closure.

## 6. Dependency closure

No artifact may survive if doing so would leave another retained artifact with broken, false, unverifiable, or silently reconstructed provenance.

Deletion operates over dependency closures rather than individual rows or objects.

The constitutional dependency relationships are:

- a Provider Binding transition depends on its canonical thread and binding history;
- a correction transition depends on its canonical thread, correction aggregate, and prior retained transition chain;
- evaluation provenance depends on the exact thread, Provider Binding transition, correction authority, policy identity, approved parameters, evidence identity, and fixed evaluation clock it records;
- a replay snapshot and collection evaluation belong to one evaluation run;
- cache entries depend on immutable evaluation facts but never preserve those facts after their own authority ends;
- audit and outbox events may reference operational artifacts but do not preserve product authority after those artifacts are erased.

When an upstream identity or authority is erased, every retained dependent replay snapshot, provenance record, evaluation run, collection evaluation, cache entry, and linkable operational event in the erasure scope must also be erased or lawfully minimized so that no broken reference or reconstructable owner history remains.

When an evaluation run is erased under its ordinary 30-day retention rule, its correction and Provider Binding authorities may remain because they do not depend on that run. When a correction or Provider Binding authority is erased, every retained run that depends on it must be erased first or as part of the same indivisible erasure closure.

Erasure shall be all-or-nothing at the constitutional aggregate boundary. A partial failure must leave artifacts unavailable and must not be represented as completed erasure.

## 7. Replay

Replay is guaranteed only for a retained, complete evaluation run.

For every retained run:

- its immutable replay snapshot and canonical collection evaluation remain complete;
- exact canonical equality remains the verification boundary;
- replay uses only stored run facts;
- replay never queries current provider, correction, synchronization, cache, or presentation state to replace missing facts.

A lawfully erased run is permanently unavailable for replay. Replay unavailability is distinct from replay mismatch:

- **unavailable** means the complete authorized replay subject is not retained;
- **mismatch** means a retained complete replay subject produces output unequal to its retained canonical output.

The product shall never report an erased run as a mismatch, synthesize a replacement fixture, or silently reconstruct erased evidence. Retention metrics and correctness reporting shall exclude lawfully erased unavailable runs from mismatch counts while accounting for their authorized deletion separately.

## 8. Identity and non-reuse

Canonical application identities are never reassigned. Provider locator deletion, owner erasure, mailbox erasure, projection deletion, migration, or legal removal never authorizes reuse of an erased `threadId`, binding identity, correction identity, transition identity, evidence identity, or evaluation-run identity for another logical artifact.

AI Email Organizer may retain a minimal non-reuse tombstone only for preventing reassignment. Such a tombstone:

- is not product identity authority;
- cannot resolve an owner, mailbox, provider, thread, correction, or evaluation;
- contains no raw provider locator, owner identifier, mailbox identifier, content, evidence, or action history;
- uses only a purpose-limited, non-reversible, non-linkable marker;
- shall not support analytics, replay, audit reconstruction, account recovery, or product behavior.

If applicable law requires removal of even that marker, no tombstone survives. Replacement identities must still be newly generated, must not be derived from erased identifiers, and must never intentionally reuse a known historical identifier.

## 9. Privacy principles

All PPV1 artifact handling shall comply with these principles:

1. **Data minimization:** Retain only fields required by an approved operational, replay, audit, security, or legal purpose.
2. **Purpose limitation:** An artifact retained for one purpose shall not silently acquire another purpose.
3. **Least persistence:** Use the shortest period authorized for the artifact class. This principle does not independently shorten a mandatory minimum such as the completed evaluation-run window. Earlier deletion requires express authority under Section 5 or another rule that expressly permits a shorter period.
4. **Operational necessity:** Convenience, speculative analytics, debugging preference, and possible future usefulness are not retention authority.
5. **Deterministic provenance:** Every retained result keeps the exact identities and facts necessary to explain its origin without querying mutable current state.
6. **No silent reconstruction:** Erased or unavailable facts are never inferred, regenerated, fetched from a provider, or replaced from current state.
7. **Explicit retention authority:** Every persistent artifact must identify its governing class and retention authority.
8. **Scope isolation:** Retention, lookup, replay, audit, and erasure remain bound to authenticated owner and mailbox scope.
9. **Unknown preservation:** Failed, unavailable, partial, or ambiguous reads never become verified absence.
10. **Erasure truthfulness:** A completed erasure is reported only after the authorized dependency closure is durably resolved. Failure remains failure or Unknown.
11. **No policy learning from correction history:** Retained corrections and erasure records shall not train, personalize, or silently alter Priority Policy.
12. **No raw mailbox-content retention:** PPV1 artifacts shall not retain message bodies, subjects, snippets, addresses, tokens, or raw provider payloads solely for evaluation, replay, audit, or analytics.

## 10. Binding effect on future milestones

This Constitution binds every future PPV1 milestone and repository boundary.

### Correction persistence

Correction persistence shall preserve owner/mailbox/thread scope, explicit user authority, immutable transition history, exact transition identity, and dependency-closed erasure. Undo remains a policy transition, not an erasure operation.

### Evaluation-run persistence

An evaluation run shall own one complete immutable replay subject. Its snapshot, provenance, collection evaluation, and retention boundary shall remain inseparable. It is retained through `completedAt` plus 30 calendar days, inclusively, and becomes eligible for mandatory deletion strictly after that instant.

### Replay persistence

Replay shall operate only on retained complete runs, report erased runs as unavailable, and never reconstruct erased facts.

### Audit

PPV1 audit records shall be minimal, purpose-specific, owner-scope safe, governed by a separately approved audit policy, and included in authorized erasure or minimization closures. Minimized residue is non-authoritative, non-replayable, non-linkable, and incapable of restoring erased identity or provenance.

### APIs and interfaces

APIs and interfaces shall distinguish disconnect, Undo, invalidation, cache expiry, unavailable replay, and permanent erasure. No response may claim completed erasure before the complete authorized dependency closure is durably resolved.

### Workers and operations

The future designated retention service or worker is the execution authority for mandatory evaluation-run deletion and any other scheduled deletion expressly assigned by an approved operational policy. Repositories own the applicable eligibility predicates and atomic deletion closures. Workers and operations may execute authorized decisions but may not create new durations, exceptions, renewal rules, or survival classes. Retries do not extend retention. Partial failure must fail closed.

### Legal deletion

Legal and privacy authorities may invoke only the deletion, hold, minimization, and access-restriction powers defined here. Any additional survival or reuse of owner-linked data requires a Founder-approved amendment or controlling law.

### Amendment

No architecture document, implementation decision, migration default, operational runbook, or environment configuration may contradict or weaken this Constitution. A change to artifact classification, retention duration, erasure authority, dependency closure, replay availability, or identity survival requires a Founder-approved amendment to this document.

## 11. Normative cross-document alignment

After Founder ratification, the following documents shall reference this Constitution as the product authority for PPV1 artifact retention and erasure:

- Priority Policy v1;
- Milestone 3 Priority Policy MVP;
- Product Architecture v1;
- Data and State Model v1;
- Project Roadmap.

Statements in those documents that classify PPV1 artifact retention duration, operational lifecycle, or authorized erasure as unresolved are superseded by this Constitution upon ratification. Those documents must be aligned without duplicating this Constitution's rules. Until the alignment edits occur, this Constitution controls the conflicting PPV1 artifact-governance question; the other documents retain authority over their respective policy, architecture, data-model, and roadmap concerns.
