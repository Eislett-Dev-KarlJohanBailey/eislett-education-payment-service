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

    // Get raw body string - Stripe requires the original raw body for signature verification
    // Prefer rawBody if available (from parseRequest), otherwise use body
    let rawBody: string | Buffer;
    if (req.rawBody && typeof req.rawBody === "string") {
      // Use raw body from event (preferred)
      rawBody = req.rawBody;
    } else if (typeof req.body === "string") {
      // Fallback to body if it's still a string
      rawBody = req.body;
    } else if (Buffer.isBuffer(req.body)) {
      rawBody = req.body;
    } else {
      // Body was parsed as object - convert back to JSON string
      // This shouldn't happen if parseRequest is working correctly, but handle it as fallback
      rawBody = JSON.stringify(req.body);
      console.warn("Webhook body was parsed as object, converting back to string. This may cause signature verification issues.");
    }

    // Verify and construct event
    const event = this.stripeClient.constructEvent(
      rawBody,
      signature as string,
      webhookSecret
    );

    await this.useCase.execute(event);

    return { received: true };
  };
}
