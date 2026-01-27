import { bootstrap } from "../../bootstrap";
import { RequestContext } from "./types";

const {
  createPaymentIntentController,
  webhookController,
} = bootstrap();

export const routes: Record<
  string,
  (req: RequestContext & { user?: { id: string; role?: string } }) => Promise<any>
> = {
  "POST /stripe/payment-intent": createPaymentIntentController.handle as any,
  "POST /stripe/webhook": webhookController.handle,
};
