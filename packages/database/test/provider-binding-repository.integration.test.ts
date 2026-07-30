import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;

test("repository resolves, isolates, transitions, and replaces durable bindings", {
  skip: databaseUrl ? false : "DATABASE_URL is required for PostgreSQL integration contracts",
}, async () => {
  const repository = await import("../src/repositories/thread-provider-binding-repository.js");
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const ownerId = crypto.randomUUID();
  const otherOwnerId = crypto.randomUUID();
  const mailboxId = crypto.randomUUID();
  const otherMailboxId = crypto.randomUUID();
  const threadId = crypto.randomUUID();
  const locator = {
    provider: "gmail" as const,
    providerAccountLocator: `account-${crypto.randomUUID()}`,
    providerThreadLocator: `thread-${crypto.randomUUID()}`,
  };
  try {
    await client.query(
      "INSERT INTO users(id,email_normalized) VALUES($1,$2),($3,$4)",
      [ownerId, `${ownerId}@test.invalid`, otherOwnerId, `${otherOwnerId}@test.invalid`],
    );
    await client.query(
      `INSERT INTO mailbox_accounts(
         id,user_id,provider,provider_account_id,email_address,encrypted_refresh_token,granted_scopes
       ) VALUES($1,$2,'gmail',$3,$4,'test','{}'),($5,$6,'gmail',$7,$8,'test','{}')`,
      [
        mailboxId, ownerId, locator.providerAccountLocator, `${mailboxId}@test.invalid`,
        otherMailboxId, otherOwnerId, `other-${locator.providerAccountLocator}`, `${otherMailboxId}@test.invalid`,
      ],
    );

    const created = await repository.resolveOrCreateProviderBinding({
      scope: { ownerId, mailboxId },
      proposedThreadId: threadId,
      locator,
    });
    assert.equal(created.threadId, threadId);
    assert.equal(created.currentTransition.lifecycle, "ACTIVE");
    assert.equal(typeof created.currentTransition.transitionedAt, "string");
    assert.equal(Object.isFrozen(created), true);
    assert.equal(Object.isFrozen(created.scope), true);
    assert.equal(Object.isFrozen(created.locator), true);

    const concurrentThreadId = crypto.randomUUID();
    const concurrentLocator = {
      provider: "gmail" as const,
      providerAccountLocator: locator.providerAccountLocator,
      providerThreadLocator: `concurrent-${crypto.randomUUID()}`,
    };
    const concurrentResults = await Promise.all([
      repository.resolveOrCreateProviderBinding({
        scope: { ownerId, mailboxId },
        proposedThreadId: concurrentThreadId,
        locator: concurrentLocator,
      }),
      repository.resolveOrCreateProviderBinding({
        scope: { ownerId, mailboxId },
        proposedThreadId: concurrentThreadId,
        locator: concurrentLocator,
      }),
    ]);
    assert.deepEqual(concurrentResults[0], concurrentResults[1]);

    const retry = await repository.resolveOrCreateProviderBinding({
      scope: { ownerId, mailboxId },
      proposedThreadId: threadId,
      locator,
    });
    assert.deepEqual(retry, created);
    assert.notEqual(retry, created);
    assert.equal(await repository.findProviderBinding({
      scope: { ownerId: otherOwnerId, mailboxId },
      locator,
    }), null);
    assert.equal(await repository.findProviderBinding({
      scope: { ownerId, mailboxId: otherMailboxId },
      locator,
    }), null);

    const suspended = await repository.suspendProviderBinding({
      scope: { ownerId, mailboxId },
      threadId,
      expectedTransitionId: created.currentTransition.transitionId,
    });
    assert.equal(suspended.currentTransition.lifecycle, "SUSPENDED");
    await assert.rejects(
      repository.retireProviderBinding({
        scope: { ownerId, mailboxId },
        threadId,
        expectedTransitionId: created.currentTransition.transitionId,
      }),
      repository.ProviderBindingConflictError,
    );
    const repeated = await repository.suspendProviderBinding({
      scope: { ownerId, mailboxId },
      threadId,
      expectedTransitionId: suspended.currentTransition.transitionId,
    });
    assert.deepEqual(repeated, suspended);

    const active = await repository.reactivateProviderBinding({
      scope: { ownerId, mailboxId },
      threadId,
      expectedTransitionId: suspended.currentTransition.transitionId,
    });
    assert.equal(active.currentTransition.lifecycle, "ACTIVE");
    const retired = await repository.retireProviderBinding({
      scope: { ownerId, mailboxId },
      threadId,
      expectedTransitionId: active.currentTransition.transitionId,
    });
    assert.equal(retired.currentTransition.lifecycle, "RETIRED");

    const reactivated = await repository.reactivateProviderBinding({
      scope: { ownerId, mailboxId },
      threadId,
      expectedTransitionId: retired.currentTransition.transitionId,
      authenticatedScopedIntent: true,
    });
    await assert.rejects(
      repository.replaceProviderBinding({
        scope: { ownerId, mailboxId },
        threadId,
        expectedTransitionId: reactivated.currentTransition.transitionId,
        locator: concurrentLocator,
      }),
      repository.ProviderBindingConflictError,
    );
    assert.equal(
      (await repository.findProviderBinding({ scope: { ownerId, mailboxId }, locator }))
        ?.currentTransition.transitionId,
      reactivated.currentTransition.transitionId,
    );
    const replacementLocator = {
      provider: "gmail" as const,
      providerAccountLocator: locator.providerAccountLocator,
      providerThreadLocator: `${locator.providerThreadLocator}-replacement`,
    };
    const replacement = await repository.replaceProviderBinding({
      scope: { ownerId, mailboxId },
      threadId,
      expectedTransitionId: reactivated.currentTransition.transitionId,
      locator: replacementLocator,
    });
    assert.equal(replacement.locator.providerThreadLocator, replacementLocator.providerThreadLocator);
    const history = await repository.listProviderBindingTransitions({
      scope: { ownerId, mailboxId },
      threadId,
    });
    assert.deepEqual(history.map((transition) => transition.lifecycle), [
      "ACTIVE", "SUSPENDED", "ACTIVE", "RETIRED", "ACTIVE", "RETIRED", "ACTIVE",
    ]);
    assert.equal(Object.isFrozen(history), true);
    assert.equal(history.every(Object.isFrozen), true);
  } finally {
    await client.end();
  }
});

test("repository exposes typed not-found and expected-transition conflicts", {
  skip: databaseUrl ? false : "DATABASE_URL is required for PostgreSQL integration contracts",
}, async () => {
  const repository = await import("../src/repositories/thread-provider-binding-repository.js");
  await assert.rejects(
    repository.suspendProviderBinding({
      scope: { ownerId: crypto.randomUUID(), mailboxId: crypto.randomUUID() },
      threadId: crypto.randomUUID(),
      expectedTransitionId: crypto.randomUUID(),
    }),
    repository.ProviderBindingNotFoundError,
  );
});
