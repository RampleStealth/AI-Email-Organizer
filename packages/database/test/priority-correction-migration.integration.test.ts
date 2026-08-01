import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: "../../.env" });
const databaseUrl = process.env.DATABASE_URL;
const migrationUrl = new URL("../migrations/017_priority_corrections.sql", import.meta.url);

test("migration 017 defines the correction aggregate and append-only transition chain", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /CREATE TABLE priority_corrections/i);
  assert.match(sql, /CREATE TABLE priority_correction_transitions/i);
  assert.doesNotMatch(sql, /priority_correction_history/i);
  assert.match(sql, /current_transition_id UUID NOT NULL/i);
  assert.match(sql, /DEFERRABLE INITIALLY DEFERRED/i);
  assert.match(sql, /UNIQUE \(owner_id, mailbox_account_id, thread_id\)/i);
  assert.match(sql, /WHERE previous_transition_id IS NULL/i);
  assert.match(sql, /WHERE previous_transition_id IS NOT NULL/i);
  assert.match(sql, /BEFORE UPDATE ON priority_correction_transitions/i);
  assert.doesNotMatch(sql, /BEFORE UPDATE OR DELETE ON priority_correction_transitions/i);
});

test("migration 017 enforces scope, immutability, linear history, and dependency-closed deletion", {
  skip: databaseUrl ? false : "DATABASE_URL is required for PostgreSQL integration contracts",
}, async () => {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const schema = `priority_correction_migration_${crypto.randomUUID().replaceAll("-", "")}`;
  const ownerId = crypto.randomUUID();
  const mailboxId = crypto.randomUUID();
  const threadId = crypto.randomUUID();
  const correctionId = crypto.randomUUID();
  const rootId = crypto.randomUUID();
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}, public`);
    await client.query(`
      CREATE TABLE users (id UUID PRIMARY KEY);
      CREATE TABLE mailbox_accounts (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id),
        UNIQUE (id, user_id)
      );
      CREATE TABLE application_threads (
        id UUID PRIMARY KEY,
        owner_id UUID NOT NULL REFERENCES users(id),
        mailbox_account_id UUID NOT NULL,
        UNIQUE (id, owner_id, mailbox_account_id),
        FOREIGN KEY (mailbox_account_id, owner_id)
          REFERENCES mailbox_accounts(id, user_id) ON DELETE RESTRICT
      );
    `);
    await client.query("INSERT INTO users(id) VALUES($1)", [ownerId]);
    await client.query("INSERT INTO mailbox_accounts(id,user_id) VALUES($1,$2)", [mailboxId, ownerId]);
    await client.query(
      "INSERT INTO application_threads(id,owner_id,mailbox_account_id) VALUES($1,$2,$3)",
      [threadId, ownerId, mailboxId],
    );
    await client.query(await readFile(migrationUrl, "utf8"));

    await client.query("BEGIN");
    await client.query(
      `INSERT INTO priority_corrections(id,owner_id,mailbox_account_id,thread_id,current_transition_id)
       VALUES($1,$2,$3,$4,$5)`,
      [correctionId, ownerId, mailboxId, threadId, rootId],
    );
    await client.query(
      `INSERT INTO priority_correction_transitions(
         id,correction_id,owner_id,mailbox_account_id,thread_id,operation,previous_transition_id,idempotency_key
       ) VALUES($1,$2,$3,$4,$5,'PRIORITIZE',NULL,$6)`,
      [rootId, correctionId, ownerId, mailboxId, threadId, crypto.randomUUID()],
    );
    await client.query("COMMIT");

    await assert.rejects(
      client.query("UPDATE priority_correction_transitions SET operation='NOT_IMPORTANT' WHERE id=$1", [rootId]),
      /append-only/,
    );
    await assert.rejects(
      client.query("UPDATE priority_corrections SET thread_id=$2 WHERE id=$1", [correctionId, crypto.randomUUID()]),
      /identity and scope are immutable/,
    );

    const successor = crypto.randomUUID();
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO priority_correction_transitions(
         id,correction_id,owner_id,mailbox_account_id,thread_id,operation,previous_transition_id,idempotency_key
       ) VALUES($1,$2,$3,$4,$5,'UNDO',$6,$7)`,
      [successor, correctionId, ownerId, mailboxId, threadId, rootId, crypto.randomUUID()],
    );
    await client.query(
      "UPDATE priority_corrections SET current_transition_id=$2 WHERE id=$1",
      [correctionId, successor],
    );
    await client.query("COMMIT");
    await assert.rejects(
      client.query(
        `INSERT INTO priority_correction_transitions(
           id,correction_id,owner_id,mailbox_account_id,thread_id,operation,previous_transition_id,idempotency_key
         ) VALUES($1,$2,$3,$4,$5,'NOT_IMPORTANT',$6,$7)`,
        [crypto.randomUUID(), correctionId, ownerId, mailboxId, threadId, rootId, crypto.randomUUID()],
      ),
      /duplicate key/i,
    );
    await assert.rejects(
      client.query("DELETE FROM priority_correction_transitions WHERE id=$1", [rootId]),
      /foreign key/i,
    );

    await client.query("BEGIN");
    await client.query("SET CONSTRAINTS ALL DEFERRED");
    await client.query("DELETE FROM priority_corrections WHERE id=$1", [correctionId]);
    await client.query("DELETE FROM priority_correction_transitions WHERE correction_id=$1", [correctionId]);
    await client.query("COMMIT");
    assert.equal(
      (await client.query("SELECT count(*)::int AS count FROM priority_corrections")).rows[0].count,
      0,
    );
  } finally {
    await client.query("RESET search_path");
    await client.query(`DROP SCHEMA ${schema} CASCADE`);
    await client.end();
  }
});

test("migration 017 rolls back atomically", {
  skip: databaseUrl ? false : "DATABASE_URL is required for PostgreSQL integration contracts",
}, async () => {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const schema = `priority_correction_rollback_${crypto.randomUUID().replaceAll("-", "")}`;
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}, public`);
    await client.query("CREATE TABLE priority_correction_transitions(id UUID PRIMARY KEY)");
    await client.query("BEGIN");
    await assert.rejects(client.query(await readFile(migrationUrl, "utf8")));
    await client.query("ROLLBACK");
    const result = await client.query("SELECT to_regclass($1) AS relation", [`${schema}.priority_corrections`]);
    assert.equal(result.rows[0].relation, null);
  } finally {
    await client.query("RESET search_path");
    await client.query(`DROP SCHEMA ${schema} CASCADE`);
    await client.end();
  }
});
