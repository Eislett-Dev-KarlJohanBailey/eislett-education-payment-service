import { bootstrap } from "../../bootstrap";
import { RequestContext } from "./types";

const {
  createPriceController,
  getPriceController,
  listPricesByProductController,
  updatePriceController,
  deletePriceController
} = bootstrap();

export const routes: Record<
  string,
  (req: RequestContext) => Promise<any>
> = {
  "POST /prices": createPriceController.handle,
  "GET /prices/{id}": getPriceController.handle,
  "GET /prices/product/{productId}": listPricesByProductController.handle,
  "PUT /prices/{id}": updatePriceController.handle,
  "DELETE /prices/{id}": deletePriceController.handle
};
