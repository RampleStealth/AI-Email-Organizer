import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import * as repository from "../src/repositories/priority-correction-repository.js";

const databaseUrl = process.env.DATABASE_URL;

async function createFixture(client: pg.Client) {
  const ownerId = crypto.randomUUID();
  const otherOwnerId = crypto.randomUUID();
  const mailboxId = crypto.randomUUID();
  const otherMailboxId = crypto.randomUUID();
  const threadId = crypto.randomUUID();
  await client.query(
    "INSERT INTO users(id,email_normalized) VALUES($1,$2),($3,$4)",
    [ownerId, `${ownerId}@test.invalid`, otherOwnerId, `${otherOwnerId}@test.invalid`],
  );
  await client.query(
    `INSERT INTO mailbox_accounts(
       id,user_id,provider,provider_account_id,email_address,encrypted_refresh_token,granted_scopes
     ) VALUES($1,$2,'gmail',$3,$4,'test','{}'),($5,$6,'gmail',$7,$8,'test','{}')`,
    [
      mailboxId, ownerId, `account-${mailboxId}`, `${mailboxId}@test.invalid`,
      otherMailboxId, otherOwnerId, `account-${otherMailboxId}`, `${otherMailboxId}@test.invalid`,
    ],
  );
  const bindingId = crypto.randomUUID();
  const transitionId = crypto.randomUUID();
  await client.query("BEGIN");
  await client.query(
    "INSERT INTO application_threads(id,owner_id,mailbox_account_id,current_transition_id) VALUES($1,$2,$3,$4)",
    [threadId, ownerId, mailboxId, transitionId],
  );
  await client.query(
    `INSERT INTO thread_provider_bindings(
       id,thread_id,owner_id,mailbox_account_id,provider,provider_account_locator,provider_thread_locator
     ) VALUES($1,$2,$3,$4,'gmail',$5,$6)`,
    [bindingId, threadId, ownerId, mailboxId, `account-${mailboxId}`, `thread-${threadId}`],
  );
  await client.query(
    `INSERT INTO thread_provider_binding_transitions(
       id,thread_id,owner_id,mailbox_account_id,binding_id,lifecycle
     ) VALUES($1,$2,$3,$4,$5,'ACTIVE')`,
    [transitionId, threadId, ownerId, mailboxId, bindingId],
  );
  await client.query("COMMIT");
  return { ownerId, otherOwnerId, mailboxId, otherMailboxId, threadId, bindingTransitionId: transitionId };
}

test("repository creates, replaces, undoes, replays, and freezes correction authority", {
  skip: databaseUrl ? false : "DATABASE_URL is required for PostgreSQL integration contracts",
}, async () => {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const fixture = await createFixture(client);
  const scope = { ownerId: fixture.ownerId, mailboxId: fixture.mailboxId };
  try {
    assert.deepEqual(await repository.findActiveCorrection({ scope, threadId: fixture.threadId }), {
      state: "VERIFIED_ABSENT", correctionId: null, transitionId: null,
    });

    const firstInput = {
      scope,
      threadId: fixture.threadId,
      expectedTransitionId: null,
      idempotencyKey: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
    };
    const prioritized = await repository.applyPrioritizeCorrection(firstInput);
    assert.equal(prioritized.disposition, "APPLIED");
    assert.equal(prioritized.authority.state, "VERIFIED_ACTIVE");
    assert.equal(prioritized.authority.state === "VERIFIED_ACTIVE" && prioritized.authority.kind, "PRIORITIZE");
    assert.equal(Object.isFrozen(prioritized), true);
    assert.equal(Object.isFrozen(prioritized.aggregate), true);
    assert.equal(Object.isFrozen(prioritized.aggregate?.scope), true);
    assert.equal(Object.isFrozen(prioritized.authority), true);
    assert.equal(Object.isFrozen(prioritized.transition), true);
    assert.equal(Object.isFrozen(prioritized.authority.scope), true);
    assert.equal(typeof prioritized.transition?.transitionedAt, "string");
    assert.match(prioritized.transition?.transitionedAt ?? "", /Z$/);

    const replayed = await repository.applyPrioritizeCorrection(firstInput);
    assert.equal(replayed.disposition, "REPLAYED");
    assert.deepEqual(replayed.transition, prioritized.transition);
    assert.notEqual(replayed, prioritized);

    const noChange = await repository.applyPrioritizeCorrection({
      ...firstInput,
      expectedTransitionId: prioritized.transition?.transitionId ?? null,
      idempotencyKey: crypto.randomUUID(),
    });
    assert.equal(noChange.disposition, "NO_CHANGE");
    assert.equal(noChange.transition, null);

    const replaced = await repository.applyNotImportantCorrection({
      ...firstInput,
      expectedTransitionId: prioritized.transition?.transitionId ?? null,
      idempotencyKey: crypto.randomUUID(),
    });
    assert.equal(replaced.disposition, "APPLIED");
    assert.equal(replaced.authority.state === "VERIFIED_ACTIVE" && replaced.authority.kind, "NOT_IMPORTANT");

    const undoInput = {
      ...firstInput,
      expectedTransitionId: replaced.transition?.transitionId ?? null,
      idempotencyKey: crypto.randomUUID(),
    };
    const undone = await repository.undoCorrection(undoInput);
    assert.equal(undone.disposition, "APPLIED");
    assert.deepEqual(undone.authority.state, "VERIFIED_ABSENT");
    assert.equal(undone.authority.transitionId, undone.transition?.transitionId);
    const replayedUndo = await repository.undoCorrection(undoInput);
    assert.equal(replayedUndo.disposition, "REPLAYED");
    assert.deepEqual(replayedUndo.transition, undone.transition);

    const repeatedUndo = await repository.undoCorrection({
      ...firstInput,
      expectedTransitionId: undone.transition?.transitionId ?? null,
      idempotencyKey: crypto.randomUUID(),
    });
    assert.equal(repeatedUndo.disposition, "NO_CHANGE");
    assert.equal(repeatedUndo.transition, null);

    const afterUndo = await repository.applyPrioritizeCorrection({
      ...firstInput,
      expectedTransitionId: undone.authority.transitionId,
      idempotencyKey: crypto.randomUUID(),
    });
    assert.equal(afterUndo.transition?.previousTransitionId, undone.authority.transitionId);

    const history = await repository.listCorrectionTransitions({ scope, threadId: fixture.threadId });
    assert.deepEqual(history.map((entry: { operation: string }) => entry.operation), [
      "PRIORITIZE", "NOT_IMPORTANT", "UNDO", "PRIORITIZE",
    ]);
    assert.equal(Object.isFrozen(history), true);
    assert.equal(history.every(Object.isFrozen), true);
    const detached = await repository.listCorrectionTransitions({ scope, threadId: fixture.threadId });
    assert.notEqual(detached, history);

    const providerRepository = await import("../src/repositories/thread-provider-binding-repository.js");
    await providerRepository.suspendProviderBinding({
      scope,
      threadId: fixture.threadId,
      expectedTransitionId: fixture.bindingTransitionId,
    });
    assert.equal(
      (await repository.findActiveCorrection({ scope, threadId: fixture.threadId })).transitionId,
      afterUndo.transition?.transitionId,
    );

    await client.query(
      `INSERT INTO threads(id,mailbox_account_id,provider_thread_id)
       VALUES($1,$2,$3)`,
      [fixture.threadId, fixture.mailboxId, `projection-${fixture.threadId}`],
    );
    await client.query("DELETE FROM threads WHERE id=$1", [fixture.threadId]);
    assert.equal(
      (await repository.findActiveCorrection({ scope, threadId: fixture.threadId })).transitionId,
      afterUndo.transition?.transitionId,
    );

    assert.equal(
      (await client.query(
        "SELECT count(*)::int AS count FROM audit_events WHERE object_type='priority_correction' AND object_id=$1",
        [prioritized.authority.correctionId],
      )).rows[0].count,
      4,
    );
    assert.equal(
      (await client.query(
        "SELECT count(*)::int AS count FROM outbox_events WHERE aggregate_type='priority_correction' AND aggregate_id=$1",
        [prioritized.authority.correctionId],
      )).rows[0].count,
      4,
    );
    const facts = await client.query<{ metadata: Record<string, unknown>; payload: Record<string, unknown> }>(
      `SELECT audit.metadata, event.payload
       FROM audit_events audit
       JOIN outbox_events event ON event.correlation_id=audit.correlation_id
       WHERE audit.object_type='priority_correction' AND audit.object_id=$1
       ORDER BY audit.occurred_at
       LIMIT 1`,
      [prioritized.authority.correctionId],
    );
    assert.deepEqual(Object.keys(facts.rows[0].metadata).sort(), ["mailboxId", "operation", "threadId", "transitionId"]);
    assert.deepEqual(Object.keys(facts.rows[0].payload).sort(), ["correctionTransitionId", "mailboxId", "ownerId", "threadId"]);
    assert.equal(JSON.stringify(facts.rows[0]).includes("providerThread"), false);
    assert.equal(JSON.stringify(facts.rows[0]).includes("subject"), false);
  } finally {
    await client.end();
  }
});

test("first Not Important and its direct replacement preserve deterministic authority", {
  skip: databaseUrl ? false : "DATABASE_URL is required for PostgreSQL integration contracts",
}, async () => {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const fixture = await createFixture(client);
  const scope = { ownerId: fixture.ownerId, mailboxId: fixture.mailboxId };
  try {
    const mutableScope = { ...scope };
    const firstPromise = repository.applyNotImportantCorrection({
      scope: mutableScope, threadId: fixture.threadId, expectedTransitionId: null, idempotencyKey: crypto.randomUUID(),
    });
    mutableScope.ownerId = fixture.otherOwnerId;
    const first = await firstPromise;
    assert.equal(first.authority.state === "VERIFIED_ACTIVE" && first.authority.kind, "NOT_IMPORTANT");
    const replacement = await repository.applyPrioritizeCorrection({
      scope,
      threadId: fixture.threadId,
      expectedTransitionId: first.transition?.transitionId ?? null,
      idempotencyKey: crypto.randomUUID(),
    });
    assert.equal(replacement.authority.state === "VERIFIED_ACTIVE" && replacement.authority.kind, "PRIORITIZE");
    assert.equal(replacement.transition?.previousTransitionId, first.transition?.transitionId);
  } finally {
    await client.end();
  }
});

test("retryable PostgreSQL failures remain classified and roll back", {
  skip: databaseUrl ? false : "DATABASE_URL is required for PostgreSQL integration contracts",
}, async () => {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const fixture = await createFixture(client);
  const functionName = `force_correction_retry_${crypto.randomUUID().replaceAll("-", "")}`;
  const triggerName = `force_correction_retry_${crypto.randomUUID().replaceAll("-", "")}`;
  try {
    await client.query(`
      CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'forced serialization failure' USING ERRCODE = '40001';
      END
      $$;
      CREATE TRIGGER ${triggerName}
      BEFORE INSERT ON priority_correction_transitions
      FOR EACH ROW EXECUTE FUNCTION ${functionName}();
    `);
    await assert.rejects(
      repository.applyPrioritizeCorrection({
        scope: { ownerId: fixture.ownerId, mailboxId: fixture.mailboxId },
        threadId: fixture.threadId,
        expectedTransitionId: null,
        idempotencyKey: crypto.randomUUID(),
      }),
      (error: unknown) => error instanceof repository.PriorityCorrectionPersistenceError && error.retryable,
    );
    assert.equal((await client.query(
      "SELECT count(*)::int AS count FROM priority_corrections WHERE thread_id=$1",
      [fixture.threadId],
    )).rows[0].count, 0);
  } finally {
    await client.query(`DROP TRIGGER IF EXISTS ${triggerName} ON priority_correction_transitions`);
    await client.query(`DROP FUNCTION IF EXISTS ${functionName}()`);
    await client.end();
  }
});

test("audit or outbox failure rolls back transition, pointer, and all side effects", {
  skip: databaseUrl ? false : "DATABASE_URL is required for PostgreSQL integration contracts",
}, async () => {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const fixture = await createFixture(client);
  const scope = { ownerId: fixture.ownerId, mailboxId: fixture.mailboxId };
  const functionName = `reject_correction_outbox_${crypto.randomUUID().replaceAll("-", "")}`;
  const triggerName = `reject_correction_outbox_${crypto.randomUUID().replaceAll("-", "")}`;
  try {
    await client.query(`
      CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.event_type = 'priority_evaluation.invalidate' THEN
          RAISE EXCEPTION 'forced correction outbox failure';
        END IF;
        RETURN NEW;
      END
      $$;
      CREATE TRIGGER ${triggerName}
      BEFORE INSERT ON outbox_events
      FOR EACH ROW EXECUTE FUNCTION ${functionName}();
    `);
    await assert.rejects(
      repository.applyPrioritizeCorrection({
        scope, threadId: fixture.threadId, expectedTransitionId: null, idempotencyKey: crypto.randomUUID(),
      }),
      repository.PriorityCorrectionPersistenceError,
    );
    assert.equal((await client.query(
      "SELECT count(*)::int AS count FROM priority_corrections WHERE thread_id=$1",
      [fixture.threadId],
    )).rows[0].count, 0);
    assert.equal((await client.query(
      "SELECT count(*)::int AS count FROM audit_events WHERE object_type='priority_correction' AND metadata->>'threadId'=$1",
      [fixture.threadId],
    )).rows[0].count, 0);
    assert.equal((await client.query(
      "SELECT count(*)::int AS count FROM outbox_events WHERE event_type='priority_evaluation.invalidate' AND payload->>'threadId'=$1",
      [fixture.threadId],
    )).rows[0].count, 0);
  } finally {
    await client.query(`DROP TRIGGER IF EXISTS ${triggerName} ON outbox_events`);
    await client.query(`DROP FUNCTION IF EXISTS ${functionName}()`);
    await client.end();
  }
});

test("repository enforces no-op, stale, idempotency, and scope semantics", {
  skip: databaseUrl ? false : "DATABASE_URL is required for PostgreSQL integration contracts",
}, async () => {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const fixture = await createFixture(client);
  const scope = { ownerId: fixture.ownerId, mailboxId: fixture.mailboxId };
  const key = crypto.randomUUID();
  try {
    const absentUndo = await repository.undoCorrection({
      scope, threadId: fixture.threadId, expectedTransitionId: null, idempotencyKey: key,
    });
    assert.equal(absentUndo.disposition, "NO_CHANGE");
    assert.equal(absentUndo.transition, null);
    assert.equal(await client.query(
      "SELECT count(*)::int AS count FROM priority_corrections WHERE thread_id=$1",
      [fixture.threadId],
    ).then((result) => result.rows[0].count), 0);
    assert.equal((await repository.undoCorrection({
      scope, threadId: fixture.threadId, expectedTransitionId: null, idempotencyKey: key,
    })).disposition, "NO_CHANGE");

    const applied = await repository.applyPrioritizeCorrection({
      scope, threadId: fixture.threadId, expectedTransitionId: null, idempotencyKey: key,
    });
    assert.equal(applied.disposition, "APPLIED");
    await assert.rejects(
      repository.applyNotImportantCorrection({
        scope, threadId: fixture.threadId, expectedTransitionId: null, idempotencyKey: key,
      }),
      repository.PriorityCorrectionConflictError,
    );
    await assert.rejects(
      repository.undoCorrection({
        scope, threadId: fixture.threadId, expectedTransitionId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(),
      }),
      repository.PriorityCorrectionConflictError,
    );
    await assert.rejects(
      repository.findActiveCorrection({
        scope: { ownerId: fixture.otherOwnerId, mailboxId: fixture.mailboxId }, threadId: fixture.threadId,
      }),
      repository.PriorityCorrectionNotFoundError,
    );
    await assert.rejects(
      repository.findActiveCorrection({
        scope: { ownerId: fixture.ownerId, mailboxId: fixture.otherMailboxId }, threadId: fixture.threadId,
      }),
      repository.PriorityCorrectionNotFoundError,
    );
    await assert.rejects(
      repository.findActiveCorrection({ scope, threadId: "malformed" }),
      repository.InvalidPriorityCorrectionInputError,
    );
  } finally {
    await client.end();
  }
});

test("concurrent identical correction commands converge and conflicting commands cannot both commit", {
  skip: databaseUrl ? false : "DATABASE_URL is required for PostgreSQL integration contracts",
}, async () => {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const first = await createFixture(client);
  const second = await createFixture(client);
  try {
    const identicalInput = {
      scope: { ownerId: first.ownerId, mailboxId: first.mailboxId },
      threadId: first.threadId,
      expectedTransitionId: null,
      idempotencyKey: crypto.randomUUID(),
    };
    const identical = await Promise.all([
      repository.applyPrioritizeCorrection(identicalInput),
      repository.applyPrioritizeCorrection(identicalInput),
    ]);
    assert.deepEqual(new Set(identical.map((result: { disposition: string }) => result.disposition)), new Set(["APPLIED", "REPLAYED"]));
    assert.equal(identical[0].transition?.transitionId, identical[1].transition?.transitionId);

    const base = {
      scope: { ownerId: second.ownerId, mailboxId: second.mailboxId },
      threadId: second.threadId,
      expectedTransitionId: null,
    };
    const settled = await Promise.allSettled([
      repository.applyPrioritizeCorrection({ ...base, idempotencyKey: crypto.randomUUID() }),
      repository.applyNotImportantCorrection({ ...base, idempotencyKey: crypto.randomUUID() }),
    ]);
    assert.equal(settled.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(settled.filter((result) => result.status === "rejected").length, 1);
    const rejection = settled.find((result) => result.status === "rejected");
    assert.equal(rejection?.status === "rejected" && rejection.reason instanceof repository.PriorityCorrectionConflictError, true);
  } finally {
    await client.end();
  }
});
