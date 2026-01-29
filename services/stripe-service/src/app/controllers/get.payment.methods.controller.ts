import { RequestContext } from "../../handler/api-gateway/types";
import { StripeClient } from "../../infrastructure/stripe.client";
import { StripeCustomerRepository } from "../../infrastructure/stripe-customer.repository";

export class GetPaymentMethodsController {
  constructor(
    private readonly stripeClient: StripeClient,
    private readonly customerRepo: StripeCustomerRepository
  ) {}

  handle = async (req: RequestContext & { user: { id: string } }) => {
    const userId = req.user.id;

    const customer = await this.customerRepo.findByUserId(userId);
    if (!customer) {
      return {
        paymentMethods: [],
      };
    }

    const stripeCustomer = await this.stripeClient.retrieveCustomer(customer.stripeCustomerId);
    const paymentMethods = await this.stripeClient.listCustomerPaymentMethods(customer.stripeCustomerId);

    const defaultPaymentMethodId = typeof stripeCustomer.invoice_settings?.default_payment_method === "string"
      ? stripeCustomer.invoice_settings.default_payment_method
      : stripeCustomer.invoice_settings?.default_payment_method?.toString();

    return {
      paymentMethods: paymentMethods.map(pm => ({
        id: pm.id,
        type: pm.type,
        card: pm.card ? {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
        } : undefined,
        isDefault: pm.id === defaultPaymentMethodId,
      })),
    };
  };
}
