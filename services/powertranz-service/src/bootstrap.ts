import { HealthController } from "./app/controllers/health.controller";
import { CreatePaymentIntentController } from "./app/controllers/create.payment.intent.controller";
import { CreatePaymentIntentUseCase } from "./app/usecases/create.payment.intent.usecase";
import { PowerTranzClient } from "./infrastructure/powertranz.client";

export function bootstrap() {
  const healthController = new HealthController();

  const powerTranzClient = new PowerTranzClient();

  const createPaymentIntentUseCase = new CreatePaymentIntentUseCase(
    /* getPriceUseCase */ null as any,
    /* getProductUseCase */ null as any,
    powerTranzClient,
  );

  const createPaymentIntentController = new CreatePaymentIntentController(
    createPaymentIntentUseCase,
  );
  return {
    healthController,
    createPaymentIntentController,
  };
}
