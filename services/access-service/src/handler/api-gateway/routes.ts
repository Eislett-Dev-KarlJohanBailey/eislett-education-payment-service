import { bootstrap } from "../../bootstrap";
import { RequestContext } from "./types";

const {
  getUserEntitlementsController
} = bootstrap();

export const routes: Record<
  string,
  (req: RequestContext) => Promise<any>
> = {
  "GET /access": getUserEntitlementsController.handle
};
