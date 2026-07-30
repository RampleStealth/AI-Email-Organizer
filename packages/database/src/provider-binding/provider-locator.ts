import type { ProviderLocator } from "./contract.js";

export class InvalidProviderBindingInputError extends TypeError {
  constructor(message = "invalid provider binding input") {
    super(message);
    this.name = "InvalidProviderBindingInputError";
  }
}

const fields = ["provider", "providerAccountLocator", "providerThreadLocator"] as const;

export function createProviderLocator(value: unknown): ProviderLocator {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  ) {
    throw new InvalidProviderBindingInputError("provider locator must be an ordinary object");
  }
  const record = value as Record<string, unknown>;
  const keys = Reflect.ownKeys(record);
  if (keys.length !== fields.length || fields.some((field) => !Object.hasOwn(record, field))) {
    throw new InvalidProviderBindingInputError("provider locator must contain exactly the approved fields");
  }
  if (record.provider !== "gmail") {
    throw new InvalidProviderBindingInputError("provider must be gmail");
  }
  if (typeof record.providerAccountLocator !== "string" || record.providerAccountLocator.length === 0) {
    throw new InvalidProviderBindingInputError("provider account locator must be a nonempty string");
  }
  if (typeof record.providerThreadLocator !== "string" || record.providerThreadLocator.length === 0) {
    throw new InvalidProviderBindingInputError("provider thread locator must be a nonempty string");
  }
  return Object.freeze({
    provider: "gmail",
    providerAccountLocator: record.providerAccountLocator,
    providerThreadLocator: record.providerThreadLocator,
  });
}

export function providerLocatorsEqual(left: ProviderLocator, right: ProviderLocator): boolean {
  return left.provider === right.provider
    && left.providerAccountLocator === right.providerAccountLocator
    && left.providerThreadLocator === right.providerThreadLocator;
}
