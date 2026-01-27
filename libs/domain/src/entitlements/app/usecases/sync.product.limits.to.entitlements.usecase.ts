import { EntitlementRepository } from "../ports/entitlement.repository";
import { ProductRepository } from "../../../products/app/ports/product.repository.port";
import { ResetStrategy } from "../../domain/value-objects/reset-strategy.vo";
import { UsagePeriod } from "../../../products/domain/value-objects/useage-limit.vo";
import { EntitlementUsage } from "../../domain/entities/entitlement-usage.entity";

export interface SyncProductLimitsInput {
  productId: string;
  userId: string;
}

export class SyncProductLimitsToEntitlementsUseCase {
  constructor(
    private readonly productRepo: ProductRepository,
    private readonly entitlementRepo: EntitlementRepository
  ) {}

  async execute(input: SyncProductLimitsInput): Promise<void> {
    const product = await this.productRepo.findById(input.productId);
    if (!product) {
      throw new Error(`Product ${input.productId} not found`);
    }

    const entitlements = await this.entitlementRepo.findByUser(input.userId);

    // For each usage limit in the product, sync to corresponding entitlements
    for (const usageLimit of product.usageLimits) {
      // Find entitlement that matches the metric
      const entitlement = entitlements.find(e => e.key === usageLimit.metric);
      
      if (!entitlement) {
        // Entitlement doesn't exist yet - would need to be created separately
        continue;
      }

      // Update entitlement usage limit
      const resetStrategy = this.createResetStrategyFromPeriod(usageLimit.period);
      
      if (entitlement.usage) {
        // Update existing usage - preserve current used count
        const currentUsed = entitlement.usage.used;
        entitlement.usage.limit = usageLimit.limit;
        entitlement.usage.resetStrategy = resetStrategy;
        // Calculate next reset date without resetting usage
        if (resetStrategy && resetStrategy.type === "periodic") {
          entitlement.usage.resetAt = this.calculateNextResetDate(resetStrategy, new Date());
        } else {
          entitlement.usage.resetAt = undefined;
        }
        // Restore used count (reset() would have cleared it)
        entitlement.usage.used = currentUsed;
      } else {
        // Create new usage tracking
        const resetAt = resetStrategy && resetStrategy.type === "periodic" 
          ? this.calculateNextResetDate(resetStrategy, new Date())
          : undefined;
        
        entitlement.usage = new EntitlementUsage(
          usageLimit.limit,
          0,
          resetAt,
          resetStrategy
        );
      }

      await this.entitlementRepo.update(entitlement);
    }
  }

  private createResetStrategyFromPeriod(period: UsagePeriod): ResetStrategy | undefined {
    switch (period) {
      case "day":
        return {
          type: "periodic",
          period: "day",
          hour: 0
        };
      case "week":
        return {
          type: "periodic",
          period: "week",
          dayOfWeek: 0, // Sunday
          hour: 0
        };
      case "month":
        return {
          type: "periodic",
          period: "month",
          dayOfMonth: 1,
          hour: 0
        };
      case "year":
        return {
          type: "periodic",
          period: "year",
          hour: 0
        };
      case "billing_cycle":
        return {
          type: "periodic",
          period: "billing_cycle"
        };
      case "lifetime":
        return undefined; // No reset for lifetime
      default:
        return undefined;
    }
  }

  private calculateNextResetDate(strategy: ResetStrategy, now: Date): Date {
    const nextReset = new Date(now);

    switch (strategy.period) {
      case "day":
        nextReset.setDate(nextReset.getDate() + 1);
        nextReset.setHours(strategy.hour || 0, 0, 0, 0);
        break;
      case "week":
        const daysUntilNextWeek = (7 - nextReset.getDay() + (strategy.dayOfWeek || 0)) % 7 || 7;
        nextReset.setDate(nextReset.getDate() + daysUntilNextWeek);
        nextReset.setHours(strategy.hour || 0, 0, 0, 0);
        break;
      case "month":
        nextReset.setMonth(nextReset.getMonth() + 1);
        nextReset.setDate(strategy.dayOfMonth || 1);
        nextReset.setHours(strategy.hour || 0, 0, 0, 0);
        break;
      case "year":
        nextReset.setFullYear(nextReset.getFullYear() + 1);
        nextReset.setMonth(0);
        nextReset.setDate(1);
        nextReset.setHours(strategy.hour || 0, 0, 0, 0);
        break;
      default:
        nextReset.setDate(nextReset.getDate() + 1);
    }

    return nextReset;
  }
}
