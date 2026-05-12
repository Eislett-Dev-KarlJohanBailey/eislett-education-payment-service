import { HealthController } from "./app/controllers/health.controller";

export function bootstrap() {
  const healthController = new HealthController();

  return {
    healthController,
  };
}
