import { RequestContext } from "../../handler/api-gateway/types";
import { CreatePaymentIntentUseCase } from "../usecases/create.payment.intent.usecase";

export class CreatePaymentIntentController {
  constructor(
    private readonly useCase: CreatePaymentIntentUseCase
  ) {}

  handle = async (req: RequestContext & { user: { id: string; role?: string } }) => {
    const { priceId, addonProductIds, successUrl, cancelUrl } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!priceId) {
      throw new Error("priceId is required");
    }
    if (!successUrl) {
      throw new Error("successUrl is required");
    }
    if (!cancelUrl) {
      throw new Error("cancelUrl is required");
    }

    return await this.useCase.execute({
      userId,
      userRole,
      priceId,
      addonProductIds: Array.isArray(addonProductIds) ? addonProductIds : undefined,
      successUrl,
      cancelUrl,
    });
  };
}
