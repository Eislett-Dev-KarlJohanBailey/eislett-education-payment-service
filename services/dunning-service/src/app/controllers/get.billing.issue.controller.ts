import { RequestContext } from "../../handler/api-gateway/types";
import { GetBillingIssueUseCase } from "../usecases/get.billing.issue.usecase";

export class GetBillingIssueController {
  constructor(private readonly useCase: GetBillingIssueUseCase) {}

  handle = async (req: RequestContext) => {
    const userId = req.user?.id;
    
    if (!userId) {
      throw new Error("User ID is required");
    }

    const billingIssue = await this.useCase.execute(userId);

    return billingIssue;
  };
}
