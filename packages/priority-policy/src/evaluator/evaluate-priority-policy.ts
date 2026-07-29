import type { PriorityPolicyEvaluationOutcome } from "../domain/evaluation.js";
import type { PriorityPolicyEvaluatorInput } from "./contract.js";

export class PriorityPolicyEvaluatorNotImplementedError extends Error {
  readonly code = "PRIORITY_POLICY_EVALUATOR_NOT_IMPLEMENTED";

  constructor() {
    super("Priority Policy evaluation is not implemented.");
    this.name = "PriorityPolicyEvaluatorNotImplementedError";
  }
}

export function evaluatePriorityPolicy(
  input: PriorityPolicyEvaluatorInput
): PriorityPolicyEvaluationOutcome {
  void input;
  throw new PriorityPolicyEvaluatorNotImplementedError();
}
