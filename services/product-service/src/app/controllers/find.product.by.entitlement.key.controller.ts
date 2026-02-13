import { RequestContext } from "../../handler/api-gateway/types";
import { FindProductByEntitlementKeyUseCase } from "@libs/domain";

export class FindProductByEntitlementKeyController {
  constructor(
    private readonly useCase: FindProductByEntitlementKeyUseCase
  ) {}

  handle = async (req: RequestContext) => {
    let entitlementKey = req.pathParams.entitlementKey;
    if (!entitlementKey) {
      throw new Error("entitlementKey is required");
    }
    // Allow kebab-case in URL: ai-tutor-access -> ai_tutor_access
    entitlementKey = entitlementKey.replace(/-/g, "_");

    return this.useCase.execute(entitlementKey);
  };
}
