import { RequestContext } from "../../handler/api-gateway/types";
import { GetUserEntitlementsUseCase, GetUserEntitlementByKeyUseCase } from "@libs/domain";

export class GetUserEntitlementsController {
  constructor(
    private readonly getAllUseCase: GetUserEntitlementsUseCase,
    private readonly getByKeyUseCase: GetUserEntitlementByKeyUseCase
  ) {}

  handle = async (req: RequestContext) => {
    const userId = req.user?.id;
    
    if (!userId) {
      throw new Error("User ID is required");
    }

    // Optional query parameter to filter by entitlement key
    const entitlementKey = req.query.entitlement_key;

    let entitlements: Record<string, any>;
    
    if (entitlementKey) {
      // Use the new use case to get a specific entitlement by key
      entitlements = await this.getByKeyUseCase.execute(userId, entitlementKey);
    } else {
      // Get all entitlements for the user
      entitlements = await this.getAllUseCase.execute(userId);
    }
    
    return {
      userId,
      entitlements
    };
  };
}
