import { bootstrap } from "../../bootstrap";
import { RequestContext } from "./types";

const {
  getUserTransactionsController
} = bootstrap();

export const routes: Record<
  string,
  (req: RequestContext) => Promise<any>
> = {
  "GET /transactions": getUserTransactionsController.handle
};
