import { HealthController } from "./app/controllers/health.controller";
import { CreatePaymentIntentController } from "./app/controllers/create.payment.intent.controller";
import { CreatePaymentIntentUseCase } from "./app/usecases/create.payment.intent.usecase";
import { PowerTranzClient } from "./infrastructure/powertranz.client";
import { DynamoPowerTranzIntentRepository } from "./infrastructure/dynamo.powertranz-intent.repository";
import {
  GetPriceUseCase,
  GetProductUseCase,
  DynamoPriceRepository,
  DynamoProductRepository,
} from "@libs/domain";

export function bootstrap() {
  const healthController = new HealthController();
  const priceRepo = new DynamoPriceRepository();
  const productRepo = new DynamoProductRepository();

  const getPriceUseCase = new GetPriceUseCase(priceRepo);
  const getProductUseCase = new GetProductUseCase(productRepo);

  const powerTranzClient = new PowerTranzClient();
  const paymentIntentRepo = new DynamoPowerTranzIntentRepository();

  const createPaymentIntentUseCase = new CreatePaymentIntentUseCase(
    getPriceUseCase,
    getProductUseCase,
    powerTranzClient,
    paymentIntentRepo,
  );

  const createPaymentIntentController = new CreatePaymentIntentController(
    createPaymentIntentUseCase,
  );
  return {
    healthController,
    createPaymentIntentController,
  };
}
