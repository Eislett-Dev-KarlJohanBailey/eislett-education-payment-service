import { RequestContext } from "../../handler/api-gateway/types";
import { StripeClient } from "../../infrastructure/stripe.client";

export class GetPaymentIntentStatusController {
  constructor(
    private readonly stripeClient: StripeClient
  ) {}

  handle = async (req: RequestContext & { user: { id: string } }) => {
    const paymentIntentId = req.pathParams?.paymentIntentId;
    
    if (!paymentIntentId) {
      throw new Error("paymentIntentId is required");
    }

    const paymentIntent = await this.stripeClient.retrievePaymentIntent(paymentIntentId);

    const isProcessing = paymentIntent.status === "processing";
    const requiresAction = paymentIntent.status === "requires_action";

    return {
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      clientSecret: paymentIntent.client_secret || undefined,
      requiresAction,
      isProcessing,
      // Provide next steps based on status
      nextAction: isProcessing ? {
        type: "wait",
        message: "Payment is being processed. Please wait.",
        shouldPoll: true,
        pollIntervalSeconds: 5, // Client should poll every 5 seconds
      } : requiresAction ? {
        type: "complete_payment",
        message: "Additional authentication required (e.g., 3D Secure). Use Stripe.js with the clientSecret to complete.",
        requiresClientSecret: true,
        // Note: clientSecret is already included in the response above
      } : paymentIntent.status === "succeeded" ? {
        type: "success",
        message: "Payment completed successfully.",
      } : paymentIntent.status === "requires_payment_method" ? {
        type: "retry",
        message: "Payment method was declined. Please try a different payment method.",
      } : undefined,
    };
  };
}
