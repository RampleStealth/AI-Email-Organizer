declare const identifierBrand: unique symbol;

type BrandedIdentifier<Name extends string> = string & {
  readonly [identifierBrand]: Name;
};

export type OwnerId = BrandedIdentifier<"OwnerId">;
export type MailboxId = BrandedIdentifier<"MailboxId">;
export type ThreadId = BrandedIdentifier<"ThreadId">;
export type ApplicationMessageId = BrandedIdentifier<"ApplicationMessageId">;
export type ProviderBindingTransitionId = BrandedIdentifier<"ProviderBindingTransitionId">;
export type CorrectionTransitionId = BrandedIdentifier<"CorrectionTransitionId">;
export type EvidenceSnapshotId = BrandedIdentifier<"EvidenceSnapshotId">;
export type ApprovedParameterIdentity = BrandedIdentifier<"ApprovedParameterIdentity">;
export type CanonicalTimestamp = BrandedIdentifier<"CanonicalTimestamp">;

export type PolicyVersion = "1.0";
export type FutureSkewTolerance = "PT5M";
