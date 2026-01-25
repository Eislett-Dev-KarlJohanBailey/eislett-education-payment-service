import { RequestContext } from "../../handler/api-gateway/types";
import { GetProductUseCase } from "../usecases/get.product.usecase";

export class GetProductController {
  constructor(
    private readonly useCase: GetProductUseCase
  ) {}

  handle = async (req: RequestContext) => {
    const productId = req.pathParams.id;
    return this.useCase.execute(productId);
  };
}
