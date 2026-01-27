export type UsagePeriod = "day" | "week" | "month" | "year" | "billing_cycle" | "lifetime";

export type UsageWindow = "calendar" | "rolling" | "billing" | "custom";

export interface UsageLimit {
  metric: string;   // e.g. "api_calls", "ai_tokens", "quiz_attempts"
  limit: number;    // e.g. 10000
  period: UsagePeriod;
  window?: UsageWindow;  // Default: "calendar"
  startDate?: Date;       // For custom windows
}
