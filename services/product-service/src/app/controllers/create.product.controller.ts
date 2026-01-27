import { RequestContext } from "../../handler/api-gateway/types";
import { CreateProductUseCase } from "@libs/domain";


export class CreateProductController {
  constructor(
    private readonly useCase: CreateProductUseCase
  ) {}

  handle = async (req: RequestContext) => {
    return this.useCase.execute(req.body);
  };
}
