import { bootstrap } from "../../bootstrap";
import { RequestContext } from "./types";

const {
  startTrialController
} = bootstrap();

export const routes: Record<
  string,
  (req: RequestContext) => Promise<any>
> = {
  "POST /trial": startTrialController.handle
};
