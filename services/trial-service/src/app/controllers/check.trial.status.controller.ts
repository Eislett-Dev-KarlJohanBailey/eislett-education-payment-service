import { RequestContext } from "../../handler/api-gateway/types";
import { CheckTrialStatusUseCase } from "../usecases/check.trial.status.usecase";

export class CheckTrialStatusController {
  constructor(
    private readonly useCase: CheckTrialStatusUseCase
  ) {}

  handle = async (req: RequestContext) => {
    const productId = req.query.productId || req.pathParams.productId;
    const userId = req.user?.id;

    if (!userId) {
      throw new Error("User ID is required");
    }

    if (!productId) {
      throw new Error("productId is required");
    }

    return await this.useCase.execute({
      userId,
      productId,
    });
  };
}
