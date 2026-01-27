import { DeleteProductUseCase } from "@libs/domain";
import { RequestContext } from "../../handler/api-gateway/types";

export class DeleteProductController {
  constructor(
    private readonly useCase: DeleteProductUseCase
  ) {}

  handle = async (req: RequestContext) => {
    const productId = req.pathParams.id;
    return this.useCase.execute(productId);
  };
}
