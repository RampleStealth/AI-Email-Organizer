import assert from "node:assert/strict";
import test from "node:test";
import {
  InvalidProviderBindingInputError,
  createProviderLocator,
  providerLocatorsEqual,
} from "../src/provider-binding/provider-locator.js";

test("ProviderLocator copies, freezes, and preserves exact opaque values", () => {
  const input = {
    provider: "gmail",
    providerAccountLocator: " Account\u0301 ",
    providerThreadLocator: "Thread-ABC",
  };
  const locator = createProviderLocator(input);

  assert.deepEqual(locator, input);
  assert.notEqual(locator, input);
  assert.equal(Object.isFrozen(locator), true);
  input.providerThreadLocator = "changed";
  assert.equal(locator.providerThreadLocator, "Thread-ABC");
});

test("ProviderLocator accepts only an exact three-field Gmail record", () => {
  const invalid: unknown[] = [
    null,
    [],
    new Date(),
    "gmail",
    {},
    { provider: "outlook", providerAccountLocator: "a", providerThreadLocator: "t" },
    { provider: "gmail", providerAccountLocator: "", providerThreadLocator: "t" },
    { provider: "gmail", providerAccountLocator: "a", providerThreadLocator: "" },
    { provider: "gmail", providerAccountLocator: "a", providerThreadLocator: "t", extra: true },
    Object.assign(
      { provider: "gmail", providerAccountLocator: "a", providerThreadLocator: "t" },
      { [Symbol("extra")]: true },
    ),
  ];

  for (const value of invalid) {
    assert.throws(() => createProviderLocator(value), InvalidProviderBindingInputError);
  }
});

test("ProviderLocator equality is exact and performs no normalization", () => {
  const locator = createProviderLocator({
    provider: "gmail",
    providerAccountLocator: "Account",
    providerThreadLocator: "Thread",
  });

  assert.equal(providerLocatorsEqual(locator, { ...locator }), true);
  assert.equal(providerLocatorsEqual(locator, { ...locator, providerAccountLocator: "account" }), false);
  assert.equal(providerLocatorsEqual(locator, { ...locator, providerThreadLocator: "Thread " }), false);
});
