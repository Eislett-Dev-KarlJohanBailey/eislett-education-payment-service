import { RequestContext } from "../../handler/api-gateway/types";
import { CreatePriceUseCase } from "@libs/domain/pricing/app/usecases/create.price.usecase";

export class CreatePriceController {
  constructor(
    private readonly useCase: CreatePriceUseCase
  ) {}

  handle = async (req: RequestContext) => {
    return this.useCase.execute(req.body);
  };
}
