import { bootstrap } from "../../bootstrap";
import { RequestContext } from "./types";

const {
  getUserEntitlementsController,
  getUserEntitlementByKeyController
} = bootstrap();

export const routes: Record<
  string,
  (req: RequestContext) => Promise<any>
> = {
  "GET /access": getUserEntitlementsController.handle,
  "GET /access/:key": getUserEntitlementByKeyController.handle
};
