/**
 * Dunning State represents the current billing issue status for a user
 * 
 * Timeline:
 * - ACTION_REQUIRED (Day 0): Payment failed or action required, full access maintained
 * - GRACE_PERIOD (Day 1-3): Reminder period, full access maintained
 * - RESTRICTED (Day 4-7): Limited access, premium features disabled
 * - SUSPENDED (Day 8+): Access revoked, account recoverable
 * - OK: No billing issues, normal operation
 */
export enum DunningState {
  OK = "ok",
  ACTION_REQUIRED = "action_required",
  GRACE_PERIOD = "grace_period",
  RESTRICTED = "restricted",
  SUSPENDED = "suspended",
}
