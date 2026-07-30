import type { CandidateTimestampEvidence } from "../domain/evidence.js";
import type { PriorityTier } from "../domain/evaluation.js";
import type { ThreadId } from "../domain/identifiers.js";

const FUTURE_SKEW_TOLERANCE_MILLISECONDS = 5 * 60 * 1000;
const CANONICAL_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CANONICAL_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

interface RuntimeRecord {
  readonly [key: string]: unknown;
}

function isRecord(value: unknown): value is RuntimeRecord {
  return typeof value === "object" && value !== null;
}

function invalidInput(): never {
  throw new TypeError("Invalid normalized Priority Policy ordering input.");
}

export function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" && CANONICAL_UUID_PATTERN.test(value);
}

export function parseCanonicalTimestamp(value: unknown): number | undefined {
  if (
    typeof value !== "string" ||
    !CANONICAL_TIMESTAMP_PATTERN.test(value)
  ) {
    return undefined;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
    ? timestamp
    : undefined;
}

export function effectiveCandidateTimestamp(
  evidence: CandidateTimestampEvidence,
  evaluatedAt: number
): number | undefined {
  const runtimeEvidence = evidence as unknown;
  if (!isRecord(runtimeEvidence)) {
    return invalidInput();
  }

  if (runtimeEvidence.state === "UNKNOWN") {
    return undefined;
  }

  if (runtimeEvidence.state !== "VERIFIED") {
    return invalidInput();
  }

  const providerTimestamp = parseCanonicalTimestamp(runtimeEvidence.value);
  if (
    providerTimestamp === undefined ||
    !isCanonicalUuid(runtimeEvidence.sourceMessageId)
  ) {
    return invalidInput();
  }

  if (
    providerTimestamp >
    evaluatedAt + FUTURE_SKEW_TOLERANCE_MILLISECONDS
  ) {
    return undefined;
  }

  return Math.min(providerTimestamp, evaluatedAt);
}

function uuidBytes(value: string): readonly number[] {
  const hexadecimal = value.replaceAll("-", "");
  return Array.from(
    { length: 16 },
    (_, index) => Number.parseInt(hexadecimal.slice(index * 2, index * 2 + 2), 16)
  );
}

export function compareThreadIds(left: ThreadId, right: ThreadId): number {
  const leftBytes = uuidBytes(left);
  const rightBytes = uuidBytes(right);

  for (let index = 0; index < leftBytes.length - 1; index += 1) {
    const difference = leftBytes[index]! - rightBytes[index]!;
    if (difference !== 0) {
      return difference;
    }
  }

  return leftBytes[15]! - rightBytes[15]!;
}

export function comparePriorityTiers(
  left: PriorityTier,
  right: PriorityTier
): number {
  if (
    (left !== "NEEDS_ATTENTION" &&
      left !== "REVIEW_LATER" &&
      left !== "NO_IMMEDIATE_SIGNALS") ||
    (right !== "NEEDS_ATTENTION" &&
      right !== "REVIEW_LATER" &&
      right !== "NO_IMMEDIATE_SIGNALS")
  ) {
    return invalidInput();
  }

  if (left === right) {
    return 0;
  }

  if (left === "NEEDS_ATTENTION") {
    return -1;
  }

  if (right === "NEEDS_ATTENTION") {
    return 1;
  }

  return left === "REVIEW_LATER" ? -1 : 1;
}
