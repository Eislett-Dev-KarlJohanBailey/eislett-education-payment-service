import { bootstrap } from "../../bootstrap";
import { RequestContext } from "./types";

const {
  getBillingIssueController
} = bootstrap();

export const routes: Record<
  string,
  (req: RequestContext) => Promise<any>
> = {
  "GET /dunning/billing-issue": getBillingIssueController.handle
};
