export type ProviderBindingScope = Readonly<{
  ownerId: string;
  mailboxId: string;
}>;

export type ProviderLocator = Readonly<{
  provider: "gmail";
  providerAccountLocator: string;
  providerThreadLocator: string;
}>;

export type ProviderBindingLifecycle = "ACTIVE" | "SUSPENDED" | "RETIRED";

export type ProviderBindingTransition = Readonly<{
  transitionId: string;
  bindingId: string;
  lifecycle: ProviderBindingLifecycle;
  previousTransitionId: string | null;
  transitionedAt: string;
}>;

export type ProviderBinding = Readonly<{
  threadId: string;
  bindingId: string;
  scope: ProviderBindingScope;
  locator: ProviderLocator;
  currentTransition: ProviderBindingTransition;
}>;

export type ScopedProviderLocatorInput = Readonly<{
  scope: ProviderBindingScope;
  locator: ProviderLocator;
}>;

export type ResolveOrCreateProviderBindingInput = ScopedProviderLocatorInput & Readonly<{
  proposedThreadId: string;
}>;

export type ProviderBindingMutationInput = Readonly<{
  scope: ProviderBindingScope;
  threadId: string;
  expectedTransitionId: string;
}>;

export type ReactivateProviderBindingInput = ProviderBindingMutationInput & Readonly<{
  authenticatedScopedIntent?: true;
}>;

export type ReplaceProviderBindingInput = ProviderBindingMutationInput & Readonly<{
  locator: ProviderLocator;
}>;

export type ListProviderBindingTransitionsInput = Readonly<{
  scope: ProviderBindingScope;
  threadId: string;
}>;
