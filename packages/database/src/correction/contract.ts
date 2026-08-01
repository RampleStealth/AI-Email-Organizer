export type PriorityCorrectionScope = Readonly<{
  ownerId: string;
  mailboxId: string;
}>;

export type PriorityCorrectionOperation = "PRIORITIZE" | "NOT_IMPORTANT" | "UNDO";
export type PriorityCorrectionKind = "PRIORITIZE" | "NOT_IMPORTANT";
export type PriorityCorrectionMutationDisposition = "APPLIED" | "REPLAYED" | "NO_CHANGE";

export type PriorityCorrectionTransition = Readonly<{
  transitionId: string;
  correctionId: string;
  scope: PriorityCorrectionScope;
  threadId: string;
  operation: PriorityCorrectionOperation;
  previousTransitionId: string | null;
  idempotencyKey: string;
  transitionedAt: string;
}>;

export type PriorityCorrectionAggregate = Readonly<{
  correctionId: string;
  scope: PriorityCorrectionScope;
  threadId: string;
  currentTransitionId: string;
  createdAt: string;
}>;

export type PriorityCorrectionAuthority =
  | Readonly<{
      state: "VERIFIED_ACTIVE";
      kind: PriorityCorrectionKind;
      correctionId: string;
      transitionId: string;
      scope: PriorityCorrectionScope;
      threadId: string;
    }>
  | Readonly<{
      state: "VERIFIED_ABSENT";
      correctionId: string | null;
      transitionId: string | null;
    }>;

export type PriorityCorrectionMutationInput = Readonly<{
  scope: PriorityCorrectionScope;
  threadId: string;
  expectedTransitionId: string | null;
  idempotencyKey: string;
  correlationId?: string;
}>;

export type PriorityCorrectionLookupInput = Readonly<{
  scope: PriorityCorrectionScope;
  threadId: string;
}>;

export type PriorityCorrectionMutationResult = Readonly<{
  disposition: PriorityCorrectionMutationDisposition;
  aggregate: PriorityCorrectionAggregate | null;
  authority: PriorityCorrectionAuthority;
  transition: PriorityCorrectionTransition | null;
}>;

export class InvalidPriorityCorrectionInputError extends TypeError {
  constructor(message = "priority correction input is invalid") {
    super(message);
    this.name = "InvalidPriorityCorrectionInputError";
  }
}

export class PriorityCorrectionNotFoundError extends Error {
  constructor() {
    super("priority correction thread was not found in the authenticated scope");
    this.name = "PriorityCorrectionNotFoundError";
  }
}

export class PriorityCorrectionConflictError extends Error {
  constructor(message = "priority correction conflicts with current durable state") {
    super(message);
    this.name = "PriorityCorrectionConflictError";
  }
}

export class InvalidPriorityCorrectionTransitionError extends Error {
  constructor(message = "priority correction transition is invalid") {
    super(message);
    this.name = "InvalidPriorityCorrectionTransitionError";
  }
}

export class PriorityCorrectionPersistenceError extends Error {
  readonly retryable: boolean;

  constructor(message = "priority correction persistence failed", options?: { cause?: unknown; retryable?: boolean }) {
    super(message, { cause: options?.cause });
    this.name = "PriorityCorrectionPersistenceError";
    this.retryable = options?.retryable ?? false;
  }
}
