import { IncrementUsageUseCase } from "../increment.usage.usecase";
import { EntitlementRepository } from "../../ports/entitlement.repository";
import { Entitlement } from "../../../domain/entities/entitlement.entity";
import { EntitlementUsage } from "../../../domain/entities/entitlement-usage.entity";
import { EntitlementKey } from "../../../domain/value-objects/entitlement-key.vo";
import { EntitlementRole } from "../../../domain/value-objects/entitlement-role.vo";
import { EntitlementStatus } from "../../../domain/value-objects/entitlement-status.vo";

const USER_ID = "user-123";
const KEY = EntitlementKey.QUESTION_GENERATION;
const LIMIT = 10;

function nextMidnight(from: Date): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function previousMidnight(from: Date): Date {
  const d = new Date(from);
  d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function createEntitlement(usage: EntitlementUsage): Entitlement {
  return new Entitlement(
    USER_ID,
    KEY,
    "learner" as EntitlementRole,
    EntitlementStatus.ACTIVE,
    new Date(),
    undefined,
    usage
  );
}

describe("IncrementUsageUseCase – daily reset (24-hour slots)", () => {
  it("decrements remaining usage same day and resets next day so usage is available again", async () => {
    const now = new Date();
    const resetAtSameDay = nextMidnight(now); // reset is "tomorrow" → no reset today
    const usageSameDay = new EntitlementUsage(LIMIT, 0, resetAtSameDay, {
      type: "periodic",
      period: "day",
      hour: 0,
    });
    const entitlementSameDay = createEntitlement(usageSameDay);

    // Next day: resetAt in the past so shouldReset() is true
    const resetAtPast = previousMidnight(now);
    const usageNextDay = new EntitlementUsage(LIMIT, 3, resetAtPast, {
      type: "periodic",
      period: "day",
      hour: 0,
    });
    const entitlementNextDay = createEntitlement(usageNextDay);

    const findByUserAndKey = jest.fn();
    const update = jest.fn();

    // First call: return same-day entitlement (no reset)
    // Second call: return next-day entitlement (used=3, resetAt in past); then after reset re-fetch returns same instance (already mutated)
    findByUserAndKey
      .mockResolvedValueOnce(entitlementSameDay)
      .mockResolvedValueOnce(entitlementNextDay)
      .mockResolvedValueOnce(entitlementNextDay); // re-fetch after reset

    const repo: EntitlementRepository = {
      findByUser: jest.fn(),
      findByUserAndKey,
      save: jest.fn(),
      update,
      deleteAll: jest.fn().mockResolvedValue({ deleted: 0 }),
      deleteByUserAndKey: jest.fn().mockResolvedValue(false),
    };

    const useCase = new IncrementUsageUseCase(repo);

    // —— Same day: consume 3 → remaining goes down
    const first = await useCase.execute({
      userId: USER_ID,
      key: KEY,
      amount: 3,
    });

    expect(first.usage).toBe(3);
    expect(first.limit).toBe(LIMIT);
    expect(first.remaining).toBe(LIMIT - 3);
    expect(first.key).toBe(KEY);
    expect(update).toHaveBeenCalledTimes(1);

    // —— Next day: shouldReset() true → reset then consume 2 → usage available again (remaining = 10 - 2)
    const second = await useCase.execute({
      userId: USER_ID,
      key: KEY,
      amount: 2,
    });

    expect(second.usage).toBe(2);
    expect(second.limit).toBe(LIMIT);
    expect(second.remaining).toBe(LIMIT - 2);
    expect(second.key).toBe(KEY);
    // update called: once for reset, once for consume after re-fetch
    expect(update).toHaveBeenCalledTimes(3);
    expect(findByUserAndKey).toHaveBeenCalledTimes(3);
  });
});
