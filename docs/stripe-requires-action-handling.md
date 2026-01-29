# Handling Stripe `requires_action` Status

When a payment requires additional authentication (like 3D Secure), Stripe returns `status: "requires_action"` with a `clientSecret`. You **do not get a URL** - instead, you use **Stripe.js** on the frontend to handle the authentication.

## Response Format

When `requires_action` is returned:

```json
{
  "paymentIntentId": "pi_xxx",
  "status": "requires_action",
  "clientSecret": "pi_xxx_secret_xxx",
  "requiresAction": true,
  "nextAction": {
    "type": "complete_payment",
    "message": "Use Stripe.js with the clientSecret to complete 3D Secure authentication",
    "requiresClientSecret": true
  },
  "customerId": "cus_xxx",
  "isUpdate": false
}
```

## Frontend Implementation

### 1. Install Stripe.js

```bash
npm install @stripe/stripe-js
```

### 2. Handle `requires_action` Status

```typescript
import { loadStripe } from '@stripe/stripe-js';

const stripe = await loadStripe('pk_test_...'); // Your publishable key

async function handlePaymentResponse(response: CreatePaymentIntentOutput) {
  if (response.status === "succeeded") {
    // Payment succeeded immediately
    showSuccess();
    return;
  }

  if (response.status === "requires_action" && response.clientSecret) {
    // Handle 3D Secure or other authentication
    await handleStripeAuthentication(response.clientSecret);
    return;
  }

  if (response.status === "processing") {
    // Show processing UI and poll
    showProcessingUI();
    pollPaymentStatus(response.paymentIntentId!);
    return;
  }

  // Fallback to checkout
  if (response.checkoutUrl) {
    window.location.href = response.checkoutUrl;
  }
}

async function handleStripeAuthentication(clientSecret: string) {
  if (!stripe) {
    throw new Error("Stripe not initialized");
  }

  // Use Stripe.js to handle the authentication
  const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
    payment_method: {
      // If you have payment method details, you can pass them here
      // Otherwise, Stripe will prompt the user
    }
  });

  if (error) {
    // Handle error (e.g., card was declined)
    console.error("Payment failed:", error);
    showError(error.message);
    return;
  }

  if (paymentIntent) {
    // Check final status
    if (paymentIntent.status === "succeeded") {
      showSuccess();
    } else if (paymentIntent.status === "processing") {
      showProcessingUI();
      pollPaymentStatus(paymentIntent.id);
    } else if (paymentIntent.status === "requires_action") {
      // Still requires action - this shouldn't happen after confirmCardPayment
      // but handle it just in case
      console.warn("Payment still requires action");
      await handleStripeAuthentication(clientSecret);
    }
  }
}
```

### 3. Alternative: Using Stripe Elements

If you want more control over the UI, you can use Stripe Elements:

```typescript
import { loadStripe, StripeElements } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';

// In your component
function PaymentForm({ clientSecret }: { clientSecret: string }) {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    const cardElement = elements.getElement(CardElement);

    if (!cardElement) {
      return;
    }

    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: cardElement,
        billing_details: {
          // Add billing details if needed
        }
      }
    });

    if (error) {
      console.error("Payment failed:", error);
      showError(error.message);
    } else if (paymentIntent?.status === "succeeded") {
      showSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <CardElement />
      <button type="submit" disabled={!stripe}>
        Complete Payment
      </button>
    </form>
  );
}
```

## Complete Flow Example

```typescript
async function processPayment(priceId: string, paymentMethodId?: string) {
  try {
    // 1. Create payment intent
    const response = await fetch('/stripe/payment-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        priceId,
        paymentMethodId, // Optional
        successUrl: window.location.origin + '/success',
        cancelUrl: window.location.origin + '/cancel'
      })
    });

    const result = await response.json();

    // 2. Handle different statuses
    if (result.status === "succeeded") {
      // Payment succeeded immediately
      window.location.href = '/success';
      return;
    }

    if (result.status === "requires_action" && result.clientSecret) {
      // 3. Use Stripe.js to complete authentication
      const stripe = await loadStripe('pk_test_...');
      const { error, paymentIntent } = await stripe!.confirmCardPayment(result.clientSecret);

      if (error) {
        alert(`Payment failed: ${error.message}`);
        return;
      }

      if (paymentIntent?.status === "succeeded") {
        window.location.href = '/success';
      } else if (paymentIntent?.status === "processing") {
        // Poll for status
        pollPaymentStatus(paymentIntent.id);
      }
      return;
    }

    if (result.status === "processing") {
      // Show processing UI and poll
      showProcessingUI();
      pollPaymentStatus(result.paymentIntentId);
      return;
    }

    // Fallback to checkout
    if (result.checkoutUrl) {
      window.location.href = result.checkoutUrl;
    }
  } catch (error) {
    console.error("Payment error:", error);
    alert("An error occurred. Please try again.");
  }
}

async function pollPaymentStatus(paymentIntentId: string) {
  const maxAttempts = 60; // 5 minutes if polling every 5 seconds
  let attempts = 0;
  
  const poll = async () => {
    if (attempts >= maxAttempts) {
      alert("Payment is taking longer than expected. Please check back later.");
      return;
    }
    
    attempts++;
    
    const response = await fetch(`/stripe/payment-intent/${paymentIntentId}/status`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (data.status === "succeeded") {
      window.location.href = '/success';
      return;
    }
    
    if (data.status === "requires_action" && data.clientSecret) {
      // Handle authentication
      const stripe = await loadStripe('pk_test_...');
      await stripe!.confirmCardPayment(data.clientSecret);
      return;
    }
    
    if (data.status === "processing") {
      // Continue polling
      setTimeout(poll, 5000);
      return;
    }
    
    // Failed or other status
    alert("Payment failed. Please try again.");
  };
  
  setTimeout(poll, 5000);
}
```

## Important Notes

1. **No URL provided**: Stripe does not provide a redirect URL for `requires_action`. You must use Stripe.js on your frontend.

2. **Client Secret**: The `clientSecret` is sensitive but safe to use on the frontend. It's scoped to a specific payment intent and can only be used to confirm that payment.

3. **3D Secure**: Most `requires_action` cases are for 3D Secure authentication, which Stripe.js handles automatically with a modal or redirect.

4. **Webhook is source of truth**: Even after confirming on the frontend, wait for the webhook to confirm the final status before granting access.

5. **Error handling**: Always handle errors from `confirmCardPayment` - the card might be declined or authentication might fail.

## Testing

To test `requires_action` in test mode, use these test card numbers:
- **3D Secure required**: `4000 0025 0000 3155`
- **3D Secure authentication failed**: `4000 0000 0000 3055`
- **3D Secure authentication unavailable**: `4000 0000 0000 3220`
