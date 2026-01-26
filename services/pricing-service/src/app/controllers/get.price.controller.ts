import { RequestContext } from "../../handler/api-gateway/types";
import { GetPriceUseCase } from "../usecases/get.price.usecase";

export class GetPriceController {
  constructor(
    private readonly useCase: GetPriceUseCase
  ) {}

  handle = async (req: RequestContext) => {
    const priceId = req.pathParams.id;
    return this.useCase.execute(priceId);
  };
}
