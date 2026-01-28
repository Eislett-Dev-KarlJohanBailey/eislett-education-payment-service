import { RequestContext } from "../../handler/api-gateway/types";
import { StartTrialUseCase } from "../usecases/start.trial.usecase";

export class StartTrialController {
  constructor(
    private readonly useCase: StartTrialUseCase
  ) {}

  handle = async (req: RequestContext) => {
    const { productId, trialDurationHours } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      throw new Error("User ID is required");
    }

    if (!productId) {
      throw new Error("productId is required");
    }

    return await this.useCase.execute({
      userId,
      productId,
      trialDurationHours,
      role: userRole as any,
    });
  };
}
