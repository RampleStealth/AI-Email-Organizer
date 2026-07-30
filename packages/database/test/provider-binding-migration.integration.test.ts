import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
const migrationUrl = new URL("../migrations/016_thread_provider_bindings.sql", import.meta.url);

test("migration 016 contains explicit ambiguity preflight and no winner selection", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /RAISE EXCEPTION/);
  assert.doesNotMatch(sql, /\bDISTINCT\s+ON\b/i);
  assert.doesNotMatch(sql, /\bORDER\s+BY\b/i);
  assert.doesNotMatch(sql, /\b(?:MIN|MAX)\s*\(/i);
});

test("migration 016 rejects ambiguous locator claims and rolls back atomically", {
  skip: databaseUrl ? false : "DATABASE_URL is required for PostgreSQL integration contracts",
}, async () => {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const suffix = crypto.randomUUID().replaceAll("-", "");
  const schema = `provider_binding_migration_${suffix}`;
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}, public`);
    await client.query(`
      CREATE TABLE users (id UUID PRIMARY KEY);
      CREATE TABLE mailbox_accounts (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id),
        provider TEXT NOT NULL,
        provider_account_id TEXT NOT NULL
      );
      CREATE TABLE threads (
        id UUID PRIMARY KEY,
        mailbox_account_id UUID NOT NULL REFERENCES mailbox_accounts(id),
        provider_thread_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    const ownerId = crypto.randomUUID();
    const mailboxId = crypto.randomUUID();
    const secondMailboxId = crypto.randomUUID();
    const threadId = crypto.randomUUID();
    const secondThreadId = crypto.randomUUID();
    await client.query("INSERT INTO users(id) VALUES($1)", [ownerId]);
    await client.query(
      `INSERT INTO mailbox_accounts(id,user_id,provider,provider_account_id)
       VALUES($1,$2,'gmail','account'),($3,$2,'gmail','account')`,
      [mailboxId, ownerId, secondMailboxId],
    );
    await client.query(
      `INSERT INTO threads(id,mailbox_account_id,provider_thread_id)
       VALUES($1,$2,'thread'),($3,$4,'thread')`,
      [threadId, mailboxId, secondThreadId, secondMailboxId],
    );

    const sql = await readFile(migrationUrl, "utf8");
    await client.query("BEGIN");
    await assert.rejects(client.query(sql));
    await client.query("ROLLBACK");
    const absent = await client.query(
      "SELECT to_regclass($1) AS application_threads",
      [`${schema}.application_threads`],
    );
    assert.equal(absent.rows[0].application_threads, null);
    assert.equal(
      (await client.query(
        `SELECT count(*)::int AS count
         FROM information_schema.table_constraints
         WHERE table_schema=$1 AND constraint_name='mailbox_accounts_id_user_unique'`,
        [schema],
      )).rows[0].count,
      0,
    );
  } finally {
    await client.query("RESET search_path");
    await client.query(`DROP SCHEMA ${schema} CASCADE`);
    await client.end();
  }
});

test("migration 016 preserves canonical IDs, exact locators, history, and projection independence", {
  skip: databaseUrl ? false : "DATABASE_URL is required for PostgreSQL integration contracts",
}, async () => {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const suffix = crypto.randomUUID().replaceAll("-", "");
  const schema = `provider_binding_preservation_${suffix}`;
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}, public`);
    await client.query(`
      CREATE TABLE users (id UUID PRIMARY KEY);
      CREATE TABLE mailbox_accounts (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id),
        provider TEXT NOT NULL,
        provider_account_id TEXT NOT NULL
      );
      CREATE TABLE threads (
        id UUID PRIMARY KEY,
        mailbox_account_id UUID NOT NULL REFERENCES mailbox_accounts(id) ON DELETE CASCADE,
        provider_thread_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    const ownerId = crypto.randomUUID();
    const mailboxId = crypto.randomUUID();
    const threadId = crypto.randomUUID();
    await client.query("INSERT INTO users(id) VALUES($1)", [ownerId]);
    await client.query(
      "INSERT INTO mailbox_accounts(id,user_id,provider,provider_account_id) VALUES($1,$2,'gmail',$3)",
      [mailboxId, ownerId, " Account "],
    );
    await client.query(
      "INSERT INTO threads(id,mailbox_account_id,provider_thread_id) VALUES($1,$2,$3)",
      [threadId, mailboxId, " Thread "],
    );

    await client.query(await readFile(migrationUrl, "utf8"));
    const result = await client.query(`
      SELECT a.id, b.provider_account_locator, b.provider_thread_locator,
             t.lifecycle, a.current_transition_id = t.id AS current
      FROM application_threads a
      JOIN thread_provider_bindings b ON b.thread_id = a.id
      JOIN thread_provider_binding_transitions t ON t.binding_id = b.id
    `);
    assert.deepEqual(result.rows, [{
      id: threadId,
      provider_account_locator: " Account ",
      provider_thread_locator: " Thread ",
      lifecycle: "ACTIVE",
      current: true,
    }]);
    await assert.rejects(
      client.query("UPDATE thread_provider_bindings SET provider_thread_locator='changed'"),
      /immutable/,
    );
    await assert.rejects(
      client.query("UPDATE thread_provider_binding_transitions SET lifecycle='RETIRED'"),
      /append-only/,
    );

    await client.query("DELETE FROM threads WHERE id=$1", [threadId]);
    assert.equal(
      (await client.query("SELECT count(*)::int AS count FROM application_threads")).rows[0].count,
      1,
    );
    assert.equal(
      (await client.query("SELECT count(*)::int AS count FROM thread_provider_binding_transitions")).rows[0].count,
      1,
    );
  } finally {
    await client.query("RESET search_path");
    await client.query(`DROP SCHEMA ${schema} CASCADE`);
    await client.end();
  }
});
