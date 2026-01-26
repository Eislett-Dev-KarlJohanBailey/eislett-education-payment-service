import { RequestContext } from "../../handler/api-gateway/types";
import { CreatePriceUseCase } from "../usecases/create.price.usecase";

export class CreatePriceController {
  constructor(
    private readonly useCase: CreatePriceUseCase
  ) {}

  handle = async (req: RequestContext) => {
    return this.useCase.execute(req.body);
  };
}
