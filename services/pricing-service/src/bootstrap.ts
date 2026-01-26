import { DynamoPriceRepository } from "@libs/domain/pricing/dynamodb/price.repository";
import { CreatePriceUseCase } from "@libs/domain/pricing/app/usecases/create.price.usecase";
import { GetPriceUseCase } from "@libs/domain/pricing/app/usecases/get.price.usecase";
import { ListPricesByProductUseCase } from "@libs/domain/pricing/app/usecases/list.prices.by.product.usecase";
import { UpdatePriceUseCase } from "@libs/domain/pricing/app/usecases/update.price.usecase";
import { DeletePriceUseCase } from "@libs/domain/pricing/app/usecases/delete.price.usecase";
import { CreatePriceController } from "./app/controllers/create.price.controller";
import { GetPriceController } from "./app/controllers/get.price.controller";
import { ListPricesByProductController } from "./app/controllers/list.prices.by.product.controller";
import { UpdatePriceController } from "./app/controllers/update.price.controller";
import { DeletePriceController } from "./app/controllers/delete.price.controller";

export function bootstrap() {
  const priceRepo = new DynamoPriceRepository();

  return {
    createPriceController: new CreatePriceController(
      new CreatePriceUseCase(priceRepo)
    ),
    getPriceController: new GetPriceController(
      new GetPriceUseCase(priceRepo)
    ),
    listPricesByProductController: new ListPricesByProductController(
      new ListPricesByProductUseCase(priceRepo)
    ),
    updatePriceController: new UpdatePriceController(
      new UpdatePriceUseCase(priceRepo)
    ),
    deletePriceController: new DeletePriceController(
      new DeletePriceUseCase(priceRepo)
    )
  };
}
