import { RequestContext } from "../../handler/api-gateway/types";
import { GetUserEntitlementsUseCase } from "@libs/domain";

export class GetUserEntitlementsController {
  constructor(
    private readonly useCase: GetUserEntitlementsUseCase
  ) {}

  handle = async (req: RequestContext) => {
    const userId = req.user?.id;
    
    if (!userId) {
      throw new Error("User ID is required");
    }

    const entitlements = await this.useCase.execute(userId);
    
    return {
      userId,
      entitlements
    };
  };
}
