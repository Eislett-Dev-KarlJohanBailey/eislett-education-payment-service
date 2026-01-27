import { EntitlementKey } from "../value-objects/entitlement-key.vo";
import { EntitlementRole } from "../value-objects/entitlement-role.vo";

export const ENTITLEMENT_REGISTRY = {
  [EntitlementKey.ADVANCED_ANALYTICS]: {
    description: "Access to advanced analytics",
    roles: [EntitlementRole.LEARNER, EntitlementRole.EDUCATOR],
    usageBased: false,
  },

  [EntitlementKey.CLASSROOM_MANAGEMENT]: {
    description: "Access to classroom management",
    roles: [EntitlementRole.EDUCATOR],
    usageBased: true,
  },

  [EntitlementKey.CLASSROOM_ACCESS]: {
    description: "Access to classroom",
    roles: [EntitlementRole.LEARNER],
    usageBased: true,
  },
} as const;
