import { RequestContext } from "../../handler/api-gateway/types";
import { CreatePaymentIntentUseCase } from "../usecases/create.payment.intent.usecase";
import { AuthenticationError } from "@libs/domain";

export class CreatePaymentIntentController {
  // for creating a payment intent, ensuring thete is jwt and price_id and then sends it to the usecase
  constructor(private readonly useCase: CreatePaymentIntentUseCase) {}

  handle = async (
    req: RequestContext & {
      user?: { id: string; role?: string; email?: string };
    },
  ) => {
    if (!req.user?.id) {
      throw new AuthenticationError("Authorization required");
    }

    const priceId = req.body?.price_id;
    if (!priceId) {
      const error = new Error("price_id is required");
      error.name = "ValidationError";
      throw error;
    }

    return await this.useCase.execute({
      userId: req.user.id,
      userRole: req.user.role,
      userEmail: req.user.email,
      priceId,
    });
  };
}
