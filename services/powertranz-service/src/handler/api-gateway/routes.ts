import { bootstrap } from "../../bootstrap";
import { RequestContext } from "./types";

const {
  healthController,
  createPaymentIntentController,
  powerTranzCallbackController,
} = bootstrap();

export const routes: Record<string, (req: RequestContext) => Promise<any>> = {
  "GET /powertranz/health": healthController.handle.bind(healthController),
  "POST /powertranz/payment-intents": createPaymentIntentController.handle.bind(
    createPaymentIntentController,
  ),
  "POST /powertranz/callback": powerTranzCallbackController.handle.bind(
    powerTranzCallbackController,
  ),
};
