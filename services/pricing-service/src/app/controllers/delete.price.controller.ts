import { RequestContext } from "../../handler/api-gateway/types";
import { DeletePriceUseCase } from "@libs/domain";

export class DeletePriceController {
  constructor(
    private readonly useCase: DeletePriceUseCase
  ) {}

  handle = async (req: RequestContext) => {
    const priceId = req.pathParams.id;
    return this.useCase.execute(priceId);
  };
}
