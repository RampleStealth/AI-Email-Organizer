DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM threads t
    JOIN mailbox_accounts m ON m.id = t.mailbox_account_id
    WHERE m.provider <> 'gmail'
       OR m.provider_account_id = ''
       OR t.provider_thread_id = ''
  ) THEN
    RAISE EXCEPTION 'migration 016 cannot backfill malformed provider locators';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM threads t
    LEFT JOIN mailbox_accounts m ON m.id = t.mailbox_account_id
    WHERE m.id IS NULL OR m.user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'migration 016 cannot backfill ambiguous thread scope';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM threads left_thread
    JOIN mailbox_accounts left_mailbox ON left_mailbox.id = left_thread.mailbox_account_id
    JOIN threads right_thread ON right_thread.id <> left_thread.id
    JOIN mailbox_accounts right_mailbox ON right_mailbox.id = right_thread.mailbox_account_id
    WHERE left_mailbox.provider = right_mailbox.provider
      AND left_mailbox.provider_account_id = right_mailbox.provider_account_id
      AND left_thread.provider_thread_id = right_thread.provider_thread_id
  ) THEN
    RAISE EXCEPTION 'migration 016 cannot choose between duplicate provider locator claims';
  END IF;
END
$$;

ALTER TABLE mailbox_accounts
  ADD CONSTRAINT mailbox_accounts_id_user_unique UNIQUE (id, user_id);

CREATE TABLE application_threads (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  mailbox_account_id UUID NOT NULL,
  current_transition_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT application_threads_mailbox_scope_fk
    FOREIGN KEY (mailbox_account_id, owner_id)
    REFERENCES mailbox_accounts(id, user_id)
    ON DELETE RESTRICT,
  CONSTRAINT application_threads_scoped_unique
    UNIQUE (id, owner_id, mailbox_account_id)
);

CREATE TABLE thread_provider_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  mailbox_account_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider = 'gmail'),
  provider_account_locator TEXT NOT NULL CHECK (provider_account_locator <> ''),
  provider_thread_locator TEXT NOT NULL CHECK (provider_thread_locator <> ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT thread_provider_bindings_thread_scope_fk
    FOREIGN KEY (thread_id, owner_id, mailbox_account_id)
    REFERENCES application_threads(id, owner_id, mailbox_account_id)
    ON DELETE RESTRICT,
  CONSTRAINT thread_provider_bindings_locator_unique
    UNIQUE (provider, provider_account_locator, provider_thread_locator),
  CONSTRAINT thread_provider_bindings_scoped_unique
    UNIQUE (id, thread_id, owner_id, mailbox_account_id)
);

CREATE TABLE thread_provider_binding_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  mailbox_account_id UUID NOT NULL,
  binding_id UUID NOT NULL,
  lifecycle TEXT NOT NULL CHECK (lifecycle IN ('ACTIVE', 'SUSPENDED', 'RETIRED')),
  previous_transition_id UUID,
  transitioned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT thread_provider_binding_transitions_binding_scope_fk
    FOREIGN KEY (binding_id, thread_id, owner_id, mailbox_account_id)
    REFERENCES thread_provider_bindings(id, thread_id, owner_id, mailbox_account_id)
    ON DELETE RESTRICT,
  CONSTRAINT thread_provider_binding_transitions_scoped_unique
    UNIQUE (id, thread_id, owner_id, mailbox_account_id),
  CONSTRAINT thread_provider_binding_transitions_previous_scope_fk
    FOREIGN KEY (previous_transition_id, thread_id, owner_id, mailbox_account_id)
    REFERENCES thread_provider_binding_transitions(id, thread_id, owner_id, mailbox_account_id)
    ON DELETE RESTRICT
);

ALTER TABLE application_threads
  ADD CONSTRAINT application_threads_current_transition_scope_fk
  FOREIGN KEY (current_transition_id, id, owner_id, mailbox_account_id)
  REFERENCES thread_provider_binding_transitions(id, thread_id, owner_id, mailbox_account_id)
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

INSERT INTO application_threads(id, owner_id, mailbox_account_id, created_at)
SELECT t.id, m.user_id, t.mailbox_account_id, t.created_at
FROM threads t
JOIN mailbox_accounts m ON m.id = t.mailbox_account_id;

INSERT INTO thread_provider_bindings(
  thread_id,
  owner_id,
  mailbox_account_id,
  provider,
  provider_account_locator,
  provider_thread_locator,
  created_at
)
SELECT
  t.id,
  m.user_id,
  t.mailbox_account_id,
  m.provider,
  m.provider_account_id,
  t.provider_thread_id,
  t.created_at
FROM threads t
JOIN mailbox_accounts m ON m.id = t.mailbox_account_id;

INSERT INTO thread_provider_binding_transitions(
  thread_id,
  owner_id,
  mailbox_account_id,
  binding_id,
  lifecycle,
  transitioned_at
)
SELECT
  b.thread_id,
  b.owner_id,
  b.mailbox_account_id,
  b.id,
  'ACTIVE',
  b.created_at
FROM thread_provider_bindings b;

UPDATE application_threads a
SET current_transition_id = t.id
FROM thread_provider_binding_transitions t
WHERE t.thread_id = a.id
  AND t.owner_id = a.owner_id
  AND t.mailbox_account_id = a.mailbox_account_id;

DO $$
DECLARE
  projection_count BIGINT;
  application_count BIGINT;
  binding_count BIGINT;
  transition_count BIGINT;
  pointer_count BIGINT;
BEGIN
  SELECT count(*) INTO projection_count FROM threads;
  SELECT count(*) INTO application_count FROM application_threads;
  SELECT count(*) INTO binding_count FROM thread_provider_bindings;
  SELECT count(*) INTO transition_count FROM thread_provider_binding_transitions;
  SELECT count(*) INTO pointer_count FROM application_threads WHERE current_transition_id IS NOT NULL;

  IF projection_count <> application_count
     OR projection_count <> binding_count
     OR projection_count <> transition_count
     OR projection_count <> pointer_count THEN
    RAISE EXCEPTION 'migration 016 backfill coverage is not one-to-one';
  END IF;
END
$$;

CREATE FUNCTION reject_provider_binding_claim_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'provider binding claims are immutable';
END
$$;

CREATE TRIGGER thread_provider_bindings_immutable
BEFORE UPDATE OR DELETE ON thread_provider_bindings
FOR EACH ROW EXECUTE FUNCTION reject_provider_binding_claim_mutation();

CREATE FUNCTION reject_provider_binding_transition_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'provider binding transitions are append-only';
END
$$;

CREATE TRIGGER thread_provider_binding_transitions_append_only
BEFORE UPDATE OR DELETE ON thread_provider_binding_transitions
FOR EACH ROW EXECUTE FUNCTION reject_provider_binding_transition_mutation();

CREATE FUNCTION protect_application_thread_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'canonical application threads cannot be deleted';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
     OR NEW.mailbox_account_id IS DISTINCT FROM OLD.mailbox_account_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'canonical application thread identity and scope are immutable';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER application_threads_identity_immutable
BEFORE UPDATE OR DELETE ON application_threads
FOR EACH ROW EXECUTE FUNCTION protect_application_thread_identity();

CREATE FUNCTION require_application_thread_current_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM application_threads a
    WHERE a.id = NEW.id
      AND a.current_transition_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'canonical application thread requires a current transition';
  END IF;
  RETURN NULL;
END
$$;

CREATE CONSTRAINT TRIGGER application_threads_current_transition_required
AFTER INSERT OR UPDATE ON application_threads
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION require_application_thread_current_transition();
