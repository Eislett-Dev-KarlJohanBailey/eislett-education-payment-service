import { RequestContext } from "../../handler/api-gateway/types";
import { HandleWebhookUseCase } from "../usecases/handle.webhook.usecase";
import { StripeClient } from "../../infrastructure/stripe.client";

export class WebhookController {
  constructor(
    private readonly useCase: HandleWebhookUseCase,
    private readonly stripeClient: StripeClient
  ) {}

  handle = async (req: RequestContext) => {
    const signature = req.headers?.["stripe-signature"];
    if (!signature) {
      throw new Error("Missing Stripe signature");
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET environment variable is not set");
    }

    // Verify and construct event
    const event = this.stripeClient.constructEvent(
      req.body as string,
      signature as string,
      webhookSecret
    );

    await this.useCase.execute(event);

    return { received: true };
  };
}
