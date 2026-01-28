import { bootstrap } from "../../bootstrap";
import { RequestContext } from "./types";

const {
  getUserTransactionsController,
  getAllTransactionsController
} = bootstrap();

export const routes: Record<
  string,
  (req: RequestContext) => Promise<any>
> = {
  "GET /transactions": getUserTransactionsController.handle,
  "GET /transactions/all": getAllTransactionsController.handle
};
