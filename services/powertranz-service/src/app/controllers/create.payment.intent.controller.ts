import { AuthenticationError, BadRequestError } from "@libs/domain";
import { RequestContext } from "../../handler/api-gateway/types";
import { CreatePaymentIntentUseCase } from "../usecases/create.payment.intent.usecase";
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
      throw new BadRequestError("price_id is required");
    }

    return this.useCase.execute({
      userId: req.user.id,
      priceId,
    });
  };
}
