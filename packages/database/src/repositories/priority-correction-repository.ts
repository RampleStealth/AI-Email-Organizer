import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool, withTransaction } from "../index.js";
import type {
  PriorityCorrectionAggregate,
  PriorityCorrectionAuthority,
  PriorityCorrectionLookupInput,
  PriorityCorrectionMutationInput,
  PriorityCorrectionMutationResult,
  PriorityCorrectionOperation,
  PriorityCorrectionScope,
  PriorityCorrectionTransition,
} from "../correction/contract.js";
import {
  InvalidPriorityCorrectionInputError,
  InvalidPriorityCorrectionTransitionError,
  PriorityCorrectionConflictError,
  PriorityCorrectionNotFoundError,
  PriorityCorrectionPersistenceError,
} from "../correction/contract.js";

export * from "../correction/contract.js";

type QueryClient = Pick<PoolClient, "query">;

type CurrentRow = {
  correctionId: unknown;
  ownerId: unknown;
  mailboxId: unknown;
  threadId: unknown;
  currentTransitionId: unknown;
  createdAt: unknown;
  transitionId: unknown;
  operation: unknown;
  previousTransitionId: unknown;
  idempotencyKey: unknown;
  transitionedAt: unknown;
};

type TransitionRow = {
  transitionId: unknown;
  correctionId: unknown;
  ownerId: unknown;
  mailboxId: unknown;
  threadId: unknown;
  operation: unknown;
  previousTransitionId: unknown;
  idempotencyKey: unknown;
  transitionedAt: unknown;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const operations = new Set<PriorityCorrectionOperation>(["PRIORITIZE", "NOT_IMPORTANT", "UNDO"]);
const retryableCodes = new Set(["40001", "40P01"]);

function ordinaryObject(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new InvalidPriorityCorrectionInputError(`${label} must be an ordinary object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(record: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): void {
  const allowed = new Set([...required, ...optional]);
  if (required.some((key) => !Object.hasOwn(record, key)) || Object.keys(record).some((key) => !allowed.has(key))) {
    throw new InvalidPriorityCorrectionInputError("priority correction input contains invalid fields");
  }
}

function inputIdentity(value: unknown, label: string): string {
  if (typeof value !== "string" || !uuid.test(value)) {
    throw new InvalidPriorityCorrectionInputError(`${label} must be a UUID`);
  }
  return value;
}

function rowIdentity(value: unknown, label: string): string {
  if (typeof value !== "string" || !uuid.test(value)) {
    throw new PriorityCorrectionPersistenceError(`priority correction row contains an invalid ${label}`);
  }
  return value;
}

function inputScope(value: unknown): PriorityCorrectionScope {
  const record = ordinaryObject(value, "scope");
  exactKeys(record, ["ownerId", "mailboxId"]);
  return Object.freeze({
    ownerId: inputIdentity(record.ownerId, "ownerId"),
    mailboxId: inputIdentity(record.mailboxId, "mailboxId"),
  });
}

function rowScope(ownerId: unknown, mailboxId: unknown): PriorityCorrectionScope {
  return Object.freeze({
    ownerId: rowIdentity(ownerId, "ownerId"),
    mailboxId: rowIdentity(mailboxId, "mailboxId"),
  });
}

function lookupInput(value: unknown): PriorityCorrectionLookupInput {
  const record = ordinaryObject(value, "lookup input");
  exactKeys(record, ["scope", "threadId"]);
  return Object.freeze({
    scope: inputScope(record.scope),
    threadId: inputIdentity(record.threadId, "threadId"),
  });
}

function mutationInput(value: unknown): PriorityCorrectionMutationInput {
  const record = ordinaryObject(value, "mutation input");
  exactKeys(
    record,
    ["scope", "threadId", "expectedTransitionId", "idempotencyKey"],
    ["correlationId"],
  );
  if (record.expectedTransitionId !== null && (typeof record.expectedTransitionId !== "string" || !uuid.test(record.expectedTransitionId))) {
    throw new InvalidPriorityCorrectionInputError("expectedTransitionId must be null or a UUID");
  }
  const correlationId = record.correlationId === undefined
    ? undefined
    : inputIdentity(record.correlationId, "correlationId");
  return Object.freeze({
    scope: inputScope(record.scope),
    threadId: inputIdentity(record.threadId, "threadId"),
    expectedTransitionId: record.expectedTransitionId as string | null,
    idempotencyKey: inputIdentity(record.idempotencyKey, "idempotencyKey"),
    ...(correlationId === undefined ? {} : { correlationId }),
  });
}

function canonicalTimestamp(value: unknown): string {
  const date = value instanceof Date
    ? new Date(value.valueOf())
    : typeof value === "string"
      ? new Date(value)
      : null;
  if (date === null || Number.isNaN(date.valueOf())) {
    throw new PriorityCorrectionPersistenceError("priority correction row contains an invalid timestamp");
  }
  return date.toISOString();
}

function operationFromRow(value: unknown): PriorityCorrectionOperation {
  if (typeof value !== "string" || !operations.has(value as PriorityCorrectionOperation)) {
    throw new PriorityCorrectionPersistenceError("priority correction row contains an invalid operation");
  }
  return value as PriorityCorrectionOperation;
}

function nullableRowIdentity(value: unknown, label: string): string | null {
  return value === null ? null : rowIdentity(value, label);
}

function mapTransition(row: TransitionRow): PriorityCorrectionTransition {
  return Object.freeze({
    transitionId: rowIdentity(row.transitionId, "transitionId"),
    correctionId: rowIdentity(row.correctionId, "correctionId"),
    scope: rowScope(row.ownerId, row.mailboxId),
    threadId: rowIdentity(row.threadId, "threadId"),
    operation: operationFromRow(row.operation),
    previousTransitionId: nullableRowIdentity(row.previousTransitionId, "previousTransitionId"),
    idempotencyKey: rowIdentity(row.idempotencyKey, "idempotencyKey"),
    transitionedAt: canonicalTimestamp(row.transitionedAt),
  });
}

function mapAuthority(row: CurrentRow | null): PriorityCorrectionAuthority {
  if (row === null) {
    return Object.freeze({ state: "VERIFIED_ABSENT", correctionId: null, transitionId: null });
  }
  const correctionId = rowIdentity(row.correctionId, "correctionId");
  const transitionId = rowIdentity(row.transitionId, "transitionId");
  const currentTransitionId = rowIdentity(row.currentTransitionId, "currentTransitionId");
  if (transitionId !== currentTransitionId) {
    throw new PriorityCorrectionPersistenceError("priority correction current pointer is inconsistent");
  }
  canonicalTimestamp(row.createdAt);
  const operation = operationFromRow(row.operation);
  if (operation === "UNDO") {
    return Object.freeze({ state: "VERIFIED_ABSENT", correctionId, transitionId });
  }
  return Object.freeze({
    state: "VERIFIED_ACTIVE",
    kind: operation,
    correctionId,
    transitionId,
    scope: rowScope(row.ownerId, row.mailboxId),
    threadId: rowIdentity(row.threadId, "threadId"),
  });
}

function mapAggregate(row: CurrentRow | null): PriorityCorrectionAggregate | null {
  if (row === null) return null;
  return Object.freeze({
    correctionId: rowIdentity(row.correctionId, "correctionId"),
    scope: rowScope(row.ownerId, row.mailboxId),
    threadId: rowIdentity(row.threadId, "threadId"),
    currentTransitionId: rowIdentity(row.currentTransitionId, "currentTransitionId"),
    createdAt: canonicalTimestamp(row.createdAt),
  });
}

function databaseCode(error: unknown): string | undefined {
  return error !== null && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

function preserveOrMapError(error: unknown): never {
  if (
    error instanceof InvalidPriorityCorrectionInputError
    || error instanceof PriorityCorrectionNotFoundError
    || error instanceof PriorityCorrectionConflictError
    || error instanceof InvalidPriorityCorrectionTransitionError
    || error instanceof PriorityCorrectionPersistenceError
  ) {
    throw error;
  }
  const code = databaseCode(error);
  if (code === "23505" || code === "23503") throw new PriorityCorrectionConflictError();
  if (code === "23514") throw new InvalidPriorityCorrectionTransitionError();
  throw new PriorityCorrectionPersistenceError("priority correction persistence failed", {
    cause: error,
    retryable: code !== undefined && retryableCodes.has(code),
  });
}

async function requireScopedThread(client: QueryClient, input: PriorityCorrectionLookupInput, lock: boolean): Promise<void> {
  const result = await client.query(
    `SELECT id FROM application_threads
     WHERE id=$1 AND owner_id=$2 AND mailbox_account_id=$3
     ${lock ? "FOR UPDATE" : ""}`,
    [input.threadId, input.scope.ownerId, input.scope.mailboxId],
  );
  if (result.rowCount !== 1) throw new PriorityCorrectionNotFoundError();
}

const currentSelection = `
  SELECT c.id AS "correctionId", c.owner_id AS "ownerId",
         c.mailbox_account_id AS "mailboxId", c.thread_id AS "threadId",
         c.current_transition_id AS "currentTransitionId", c.created_at AS "createdAt",
         t.id AS "transitionId", t.operation,
         t.previous_transition_id AS "previousTransitionId",
         t.idempotency_key AS "idempotencyKey", t.transitioned_at AS "transitionedAt"
  FROM priority_corrections c
  LEFT JOIN priority_correction_transitions t
    ON t.id=c.current_transition_id
   AND t.correction_id=c.id
   AND t.owner_id=c.owner_id
   AND t.mailbox_account_id=c.mailbox_account_id
   AND t.thread_id=c.thread_id
  WHERE c.thread_id=$1 AND c.owner_id=$2 AND c.mailbox_account_id=$3
`;

async function selectCurrent(
  client: QueryClient,
  input: PriorityCorrectionLookupInput,
  lock: boolean,
): Promise<CurrentRow | null> {
  const result = await client.query<CurrentRow>(
    `${currentSelection} ${lock ? "FOR UPDATE OF c" : ""}`,
    [input.threadId, input.scope.ownerId, input.scope.mailboxId],
  );
  if (result.rowCount === 0) return null;
  if (result.rowCount !== 1 || result.rows[0].transitionId === null) {
    throw new PriorityCorrectionPersistenceError("priority correction current authority is corrupt or ambiguous");
  }
  return result.rows[0];
}

async function selectIdempotentTransition(
  client: QueryClient,
  input: PriorityCorrectionMutationInput,
): Promise<TransitionRow | null> {
  const result = await client.query<TransitionRow>(
    `SELECT id AS "transitionId", correction_id AS "correctionId", owner_id AS "ownerId",
            mailbox_account_id AS "mailboxId", thread_id AS "threadId", operation,
            previous_transition_id AS "previousTransitionId", idempotency_key AS "idempotencyKey",
            transitioned_at AS "transitionedAt"
     FROM priority_correction_transitions
     WHERE owner_id=$1 AND mailbox_account_id=$2 AND idempotency_key=$3`,
    [input.scope.ownerId, input.scope.mailboxId, input.idempotencyKey],
  );
  if (result.rowCount === 0) return null;
  if (result.rowCount !== 1) throw new PriorityCorrectionPersistenceError("priority correction idempotency state is ambiguous");
  return result.rows[0];
}

function exactReplay(
  row: TransitionRow,
  input: PriorityCorrectionMutationInput,
  operation: PriorityCorrectionOperation,
): PriorityCorrectionTransition {
  const transition = mapTransition(row);
  if (
    transition.scope.ownerId !== input.scope.ownerId
    || transition.scope.mailboxId !== input.scope.mailboxId
    || transition.threadId !== input.threadId
    || transition.operation !== operation
    || transition.previousTransitionId !== input.expectedTransitionId
  ) {
    throw new PriorityCorrectionConflictError("priority correction idempotency key was reused for different intent");
  }
  return transition;
}

async function writeFacts(
  client: QueryClient,
  input: PriorityCorrectionMutationInput,
  correctionId: string,
  transitionId: string,
  operation: PriorityCorrectionOperation,
): Promise<void> {
  const correlationId = input.correlationId ?? randomUUID();
  await client.query(
    `INSERT INTO audit_events(
       actor_type,actor_id,event_type,object_type,object_id,correlation_id,metadata
     ) VALUES('user',$1,'priority_correction.transitioned','priority_correction',$2,$3,$4)`,
    [
      input.scope.ownerId,
      correctionId,
      correlationId,
      JSON.stringify({ operation, transitionId, threadId: input.threadId, mailboxId: input.scope.mailboxId }),
    ],
  );
  await client.query(
    `INSERT INTO outbox_events(
       aggregate_type,aggregate_id,event_type,payload,correlation_id
     ) VALUES('priority_correction',$1,'priority_evaluation.invalidate',$2,$3)`,
    [
      correctionId,
      JSON.stringify({
        ownerId: input.scope.ownerId,
        mailboxId: input.scope.mailboxId,
        threadId: input.threadId,
        correctionTransitionId: transitionId,
      }),
      correlationId,
    ],
  );
}

function result(
  disposition: PriorityCorrectionMutationResult["disposition"],
  aggregate: PriorityCorrectionAggregate | null,
  authority: PriorityCorrectionAuthority,
  transition: PriorityCorrectionTransition | null,
): PriorityCorrectionMutationResult {
  return Object.freeze({ disposition, aggregate, authority, transition });
}

export async function findActiveCorrection(rawInput: PriorityCorrectionLookupInput): Promise<PriorityCorrectionAuthority> {
  const input = lookupInput(rawInput);
  try {
    await requireScopedThread(pool, input, false);
    return mapAuthority(await selectCurrent(pool, input, false));
  } catch (error) {
    preserveOrMapError(error);
  }
}

async function mutate(
  rawInput: PriorityCorrectionMutationInput,
  operation: PriorityCorrectionOperation,
): Promise<PriorityCorrectionMutationResult> {
  const input = mutationInput(rawInput);
  try {
    return await withTransaction(async (client) => {
      await requireScopedThread(client, input, true);

      const idempotent = await selectIdempotentTransition(client, input);
      if (idempotent !== null) {
        const transition = exactReplay(idempotent, input, operation);
        const replayCurrent = await selectCurrent(client, input, true);
        return result("REPLAYED", mapAggregate(replayCurrent), mapAuthority(replayCurrent), transition);
      }

      const current = await selectCurrent(client, input, true);
      if (current === null) {
        if (input.expectedTransitionId !== null) throw new PriorityCorrectionConflictError();
        if (operation === "UNDO") {
          return result("NO_CHANGE", null, mapAuthority(null), null);
        }

        const correctionId = randomUUID();
        const transitionId = randomUUID();
        await client.query(
          `INSERT INTO priority_corrections(
             id,owner_id,mailbox_account_id,thread_id,current_transition_id
           ) VALUES($1,$2,$3,$4,$5)`,
          [correctionId, input.scope.ownerId, input.scope.mailboxId, input.threadId, transitionId],
        );
        const inserted = await client.query<TransitionRow>(
          `INSERT INTO priority_correction_transitions(
             id,correction_id,owner_id,mailbox_account_id,thread_id,operation,
             previous_transition_id,idempotency_key
           ) VALUES($1,$2,$3,$4,$5,$6,NULL,$7)
           RETURNING id AS "transitionId", correction_id AS "correctionId", owner_id AS "ownerId",
                     mailbox_account_id AS "mailboxId", thread_id AS "threadId", operation,
                     previous_transition_id AS "previousTransitionId", idempotency_key AS "idempotencyKey",
                     transitioned_at AS "transitionedAt"`,
          [
            transitionId, correctionId, input.scope.ownerId, input.scope.mailboxId,
            input.threadId, operation, input.idempotencyKey,
          ],
        );
        await writeFacts(client, input, correctionId, transitionId, operation);
        const appliedCurrent = await selectCurrent(client, input, false);
        return result(
          "APPLIED",
          mapAggregate(appliedCurrent),
          mapAuthority(appliedCurrent),
          mapTransition(inserted.rows[0]),
        );
      }

      const currentTransition = mapTransition({
        transitionId: current.transitionId,
        correctionId: current.correctionId,
        ownerId: current.ownerId,
        mailboxId: current.mailboxId,
        threadId: current.threadId,
        operation: current.operation,
        previousTransitionId: current.previousTransitionId,
        idempotencyKey: current.idempotencyKey,
        transitionedAt: current.transitionedAt,
      });
      if (input.expectedTransitionId !== currentTransition.transitionId) {
        throw new PriorityCorrectionConflictError();
      }
      if (currentTransition.operation === operation || (operation === "UNDO" && currentTransition.operation === "UNDO")) {
        return result("NO_CHANGE", mapAggregate(current), mapAuthority(current), null);
      }

      const transitionId = randomUUID();
      const inserted = await client.query<TransitionRow>(
        `INSERT INTO priority_correction_transitions(
           id,correction_id,owner_id,mailbox_account_id,thread_id,operation,
           previous_transition_id,idempotency_key
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id AS "transitionId", correction_id AS "correctionId", owner_id AS "ownerId",
                   mailbox_account_id AS "mailboxId", thread_id AS "threadId", operation,
                   previous_transition_id AS "previousTransitionId", idempotency_key AS "idempotencyKey",
                   transitioned_at AS "transitionedAt"`,
        [
          transitionId, currentTransition.correctionId, input.scope.ownerId, input.scope.mailboxId,
          input.threadId, operation, currentTransition.transitionId, input.idempotencyKey,
        ],
      );
      const updated = await client.query(
        `UPDATE priority_corrections SET current_transition_id=$2
         WHERE id=$1 AND owner_id=$3 AND mailbox_account_id=$4 AND thread_id=$5
           AND current_transition_id=$6`,
        [
          currentTransition.correctionId, transitionId, input.scope.ownerId, input.scope.mailboxId,
          input.threadId, input.expectedTransitionId,
        ],
      );
      if (updated.rowCount !== 1) throw new PriorityCorrectionConflictError();
      await writeFacts(client, input, currentTransition.correctionId, transitionId, operation);
      const appliedCurrent = await selectCurrent(client, input, false);
      return result(
        "APPLIED",
        mapAggregate(appliedCurrent),
        mapAuthority(appliedCurrent),
        mapTransition(inserted.rows[0]),
      );
    });
  } catch (error) {
    preserveOrMapError(error);
  }
}

export function applyPrioritizeCorrection(input: PriorityCorrectionMutationInput): Promise<PriorityCorrectionMutationResult> {
  return mutate(input, "PRIORITIZE");
}

export function applyNotImportantCorrection(input: PriorityCorrectionMutationInput): Promise<PriorityCorrectionMutationResult> {
  return mutate(input, "NOT_IMPORTANT");
}

export function undoCorrection(input: PriorityCorrectionMutationInput): Promise<PriorityCorrectionMutationResult> {
  return mutate(input, "UNDO");
}

export async function listCorrectionTransitions(
  rawInput: PriorityCorrectionLookupInput,
): Promise<readonly PriorityCorrectionTransition[]> {
  const input = lookupInput(rawInput);
  try {
    await requireScopedThread(pool, input, false);
    const current = await selectCurrent(pool, input, false);
    if (current === null) return Object.freeze([]);
    const correctionId = rowIdentity(current.correctionId, "correctionId");
    const rows = await pool.query<TransitionRow>(
      `SELECT id AS "transitionId", correction_id AS "correctionId", owner_id AS "ownerId",
              mailbox_account_id AS "mailboxId", thread_id AS "threadId", operation,
              previous_transition_id AS "previousTransitionId", idempotency_key AS "idempotencyKey",
              transitioned_at AS "transitionedAt"
       FROM priority_correction_transitions
       WHERE correction_id=$1 AND owner_id=$2 AND mailbox_account_id=$3 AND thread_id=$4`,
      [correctionId, input.scope.ownerId, input.scope.mailboxId, input.threadId],
    );
    const transitions = rows.rows.map(mapTransition);
    const byId = new Map(transitions.map((transition) => [transition.transitionId, transition]));
    if (byId.size !== transitions.length) {
      throw new PriorityCorrectionPersistenceError("priority correction history contains duplicate transitions");
    }
    const successorCounts = new Map<string, number>();
    for (const transition of transitions) {
      if (transition.previousTransitionId !== null) {
        successorCounts.set(
          transition.previousTransitionId,
          (successorCounts.get(transition.previousTransitionId) ?? 0) + 1,
        );
      }
    }
    if ([...successorCounts.values()].some((count) => count !== 1)) {
      throw new PriorityCorrectionPersistenceError("priority correction history contains duplicate successors");
    }

    const orderedNewestFirst: PriorityCorrectionTransition[] = [];
    const seen = new Set<string>();
    let cursor: PriorityCorrectionTransition | undefined = byId.get(rowIdentity(current.currentTransitionId, "currentTransitionId"));
    while (cursor !== undefined) {
      if (seen.has(cursor.transitionId)) {
        throw new PriorityCorrectionPersistenceError("priority correction history contains a loop");
      }
      seen.add(cursor.transitionId);
      orderedNewestFirst.push(cursor);
      if (cursor.previousTransitionId === null) break;
      cursor = byId.get(cursor.previousTransitionId);
      if (cursor === undefined) {
        throw new PriorityCorrectionPersistenceError("priority correction history contains a broken link");
      }
    }
    if (
      orderedNewestFirst.length !== transitions.length
      || orderedNewestFirst.at(-1)?.previousTransitionId !== null
    ) {
      throw new PriorityCorrectionPersistenceError("priority correction history root does not match the current chain");
    }
    return Object.freeze(orderedNewestFirst.reverse().map((transition) => mapTransition({
      transitionId: transition.transitionId,
      correctionId: transition.correctionId,
      ownerId: transition.scope.ownerId,
      mailboxId: transition.scope.mailboxId,
      threadId: transition.threadId,
      operation: transition.operation,
      previousTransitionId: transition.previousTransitionId,
      idempotencyKey: transition.idempotencyKey,
      transitionedAt: transition.transitionedAt,
    })));
  } catch (error) {
    preserveOrMapError(error);
  }
}
