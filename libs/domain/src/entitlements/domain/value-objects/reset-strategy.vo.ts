export type ResetType = "manual" | "periodic" | "rolling";
export type ResetPeriod = "hour" | "day" | "week" | "month" | "quarter" | "year" | "billing_cycle" | "custom";

export interface ResetStrategy {
  type: ResetType;
  period?: ResetPeriod;
  dayOfMonth?: number;      // 1-31 for monthly resets
  dayOfWeek?: number;        // 0-6 (Sunday-Saturday) for weekly resets
  hour?: number;             // 0-23 for hourly resets
  timezone?: string;         // IANA timezone (e.g., "America/New_York")
  customDays?: number;       // For custom period (e.g., every 7 days)
}
