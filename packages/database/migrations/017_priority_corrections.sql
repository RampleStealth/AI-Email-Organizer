CREATE TABLE priority_corrections (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL,
  mailbox_account_id UUID NOT NULL,
  thread_id UUID NOT NULL,
  current_transition_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT priority_corrections_thread_scope_fk
    FOREIGN KEY (thread_id, owner_id, mailbox_account_id)
    REFERENCES application_threads(id, owner_id, mailbox_account_id)
    ON DELETE RESTRICT,
  CONSTRAINT priority_corrections_owner_mailbox_thread_unique
    UNIQUE (owner_id, mailbox_account_id, thread_id),
  CONSTRAINT priority_corrections_scoped_unique
    UNIQUE (id, owner_id, mailbox_account_id, thread_id)
);

CREATE TABLE priority_correction_transitions (
  id UUID PRIMARY KEY,
  correction_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  mailbox_account_id UUID NOT NULL,
  thread_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('PRIORITIZE', 'NOT_IMPORTANT', 'UNDO')),
  previous_transition_id UUID,
  idempotency_key UUID NOT NULL,
  transitioned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT priority_correction_transitions_correction_scope_fk
    FOREIGN KEY (correction_id, owner_id, mailbox_account_id, thread_id)
    REFERENCES priority_corrections(id, owner_id, mailbox_account_id, thread_id)
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT priority_correction_transitions_scoped_unique
    UNIQUE (id, correction_id, owner_id, mailbox_account_id, thread_id),
  CONSTRAINT priority_correction_transitions_idempotency_unique
    UNIQUE (owner_id, mailbox_account_id, idempotency_key),
  CONSTRAINT priority_correction_transitions_previous_scope_fk
    FOREIGN KEY (previous_transition_id, correction_id, owner_id, mailbox_account_id, thread_id)
    REFERENCES priority_correction_transitions(id, correction_id, owner_id, mailbox_account_id, thread_id)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE UNIQUE INDEX priority_correction_transitions_one_root
  ON priority_correction_transitions(correction_id)
  WHERE previous_transition_id IS NULL;

CREATE UNIQUE INDEX priority_correction_transitions_one_successor
  ON priority_correction_transitions(correction_id, previous_transition_id)
  WHERE previous_transition_id IS NOT NULL;

CREATE INDEX priority_correction_transitions_scope_thread
  ON priority_correction_transitions(owner_id, mailbox_account_id, thread_id);

CREATE INDEX priority_correction_transitions_correction_time
  ON priority_correction_transitions(correction_id, transitioned_at);

ALTER TABLE priority_corrections
  ADD CONSTRAINT priority_corrections_current_transition_scope_fk
  FOREIGN KEY (current_transition_id, id, owner_id, mailbox_account_id, thread_id)
  REFERENCES priority_correction_transitions(id, correction_id, owner_id, mailbox_account_id, thread_id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE FUNCTION protect_priority_correction_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
     OR NEW.mailbox_account_id IS DISTINCT FROM OLD.mailbox_account_id
     OR NEW.thread_id IS DISTINCT FROM OLD.thread_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'priority correction identity and scope are immutable';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER priority_corrections_identity_immutable
BEFORE UPDATE ON priority_corrections
FOR EACH ROW EXECUTE FUNCTION protect_priority_correction_identity();

CREATE FUNCTION reject_priority_correction_transition_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'priority correction transitions are append-only';
END
$$;

CREATE TRIGGER priority_correction_transitions_append_only
BEFORE UPDATE ON priority_correction_transitions
FOR EACH ROW EXECUTE FUNCTION reject_priority_correction_transition_update();

CREATE FUNCTION require_complete_priority_correction_chain()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  aggregate_id UUID;
  current_id UUID;
  chain_count INTEGER;
  total_count INTEGER;
  root_count INTEGER;
  has_cycle BOOLEAN;
BEGIN
  IF TG_TABLE_NAME = 'priority_corrections' THEN
    aggregate_id := NEW.id;
  ELSE
    aggregate_id := COALESCE(
      (to_jsonb(NEW) ->> 'correction_id')::UUID,
      (to_jsonb(OLD) ->> 'correction_id')::UUID
    );
  END IF;

  SELECT current_transition_id INTO current_id
  FROM priority_corrections
  WHERE id = aggregate_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  WITH RECURSIVE history AS (
    SELECT t.id, t.previous_transition_id, ARRAY[t.id] AS path, FALSE AS cycle
    FROM priority_correction_transitions t
    WHERE t.id = current_id AND t.correction_id = aggregate_id
    UNION ALL
    SELECT previous.id,
           previous.previous_transition_id,
           history.path || previous.id,
           previous.id = ANY(history.path)
    FROM history
    JOIN priority_correction_transitions previous
      ON previous.id = history.previous_transition_id
     AND previous.correction_id = aggregate_id
    WHERE NOT history.cycle
  )
  SELECT count(*)::INTEGER,
         count(*) FILTER (WHERE previous_transition_id IS NULL)::INTEGER,
         COALESCE(bool_or(cycle), FALSE)
  INTO chain_count, root_count, has_cycle
  FROM history;

  SELECT count(*)::INTEGER INTO total_count
  FROM priority_correction_transitions
  WHERE correction_id = aggregate_id;

  IF chain_count <> total_count OR root_count <> 1 OR has_cycle THEN
    RAISE EXCEPTION 'priority correction transition chain is incomplete or corrupt';
  END IF;

  IF EXISTS (
    SELECT 1 FROM priority_correction_transitions
    WHERE correction_id = aggregate_id AND previous_transition_id = current_id
  ) THEN
    RAISE EXCEPTION 'priority correction current transition must be the chain leaf';
  END IF;

  RETURN NULL;
END
$$;

CREATE CONSTRAINT TRIGGER priority_corrections_complete_chain
AFTER INSERT OR UPDATE ON priority_corrections
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION require_complete_priority_correction_chain();

CREATE CONSTRAINT TRIGGER priority_correction_transitions_complete_chain
AFTER INSERT OR UPDATE OR DELETE ON priority_correction_transitions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION require_complete_priority_correction_chain();
