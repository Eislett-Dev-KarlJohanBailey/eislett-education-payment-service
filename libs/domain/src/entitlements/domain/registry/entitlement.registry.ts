import { EntitlementKey } from "../value-objects/entitlement-key.vo";

export const ENTITLEMENT_REGISTRY = {
  [EntitlementKey.ADVANCED_ANALYTICS]: {
    description: "Access to advanced analytics",
    roles: ["learner", "educator"],
    usageBased: false,
  },

  [EntitlementKey.CLASSROOM_MANAGEMENT]: {
    description: "Access to classroom management",
    roles: ["educator"],
    usageBased: true,
  },

  [EntitlementKey.CLASSROOM_ACCESS]: {
    description: "Access to classroom",
    roles: ["learner"],
    usageBased: true,
  },

  [EntitlementKey.SUBJECT_ACCESS]: {
    description: "Access to subject",
    roles: ["learner", "educator"],
    usageBased: true,
  },

  [EntitlementKey.QUESTION_GENERATION]: {
    description: "Access to question generation",
    roles: ["learner", "educator"],
    usageBased: true,
  },

  [EntitlementKey.AI_TUTOR_ACCESS]: {
    description: "Access to AI tutor",
    roles: ["learner"],
    usageBased: true,
  },
} as const;
