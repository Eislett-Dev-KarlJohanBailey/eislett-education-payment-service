import { RequestContext } from "../../handler/api-gateway/types";
import { FindProductByEntitlementKeyUseCase } from "@libs/domain";

export class FindProductByEntitlementKeyController {
  constructor(
    private readonly useCase: FindProductByEntitlementKeyUseCase
  ) {}

  handle = async (req: RequestContext) => {
    // Path params may be from API Gateway (e.g. entitlementKey) or we extract from path (e.g. /v1/products/by-entitlement/ai_tutor_access)
    let entitlementKey = req.pathParams?.entitlementKey;
    if (!entitlementKey && typeof req.path === "string") {
      const segments = req.path.split("/").filter(Boolean);
      if (segments[segments.length - 2] === "by-entitlement" && segments.length >= 3) {
        entitlementKey = segments[segments.length - 1];
      }
    }
    if (!entitlementKey) {
      throw new Error("entitlementKey is required");
    }
    // Allow kebab-case in URL: ai-tutor-access -> ai_tutor_access
    entitlementKey = entitlementKey.replace(/-/g, "_");

    const products = await this.useCase.execute(entitlementKey);
    return {
      amount: products.length,
      data: products
    };
  };
}
