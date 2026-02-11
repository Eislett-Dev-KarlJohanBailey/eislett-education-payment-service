import { RequestContext } from "../../handler/api-gateway/types";
import { FindProductByEntitlementKeyUseCase } from "@libs/domain";

export class FindProductByEntitlementKeyController {
  constructor(
    private readonly useCase: FindProductByEntitlementKeyUseCase
  ) {}

  handle = async (req: RequestContext) => {
    const entitlementKey = req.pathParams.entitlementKey;
    
    if (!entitlementKey) {
      throw new Error("entitlementKey is required");
    }

    return this.useCase.execute(entitlementKey);
  };
}
