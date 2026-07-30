import type { PoolClient } from "pg";
import { pool, withTransaction } from "../index.js";
import type {
  ListProviderBindingTransitionsInput,
  ProviderBinding,
  ProviderBindingLifecycle,
  ProviderBindingMutationInput,
  ProviderBindingScope,
  ProviderBindingTransition,
  ReactivateProviderBindingInput,
  ReplaceProviderBindingInput,
  ResolveOrCreateProviderBindingInput,
  ScopedProviderLocatorInput,
} from "../provider-binding/contract.js";
import {
  InvalidProviderBindingInputError,
  createProviderLocator,
  providerLocatorsEqual,
} from "../provider-binding/provider-locator.js";

export type {
  ProviderBinding,
  ProviderBindingLifecycle,
  ProviderBindingScope,
  ProviderBindingTransition,
  ProviderLocator,
} from "../provider-binding/contract.js";
export { InvalidProviderBindingInputError } from "../provider-binding/provider-locator.js";

export class ProviderBindingNotFoundError extends Error {
  constructor() {
    super("provider binding was not found in the authenticated scope");
    this.name = "ProviderBindingNotFoundError";
  }
}

export class ProviderBindingConflictError extends Error {
  constructor(message = "provider binding conflicts with current durable state") {
    super(message);
    this.name = "ProviderBindingConflictError";
  }
}

export class InvalidProviderBindingTransitionError extends Error {
  constructor(message = "provider binding lifecycle transition is invalid") {
    super(message);
    this.name = "InvalidProviderBindingTransitionError";
  }
}

export class ProviderBindingPersistenceError extends Error {
  readonly retryable: boolean;

  constructor(message = "provider binding persistence failed", options?: { cause?: unknown; retryable?: boolean }) {
    super(message, { cause: options?.cause });
    this.name = "ProviderBindingPersistenceError";
    this.retryable = options?.retryable ?? false;
  }
}

type BindingRow = {
  threadId: string;
  ownerId: string;
  mailboxId: string;
  bindingId: string;
  provider: unknown;
  providerAccountLocator: unknown;
  providerThreadLocator: unknown;
  transitionId: string;
  lifecycle: unknown;
  previousTransitionId: string | null;
  transitionedAt: unknown;
};

type TransitionRow = {
  transitionId: string;
  bindingId: string;
  lifecycle: unknown;
  previousTransitionId: string | null;
  transitionedAt: unknown;
  depth?: number;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const lifecycleValues = new Set<ProviderBindingLifecycle>(["ACTIVE", "SUSPENDED", "RETIRED"]);
const retryableCodes = new Set(["40001", "40P01"]);

function identity(value: unknown, label: string): string {
  if (typeof value !== "string" || !uuid.test(value)) {
    throw new InvalidProviderBindingInputError(`${label} must be a UUID`);
  }
  return value;
}

function scope(value: unknown): ProviderBindingScope {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new InvalidProviderBindingInputError("scope must be an ordinary object");
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 2 || !Object.hasOwn(record, "ownerId") || !Object.hasOwn(record, "mailboxId")) {
    throw new InvalidProviderBindingInputError("scope must contain exactly ownerId and mailboxId");
  }
  return Object.freeze({
    ownerId: identity(record.ownerId, "ownerId"),
    mailboxId: identity(record.mailboxId, "mailboxId"),
  });
}

function canonicalTimestamp(value: unknown): string {
  const date = value instanceof Date
    ? new Date(value.valueOf())
    : typeof value === "string"
      ? new Date(value)
      : null;
  if (date === null || Number.isNaN(date.valueOf())) {
    throw new ProviderBindingPersistenceError("provider binding row contains an invalid transition timestamp");
  }
  const canonical = date.toISOString();
  if (!canonical.endsWith("Z") || Number.isNaN(Date.parse(canonical))) {
    throw new ProviderBindingPersistenceError("provider binding timestamp is not canonical UTC");
  }
  return canonical;
}

function mapLifecycle(value: unknown): ProviderBindingLifecycle {
  if (typeof value !== "string" || !lifecycleValues.has(value as ProviderBindingLifecycle)) {
    throw new ProviderBindingPersistenceError("provider binding row contains an invalid lifecycle");
  }
  return value as ProviderBindingLifecycle;
}

function mapTransition(row: TransitionRow): ProviderBindingTransition {
  return Object.freeze({
    transitionId: identityFromRow(row.transitionId, "transitionId"),
    bindingId: identityFromRow(row.bindingId, "bindingId"),
    lifecycle: mapLifecycle(row.lifecycle),
    previousTransitionId: row.previousTransitionId === null
      ? null
      : identityFromRow(row.previousTransitionId, "previousTransitionId"),
    transitionedAt: canonicalTimestamp(row.transitionedAt),
  });
}

function identityFromRow(value: unknown, label: string): string {
  if (typeof value !== "string" || !uuid.test(value)) {
    throw new ProviderBindingPersistenceError(`provider binding row contains an invalid ${label}`);
  }
  return value;
}

function mapBinding(row: BindingRow): ProviderBinding {
  const mappedScope = Object.freeze({
    ownerId: identityFromRow(row.ownerId, "ownerId"),
    mailboxId: identityFromRow(row.mailboxId, "mailboxId"),
  });
  let locator;
  try {
    locator = createProviderLocator({
      provider: row.provider,
      providerAccountLocator: row.providerAccountLocator,
      providerThreadLocator: row.providerThreadLocator,
    });
  } catch (error) {
    throw new ProviderBindingPersistenceError("provider binding row contains an invalid locator", { cause: error });
  }
  return Object.freeze({
    threadId: identityFromRow(row.threadId, "threadId"),
    bindingId: identityFromRow(row.bindingId, "bindingId"),
    scope: mappedScope,
    locator,
    currentTransition: mapTransition(row),
  });
}

function code(error: unknown): string | undefined {
  return error !== null && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

function preserveOrMapError(error: unknown): never {
  if (
    error instanceof InvalidProviderBindingInputError
    || error instanceof ProviderBindingNotFoundError
    || error instanceof ProviderBindingConflictError
    || error instanceof InvalidProviderBindingTransitionError
    || error instanceof ProviderBindingPersistenceError
  ) {
    throw error;
  }
  const databaseCode = code(error);
  if (databaseCode === "23505" || databaseCode === "23503" || databaseCode === "23514") {
    throw new ProviderBindingConflictError();
  }
  throw new ProviderBindingPersistenceError("provider binding persistence failed", {
    cause: error,
    retryable: databaseCode !== undefined && retryableCodes.has(databaseCode),
  });
}

const bindingSelection = `
  SELECT
    a.id AS "threadId",
    a.owner_id AS "ownerId",
    a.mailbox_account_id AS "mailboxId",
    b.id AS "bindingId",
    b.provider,
    b.provider_account_locator AS "providerAccountLocator",
    b.provider_thread_locator AS "providerThreadLocator",
    t.id AS "transitionId",
    t.lifecycle,
    t.previous_transition_id AS "previousTransitionId",
    t.transitioned_at AS "transitionedAt"
  FROM application_threads a
  JOIN thread_provider_binding_transitions t ON t.id = a.current_transition_id
  JOIN thread_provider_bindings b ON b.id = t.binding_id
`;

async function selectScopedThread(
  client: Pick<PoolClient, "query">,
  inputScope: ProviderBindingScope,
  threadId: string,
  lock = false,
): Promise<BindingRow | null> {
  const result = await client.query<BindingRow>(
    `${bindingSelection}
     WHERE a.id=$1 AND a.owner_id=$2 AND a.mailbox_account_id=$3
     ${lock ? "FOR UPDATE OF a, t" : ""}`,
    [threadId, inputScope.ownerId, inputScope.mailboxId],
  );
  return result.rows[0] ?? null;
}

async function selectLocator(
  client: Pick<PoolClient, "query">,
  locator: ReturnType<typeof createProviderLocator>,
  lock = false,
): Promise<BindingRow | null> {
  const result = await client.query<BindingRow>(
    `${bindingSelection}
     WHERE b.provider=$1
       AND b.provider_account_locator=$2
       AND b.provider_thread_locator=$3
     ${lock ? "FOR UPDATE OF a, t, b" : ""}`,
    [locator.provider, locator.providerAccountLocator, locator.providerThreadLocator],
  );
  return result.rows[0] ?? null;
}

export async function findProviderBinding(input: ScopedProviderLocatorInput): Promise<ProviderBinding | null> {
  const inputScope = scope(input?.scope);
  const locator = createProviderLocator(input?.locator);
  try {
    const row = await selectLocator(pool, locator);
    if (row === null || row.ownerId !== inputScope.ownerId || row.mailboxId !== inputScope.mailboxId) {
      return null;
    }
    return mapBinding(row);
  } catch (error) {
    preserveOrMapError(error);
  }
}

async function createBinding(input: {
  scope: ProviderBindingScope;
  proposedThreadId: string;
  locator: ReturnType<typeof createProviderLocator>;
}): Promise<ProviderBinding> {
  return withTransaction(async (client) => {
    const existingLocator = await selectLocator(client, input.locator, true);
    if (existingLocator !== null) {
      if (
        existingLocator.threadId !== input.proposedThreadId
        || existingLocator.ownerId !== input.scope.ownerId
        || existingLocator.mailboxId !== input.scope.mailboxId
      ) {
        throw new ProviderBindingConflictError();
      }
      return mapBinding(existingLocator);
    }

    const existingThread = await client.query<{
      ownerId: string;
      mailboxId: string;
      provider: unknown;
      providerAccountLocator: unknown;
      providerThreadLocator: unknown;
    }>(
      `SELECT a.owner_id AS "ownerId", a.mailbox_account_id AS "mailboxId",
              b.provider, b.provider_account_locator AS "providerAccountLocator",
              b.provider_thread_locator AS "providerThreadLocator"
       FROM application_threads a
       JOIN thread_provider_binding_transitions t ON t.id=a.current_transition_id
       JOIN thread_provider_bindings b ON b.id=t.binding_id
       WHERE a.id=$1
       FOR UPDATE OF a, t`,
      [input.proposedThreadId],
    );
    if (existingThread.rowCount) {
      const row = existingThread.rows[0];
      let currentLocator;
      try {
        currentLocator = createProviderLocator({
          provider: row.provider,
          providerAccountLocator: row.providerAccountLocator,
          providerThreadLocator: row.providerThreadLocator,
        });
      } catch (error) {
        throw new ProviderBindingPersistenceError("provider binding row contains an invalid locator", { cause: error });
      }
      if (
        row.ownerId !== input.scope.ownerId
        || row.mailboxId !== input.scope.mailboxId
        || !providerLocatorsEqual(currentLocator, input.locator)
      ) {
        throw new ProviderBindingConflictError();
      }
      const current = await selectScopedThread(client, input.scope, input.proposedThreadId);
      if (current === null) throw new ProviderBindingPersistenceError("current binding row disappeared");
      return mapBinding(current);
    }

    const mailbox = await client.query(
      `SELECT 1 FROM mailbox_accounts
       WHERE id=$1 AND user_id=$2 AND provider=$3 AND provider_account_id=$4
       FOR KEY SHARE`,
      [
        input.scope.mailboxId,
        input.scope.ownerId,
        input.locator.provider,
        input.locator.providerAccountLocator,
      ],
    );
    if (!mailbox.rowCount) throw new ProviderBindingConflictError();

    await client.query(
      `INSERT INTO application_threads(id,owner_id,mailbox_account_id)
       VALUES($1,$2,$3)`,
      [input.proposedThreadId, input.scope.ownerId, input.scope.mailboxId],
    );
    const binding = await client.query<{ bindingId: string }>(
      `INSERT INTO thread_provider_bindings(
         thread_id,owner_id,mailbox_account_id,provider,provider_account_locator,provider_thread_locator
       ) VALUES($1,$2,$3,$4,$5,$6)
       RETURNING id AS "bindingId"`,
      [
        input.proposedThreadId,
        input.scope.ownerId,
        input.scope.mailboxId,
        input.locator.provider,
        input.locator.providerAccountLocator,
        input.locator.providerThreadLocator,
      ],
    );
    const transition = await client.query<{ transitionId: string }>(
      `INSERT INTO thread_provider_binding_transitions(
         thread_id,owner_id,mailbox_account_id,binding_id,lifecycle
       ) VALUES($1,$2,$3,$4,'ACTIVE')
       RETURNING id AS "transitionId"`,
      [input.proposedThreadId, input.scope.ownerId, input.scope.mailboxId, binding.rows[0].bindingId],
    );
    await client.query(
      `UPDATE application_threads SET current_transition_id=$4
       WHERE id=$1 AND owner_id=$2 AND mailbox_account_id=$3`,
      [input.proposedThreadId, input.scope.ownerId, input.scope.mailboxId, transition.rows[0].transitionId],
    );
    const created = await selectScopedThread(client, input.scope, input.proposedThreadId);
    if (created === null) throw new ProviderBindingPersistenceError("created binding could not be read");
    return mapBinding(created);
  });
}

export async function resolveOrCreateProviderBinding(
  input: ResolveOrCreateProviderBindingInput,
): Promise<ProviderBinding> {
  const copied = {
    scope: scope(input?.scope),
    proposedThreadId: identity(input?.proposedThreadId, "proposedThreadId"),
    locator: createProviderLocator(input?.locator),
  };
  try {
    return await createBinding(copied);
  } catch (error) {
    if (code(error) === "23505") {
      const existing = await findProviderBinding({ scope: copied.scope, locator: copied.locator });
      if (existing !== null && existing.threadId === copied.proposedThreadId) return existing;
    }
    preserveOrMapError(error);
  }
}

async function transitionBinding(
  rawInput: ProviderBindingMutationInput,
  operation: "suspend" | "reactivate" | "retire",
  authenticatedScopedIntent = false,
): Promise<ProviderBinding> {
  const input = {
    scope: scope(rawInput?.scope),
    threadId: identity(rawInput?.threadId, "threadId"),
    expectedTransitionId: identity(rawInput?.expectedTransitionId, "expectedTransitionId"),
  };
  try {
    return await withTransaction(async (client) => {
      const current = await selectScopedThread(client, input.scope, input.threadId, true);
      if (current === null) throw new ProviderBindingNotFoundError();
      if (current.transitionId !== input.expectedTransitionId) throw new ProviderBindingConflictError();
      const currentLifecycle = mapLifecycle(current.lifecycle);
      const target: ProviderBindingLifecycle = operation === "suspend"
        ? "SUSPENDED"
        : operation === "retire"
          ? "RETIRED"
          : "ACTIVE";
      if (currentLifecycle === target) return mapBinding(current);
      const allowed = operation === "suspend"
        ? currentLifecycle === "ACTIVE"
        : operation === "retire"
          ? currentLifecycle === "ACTIVE" || currentLifecycle === "SUSPENDED"
          : currentLifecycle === "SUSPENDED" || (currentLifecycle === "RETIRED" && authenticatedScopedIntent);
      if (!allowed) throw new InvalidProviderBindingTransitionError();

      const inserted = await client.query<{ transitionId: string }>(
        `INSERT INTO thread_provider_binding_transitions(
           thread_id,owner_id,mailbox_account_id,binding_id,lifecycle,previous_transition_id
         ) VALUES($1,$2,$3,$4,$5,$6)
         RETURNING id AS "transitionId"`,
        [
          input.threadId,
          input.scope.ownerId,
          input.scope.mailboxId,
          current.bindingId,
          target,
          current.transitionId,
        ],
      );
      const updated = await client.query(
        `UPDATE application_threads SET current_transition_id=$4
         WHERE id=$1 AND owner_id=$2 AND mailbox_account_id=$3 AND current_transition_id=$5`,
        [
          input.threadId,
          input.scope.ownerId,
          input.scope.mailboxId,
          inserted.rows[0].transitionId,
          input.expectedTransitionId,
        ],
      );
      if (updated.rowCount !== 1) throw new ProviderBindingConflictError();
      const result = await selectScopedThread(client, input.scope, input.threadId);
      if (result === null) throw new ProviderBindingPersistenceError("transitioned binding could not be read");
      return mapBinding(result);
    });
  } catch (error) {
    preserveOrMapError(error);
  }
}

export function suspendProviderBinding(input: ProviderBindingMutationInput): Promise<ProviderBinding> {
  return transitionBinding(input, "suspend");
}

export function reactivateProviderBinding(input: ReactivateProviderBindingInput): Promise<ProviderBinding> {
  return transitionBinding(input, "reactivate", input?.authenticatedScopedIntent === true);
}

export function retireProviderBinding(input: ProviderBindingMutationInput): Promise<ProviderBinding> {
  return transitionBinding(input, "retire");
}

export async function replaceProviderBinding(input: ReplaceProviderBindingInput): Promise<ProviderBinding> {
  const copied = {
    scope: scope(input?.scope),
    threadId: identity(input?.threadId, "threadId"),
    expectedTransitionId: identity(input?.expectedTransitionId, "expectedTransitionId"),
    locator: createProviderLocator(input?.locator),
  };
  try {
    return await withTransaction(async (client) => {
      const claimed = await selectLocator(client, copied.locator, true);
      if (claimed !== null) throw new ProviderBindingConflictError();
      const current = await selectScopedThread(client, copied.scope, copied.threadId, true);
      if (current === null) throw new ProviderBindingNotFoundError();
      if (current.transitionId !== copied.expectedTransitionId) throw new ProviderBindingConflictError();
      if (mapLifecycle(current.lifecycle) === "RETIRED") {
        throw new InvalidProviderBindingTransitionError("a retired current binding cannot be replaced");
      }
      const currentLocator = createProviderLocator({
        provider: current.provider,
        providerAccountLocator: current.providerAccountLocator,
        providerThreadLocator: current.providerThreadLocator,
      });
      if (providerLocatorsEqual(currentLocator, copied.locator)) {
        throw new ProviderBindingConflictError("replacement locator must differ from the current locator");
      }
      const retired = await client.query<{ transitionId: string }>(
        `INSERT INTO thread_provider_binding_transitions(
           thread_id,owner_id,mailbox_account_id,binding_id,lifecycle,previous_transition_id
         ) VALUES($1,$2,$3,$4,'RETIRED',$5)
         RETURNING id AS "transitionId"`,
        [
          copied.threadId,
          copied.scope.ownerId,
          copied.scope.mailboxId,
          current.bindingId,
          current.transitionId,
        ],
      );
      const binding = await client.query<{ bindingId: string }>(
        `INSERT INTO thread_provider_bindings(
           thread_id,owner_id,mailbox_account_id,provider,provider_account_locator,provider_thread_locator
         ) VALUES($1,$2,$3,$4,$5,$6)
         RETURNING id AS "bindingId"`,
        [
          copied.threadId,
          copied.scope.ownerId,
          copied.scope.mailboxId,
          copied.locator.provider,
          copied.locator.providerAccountLocator,
          copied.locator.providerThreadLocator,
        ],
      );
      const active = await client.query<{ transitionId: string }>(
        `INSERT INTO thread_provider_binding_transitions(
           thread_id,owner_id,mailbox_account_id,binding_id,lifecycle,previous_transition_id
         ) VALUES($1,$2,$3,$4,'ACTIVE',$5)
         RETURNING id AS "transitionId"`,
        [
          copied.threadId,
          copied.scope.ownerId,
          copied.scope.mailboxId,
          binding.rows[0].bindingId,
          retired.rows[0].transitionId,
        ],
      );
      const updated = await client.query(
        `UPDATE application_threads SET current_transition_id=$4
         WHERE id=$1 AND owner_id=$2 AND mailbox_account_id=$3 AND current_transition_id=$5`,
        [
          copied.threadId,
          copied.scope.ownerId,
          copied.scope.mailboxId,
          active.rows[0].transitionId,
          copied.expectedTransitionId,
        ],
      );
      if (updated.rowCount !== 1) throw new ProviderBindingConflictError();
      const result = await selectScopedThread(client, copied.scope, copied.threadId);
      if (result === null) throw new ProviderBindingPersistenceError("replacement binding could not be read");
      return mapBinding(result);
    });
  } catch (error) {
    preserveOrMapError(error);
  }
}

export async function listProviderBindingTransitions(
  input: ListProviderBindingTransitionsInput,
): Promise<readonly ProviderBindingTransition[]> {
  const inputScope = scope(input?.scope);
  const threadId = identity(input?.threadId, "threadId");
  try {
    const result = await pool.query<TransitionRow>(
      `WITH RECURSIVE history AS (
         SELECT t.id, t.binding_id, t.lifecycle, t.previous_transition_id, t.transitioned_at, 0 AS depth
         FROM application_threads a
         JOIN thread_provider_binding_transitions t ON t.id=a.current_transition_id
         WHERE a.id=$1 AND a.owner_id=$2 AND a.mailbox_account_id=$3
         UNION ALL
         SELECT previous.id, previous.binding_id, previous.lifecycle,
                previous.previous_transition_id, previous.transitioned_at, history.depth + 1
         FROM history
         JOIN thread_provider_binding_transitions previous ON previous.id=history.previous_transition_id
       )
       SELECT id AS "transitionId", binding_id AS "bindingId", lifecycle,
              previous_transition_id AS "previousTransitionId",
              transitioned_at AS "transitionedAt", depth
       FROM history
       ORDER BY depth DESC`,
      [threadId, inputScope.ownerId, inputScope.mailboxId],
    );
    return Object.freeze(result.rows.map((row) => mapTransition(row)));
  } catch (error) {
    preserveOrMapError(error);
  }
}
