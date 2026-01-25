import { RequestContext } from "../../handler/api-gateway/types";
import { CreateProductUseCase } from "../usecases/create.product.usecase";


export class CreateProductController {
  constructor(
    private readonly useCase: CreateProductUseCase
  ) {}

  handle = async (req: RequestContext) => {
    return this.useCase.execute(req.body);
  };
}
