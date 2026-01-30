import { RequestContext } from "../../handler/api-gateway/types";
import { CreatePaymentIntentUseCase } from "../usecases/create.payment.intent.usecase";
import { AuthenticationError } from "@libs/domain";

export class CreatePaymentIntentController {
  constructor(
    private readonly useCase: CreatePaymentIntentUseCase
  ) {}

  handle = async (req: RequestContext & { user?: { id: string; role?: string } }) => {
    const { priceId, addonProductIds, paymentMethodId, successUrl, cancelUrl } = req.body ?? {};
    if (!req.user?.id) {
      throw new AuthenticationError("Authorization required");
    }
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
      paymentMethodId: typeof paymentMethodId === "string" ? paymentMethodId : undefined,
      successUrl,
      cancelUrl,
    });
  };
}
