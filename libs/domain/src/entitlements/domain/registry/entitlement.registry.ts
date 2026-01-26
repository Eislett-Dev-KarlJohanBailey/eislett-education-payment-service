import { EntitlementKey } from "../value-objects/entitlement-key.vo";
import { EntitlementRole } from "../value-objects/entitlement-role.vo";

export const ENTITLEMENT_REGISTRY = {
  [EntitlementKey.ACCESS_DASHBOARD]: {
    description: "Access to main dashboard",
    roles: [EntitlementRole.LEARNER, EntitlementRole.EDUCATOR],
    usageBased: false,
  },

  [EntitlementKey.ACCESS_ANALYTICS]: {
    description: "Advanced analytics dashboard",
    roles: [EntitlementRole.EDUCATOR],
    usageBased: false,
  },

  [EntitlementKey.AI_TOKENS]: {
    description: "AI token usage",
    roles: [EntitlementRole.LEARNER, EntitlementRole.EDUCATOR],
    usageBased: true,
  },

  [EntitlementKey.QUIZ_ATTEMPTS]: {
    description: "Quiz attempts per billing period",
    roles: [EntitlementRole.LEARNER],
    usageBased: true,
  },
} as const;
