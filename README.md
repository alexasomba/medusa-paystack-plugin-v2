# Medusa Paystack Plugin

A comprehensive Paystack payment integration plugin for Medusa v2 that enables seamless payment processing using Paystack's robust payment infrastructure.

## Features

- 🚀 **Complete Payment Flow**: Initialize, authorize, capture, and refund payments
- 🔐 **Secure Transactions**: Built-in webhook verification and secure API communication
- 🌍 **Multi-Currency Support**: Support for NGN, USD, GHS, ZAR, and KES
- 📱 **Mobile-Friendly**: Optimized for mobile payment experiences
- 🎯 **Admin Integration**: Full admin panel integration for payment management
- 🔄 **Real-time Updates**: Webhook support for real-time payment status updates

## Installation

1. **Install the plugin**:
   ```bash
   npm install medusa-paystack-plugin
   ```

2. **Add environment variables** to your `.env` file:
   ```env
   PAYSTACK_SECRET_KEY=sk_test_your_secret_key
   PAYSTACK_PUBLIC_KEY=pk_test_your_public_key
   PAYSTACK_WEBHOOK_SECRET=your_webhook_secret
   ```

3. **Configure the plugin** in your `medusa-config.ts`:
   ```typescript
   import { defineConfig } from "@medusajs/medusa"

   export default defineConfig({
     // ... other configurations
     plugins: [
       {
         resolve: "medusa-paystack-plugin",
         options: {
           secret_key: process.env.PAYSTACK_SECRET_KEY,
           public_key: process.env.PAYSTACK_PUBLIC_KEY,
           webhook_secret: process.env.PAYSTACK_WEBHOOK_SECRET,
         },
       },
     ],
     // ... rest of configuration
   })
   ```

4. **Add the payment provider** to your payment module configuration:
   ```typescript
   // In your medusa-config.ts
   export default defineConfig({
     modules: [
       {
         resolve: "@medusajs/payment",
         options: {
           providers: [
             {
               resolve: "medusa-paystack-plugin",
               id: "paystack",
               options: {
                 secret_key: process.env.PAYSTACK_SECRET_KEY,
                 public_key: process.env.PAYSTACK_PUBLIC_KEY,
                 webhook_secret: process.env.PAYSTACK_WEBHOOK_SECRET,
               },
             },
           ],
         },
       },
     ],
   })
   ```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PAYSTACK_SECRET_KEY` | Your Paystack secret key from dashboard | ✅ |
| `PAYSTACK_PUBLIC_KEY` | Your Paystack public key from dashboard | ✅ |
| `PAYSTACK_WEBHOOK_SECRET` | Webhook secret for verifying webhooks | ⚠️ Recommended |

### Plugin Options

```typescript
interface PaystackConfig {
  secret_key: string    // Paystack secret key
  public_key: string    // Paystack public key  
  webhook_secret?: string // Optional webhook secret for verification
}
```

## Frontend Integration

### React/Next.js Storefront

Here's how to integrate Paystack payments in your storefront:

```typescript
// components/PaystackPayment.tsx
import { usePaymentSession } from "@medusajs/react"

export function PaystackPayment({ session, onPaymentCompleted }) {
  const initializePayment = async () => {
    try {
      // The session data includes authorization_url and public_key
      const { authorization_url, public_key } = session.data
      
      // Redirect to Paystack payment page
      window.location.href = authorization_url
      
      // Alternative: Use Paystack Popup (requires Paystack script)
      const handler = PaystackPop.setup({
        key: public_key,
        email: session.customer_email,
        amount: session.amount,
        currency: session.currency_code,
        ref: session.data.reference,
        callback: function(response) {
          // Payment successful, verify on backend
          onPaymentCompleted(response.reference)
        },
        onClose: function() {
          // User closed payment modal
        }
      })
      
      handler.openIframe()
    } catch (error) {
      console.error("Payment initialization failed:", error)
    }
  }

  return (
    <button onClick={initializePayment}>
      Pay with Paystack
    </button>
  )
}
```

### Payment Verification

```typescript
// utils/verifyPayment.ts
export async function verifyPayment(reference: string) {
  const response = await fetch(`/api/paystack/verify?reference=${reference}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  })
  
  return response.json()
}
```

## Backend Integration

### Webhook Setup

1. **Set up webhook endpoint** in your Paystack dashboard:
   ```
   https://yourdomain.com/paystack/webhook
   ```

2. **Configure webhook events**:
   - `charge.success` - Payment successful
   - `charge.failed` - Payment failed

### Custom Admin Actions

```typescript
// Admin action to refund payment
const refundPayment = async (reference: string, amount: number) => {
  const response = await fetch("/admin/paystack", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      action: "refund",
      reference,
      amount,
    }),
  })
  
  return response.json()
}
```

## API Reference

### Webhook Events

The plugin handles the following Paystack webhook events:

- `charge.success` - Payment completed successfully
- `charge.failed` - Payment failed
- `transfer.success` - Transfer completed (for marketplaces)
- `transfer.failed` - Transfer failed

### Admin Endpoints

- `GET /admin/paystack?reference=<ref>` - Verify payment status
- `POST /admin/paystack` - Perform admin actions (refund, verify)

### Store Endpoints

- `POST /store/paystack/webhook` - Webhook endpoint for Paystack events

## Development

### Building the Plugin

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

### Testing

```bash
npm test
```

## Supported Currencies

- 🇳🇬 **NGN** - Nigerian Naira
- 🇺🇸 **USD** - US Dollar  
- 🇬🇭 **GHS** - Ghanaian Cedi
- 🇿🇦 **ZAR** - South African Rand
- 🇰🇪 **KES** - Kenyan Shilling

## Security

- All API communications use HTTPS
- Webhook signature verification prevents tampering
- Sensitive data is never logged
- API keys are securely stored in environment variables

## Troubleshooting

### Common Issues

1. **"Invalid API Key" Error**
   - Verify your secret key in environment variables
   - Ensure you're using the correct key for your environment (test/live)

2. **Webhook Not Working**
   - Verify webhook URL is accessible
   - Check webhook secret configuration
   - Review server logs for errors

3. **Payment Not Completing**
   - Check payment amount is in correct format (minor units)
   - Verify customer email is provided
   - Check Paystack dashboard for transaction status

### Debug Mode

Enable debug logging by setting:
```env
LOG_LEVEL=debug
```

## Support

- 📧 **Email**: alex@asomba.com
- 💬 **Discord**: [Medusa Community](https://discord.gg/medusajs)
- 📖 **Documentation**: [Medusa Docs](https://docs.medusajs.com)
- 🐛 **Issues**: [GitHub Issues](https://github.com/alexasomba/medusa-paystack-plugin-v2/issues)

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
