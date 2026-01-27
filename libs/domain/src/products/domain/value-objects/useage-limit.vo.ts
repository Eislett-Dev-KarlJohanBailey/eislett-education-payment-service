export type UsagePeriod = "day" | "month";

export interface UsageLimit {
  metric: string;   // e.g. "api_calls"
  limit: number;    // e.g. 10000
  period: UsagePeriod;
}
