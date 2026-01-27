
import { CreateProductUseCase, GetProductUseCase, UpdateProductUseCase, DeleteProductUseCase, DynamoProductRepository, ListProductsUseCase, SearchProductsUseCase } from "@libs/domain";
import { CreateProductController } from "./app/controllers/create.product.controller";
import { ListProductsController } from "./app/controllers/list.products.controller";
import { SearchProductsController } from "./app/controllers/search.products.controller";
import { GetProductController } from "./app/controllers/get.product.controller";
import { UpdateProductController } from "./app/controllers/update.product.controller";
import { DeleteProductController } from "./app/controllers/delete.product.controller";

export function bootstrap() {
  const productRepo = new DynamoProductRepository();

  return {
    createProductController: new CreateProductController(
      new CreateProductUseCase(productRepo)
    ),
    listProductsController: new ListProductsController(
      new ListProductsUseCase(productRepo)
    ),
    searchProductsController: new SearchProductsController(
      new SearchProductsUseCase(productRepo)
    ),
    getProductController: new GetProductController(
      new GetProductUseCase(productRepo)
    ),
    updateProductController: new UpdateProductController(
      new UpdateProductUseCase(productRepo)
    ),
    deleteProductController: new DeleteProductController(
      new DeleteProductUseCase(productRepo)
    )
  };
}
``