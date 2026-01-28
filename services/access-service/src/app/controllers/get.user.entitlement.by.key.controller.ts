import { RequestContext } from "../../handler/api-gateway/types";
import { GetUserEntitlementByKeyUseCase } from "@libs/domain";

export class GetUserEntitlementByKeyController {
  constructor(
    private readonly useCase: GetUserEntitlementByKeyUseCase
  ) {}

  handle = async (req: RequestContext) => {
    const userId = req.user?.id;
    const entitlementKey = req.pathParams.key;

    if (!userId) {
      throw new Error("User ID is required");
    }

    if (!entitlementKey) {
      throw new Error("Entitlement key is required");
    }

    const entitlements = await this.useCase.execute(userId, entitlementKey);

    return {
      userId,
      entitlements
    };
  };
}
