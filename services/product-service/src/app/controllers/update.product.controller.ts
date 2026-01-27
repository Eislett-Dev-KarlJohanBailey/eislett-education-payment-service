import { UpdateProductUseCase } from "@libs/domain";
import { RequestContext } from "../../handler/api-gateway/types";

export class UpdateProductController {
  constructor(
    private readonly useCase: UpdateProductUseCase
  ) {}

  handle = async (req: RequestContext) => {
    const productId = req.pathParams.id;
    return this.useCase.execute(productId, req.body);
  };
}
