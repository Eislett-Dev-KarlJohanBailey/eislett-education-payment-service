import { bootstrap } from "../../bootstrap";
import { RequestContext } from "./types";

const { healthController } = bootstrap();

export const routes: Record<string, (req: RequestContext) => Promise<any>> = {
  "GET /powertranz/health": healthController.handle.bind(healthController),
};
