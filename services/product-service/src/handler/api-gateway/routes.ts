import { bootstrap } from "../../bootstrap";
import { RequestContext } from "./types";


const {
  createProductController,
  getProductController,
  listProductsController,
  searchProductsController,
  updateProductController,
  deleteProductController
} = bootstrap();

export const routes: Record<
  string,
  (req: RequestContext) => Promise<any>
> = {
  "POST /products": createProductController.handle,
  "GET /products": listProductsController.handle,
  "GET /products/search": searchProductsController.handle,
  "GET /products/{id}": getProductController.handle,
  "PUT /products/{id}": updateProductController.handle,
  "DELETE /products/{id}": deleteProductController.handle
};
