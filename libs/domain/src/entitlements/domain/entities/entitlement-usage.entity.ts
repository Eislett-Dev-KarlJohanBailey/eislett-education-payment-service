export class EntitlementUsage {
    constructor(
      public limit: number,
      public used: number,
      public resetAt?: Date
    ) {}
  
    canConsume(amount = 1): boolean {
      return this.used + amount <= this.limit;
    }
  
    consume(amount = 1): void {
      if (!this.canConsume(amount)) {
        throw new Error("Entitlement usage exceeded");
      }
      this.used += amount;
    }
  }
  