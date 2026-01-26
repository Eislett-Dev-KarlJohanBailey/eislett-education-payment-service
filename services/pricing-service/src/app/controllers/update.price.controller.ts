import { RequestContext } from "../../handler/api-gateway/types";
import { UpdatePriceUseCase } from "@libs/domain/src/pricing/app/usecases/update.price.usecase";

export class UpdatePriceController {
  constructor(
    private readonly useCase: UpdatePriceUseCase
  ) {}

  handle = async (req: RequestContext) => {
    const priceId = req.pathParams.id;
    return this.useCase.execute(priceId, req.body);
  };
}
