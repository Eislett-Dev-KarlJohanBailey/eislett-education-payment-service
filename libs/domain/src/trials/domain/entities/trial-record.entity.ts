export class TrialRecord {
  constructor(
    public readonly userId: string,
    public readonly productId: string,
    public readonly startedAt: Date,
    public readonly expiresAt: Date,
    public readonly status: "active" | "expired" | "converted"
  ) {}

  isActive(now = new Date()): boolean {
    return this.status === "active" && now < this.expiresAt;
  }

  isExpired(now = new Date()): boolean {
    return now >= this.expiresAt || this.status === "expired";
  }

  markAsExpired(): void {
    (this as any).status = "expired";
  }

  markAsConverted(): void {
    (this as any).status = "converted";
  }
}
