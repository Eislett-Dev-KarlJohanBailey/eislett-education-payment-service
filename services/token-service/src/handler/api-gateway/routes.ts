import { bootstrap } from "../../bootstrap";
import { RequestContext } from "./types";

const {
  chargeTokenController,
} = bootstrap();

export const routes: Record<
  string,
  (req: RequestContext & { user?: { id: string; role?: string } }) => Promise<any>
> = {
  "POST /token/charge": chargeTokenController.handle as any,
};
