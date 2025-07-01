# Medusa Paystack Plugin v2

A robust Paystack payment integration plugin for **Medusa v2.8.6+** that provides seamless payment processing using Paystack's payment infrastructure with support for the new payment session lifecycle.

## ✨ Features

- 🚀 **Complete Payment Flow**: Initialize, authorize, capture, and refund payments
- 🔐 **Secure Transactions**: Built-in webhook verification and secure API communication  
- 🌍 **Multi-Currency Support**: NGN, USD, GHS, ZAR with automatic currency conversion
- 📱 **Modern Payment Experience**: Paystack Popup integration with retry mechanisms
- 🎯 **Medusa v2 Compatible**: Full support for new payment session lifecycle
- 🔄 **Session Management**: Intelligent session refresh and expiry handling
- 🛡️ **Error Handling**: Comprehensive error handling with user-friendly messages

## 📦 Installation

### 1. Install the Plugin

```bash
npm install @alexasomba/medusa-paystack-plugin-v2
# or
yarn add @alexasomba/medusa-paystack-plugin-v2
```

### 2. Environment Configuration

Add these environment variables to your `.env` file:

```env
# Paystack Configuration
PAYSTACK_SECRET_KEY=sk_test_your_secret_key_here
PAYSTACK_PUBLIC_KEY=pk_test_your_public_key_here
PAYSTACK_WEBHOOK_SECRET=your_webhook_secret_here
```

### 3. Medusa Configuration

Configure the plugin in your `medusa-config.ts`:

```typescript
import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    }
  },
  modules: [
    {
      resolve: "@medusajs/payment",
      options: {
        providers: [
          {
            resolve: "@alexasomba/medusa-paystack-plugin-v2",
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

### 4. Build and Start

```bash
npm run build
npm run dev
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `PAYSTACK_SECRET_KEY` | Your Paystack secret key | ✅ | `sk_test_...` |
| `PAYSTACK_PUBLIC_KEY` | Your Paystack public key | ✅ | `pk_test_...` |
| `PAYSTACK_WEBHOOK_SECRET` | Webhook secret for verification | ⚠️ Recommended | `whsec_...` |

### Plugin Configuration

```typescript
interface PaystackConfig {
  secret_key: string      // Paystack secret key
  public_key: string      // Paystack public key  
  webhook_secret?: string // Optional webhook secret
}
```

## 🖥️ Frontend Integration

### Next.js Storefront Integration

Install required dependencies in your storefront:

```bash
npm install @paystack/inline-js
```

### 1. Paystack Payment Component

```tsx
// components/PaystackPayment.tsx
"use client"

import { useState } from "react"
import { toast } from "@medusajs/ui"

interface PaystackPaymentProps {
  session: any
  cart: any
  onPaymentCompleted: (reference: string) => void
  onPaymentFailed: (error: string) => void
}

export function PaystackPayment({ 
  session, 
  cart,
  onPaymentCompleted, 
  onPaymentFailed 
}: PaystackPaymentProps) {
  const [isLoading, setIsLoading] = useState(false)

  const initializePayment = async () => {
    try {
      setIsLoading(true)
      
      const { access_code, authorization_url } = session.data
      
      if (!access_code) {
        throw new Error("Payment session not ready")
      }

      // Use Paystack Popup
      const PaystackPop = (await import("@paystack/inline-js")).default
      const popup = new PaystackPop()
      
      popup.resumeTransaction(access_code, {
        onClose: () => {
          setIsLoading(false)
          toast.warning("Payment was cancelled")
        },
        onSuccess: (transaction: any) => {
          setIsLoading(false)
          toast.success("Payment successful!")
          onPaymentCompleted(transaction.reference)
        },
        onError: (error: any) => {
          setIsLoading(false)
          let errorMessage = "Payment failed"
          
          if (error.message?.toLowerCase().includes('not found')) {
            errorMessage = "Payment session expired. Please try again."
          }
          
          toast.error(errorMessage)
          onPaymentFailed(errorMessage)
        }
      })
      
    } catch (error) {
      setIsLoading(false)
      onPaymentFailed(error.message)
    }
  }

  return (
    <button
      onClick={initializePayment}
      disabled={isLoading}
      className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg"
    >
      {isLoading ? "Processing..." : "Pay with Paystack"}
    </button>
  )
}
```

### 2. Payment Session Hook

```tsx
// hooks/use-paystack-session.tsx
import { useState, useEffect } from "react"

export function usePaystackSession({ session, cart, onSessionUpdate }) {
  const [isReady, setIsReady] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    if (session?.data) {
      const { authorization_url, access_code, session_expired, payment_completed } = session.data
      
      const isExpiredOrCompleted = session_expired === true || payment_completed === true
      const ready = !isExpiredOrCompleted && 
                   ((session.status === "requires_more" && (authorization_url || access_code)) ||
                    session.status === "authorized")
      
      setIsReady(ready)
    }
  }, [session])

  const updateSession = async (customerData?: any) => {
    if (!cart?.payment_collection?.id) return false

    setIsUpdating(true)
    
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL}/store/payment-collections/${cart.payment_collection.id}/payment-sessions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY!,
          },
          body: JSON.stringify({
            provider_id: "pp_paystack_paystack",
            data: { email: customerData?.email || cart.email }
          }),
        }
      )

      if (response.ok) {
        const result = await response.json()
        const paystackSession = result.payment_collection.payment_sessions?.find(
          (s: any) => s.provider_id === 'pp_paystack_paystack'
        )
        
        if (paystackSession && onSessionUpdate) {
          onSessionUpdate(paystackSession)
          return true
        }
      }
      
      return false
    } catch (error) {
      console.error('Session update failed:', error)
      return false
    } finally {
      setIsUpdating(false)
    }
  }

  return {
    isReady,
    isUpdating,
    updateSession,
    sessionData: session?.data,
  }
}
```

### 3. Integration in Checkout

```tsx
// In your checkout component
import { PaystackPayment } from "./PaystackPayment"
import { usePaystackSession } from "./use-paystack-session"

export function CheckoutPayment({ cart }) {
  const paystackSession = cart.payment_collection?.payment_sessions?.find(
    (session) => session.provider_id === "pp_paystack_paystack"
  )

  const { isReady, updateSession } = usePaystackSession({
    session: paystackSession,
    cart,
    onSessionUpdate: (updatedSession) => {
      // Handle session update
    }
  })

  const handlePaymentCompleted = async (reference: string) => {
    // Complete the cart/order
    const response = await fetch(`/store/carts/${cart.id}/complete`, {
      method: "POST",
      headers: {
        "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY!,
      },
    })
    
    if (response.ok) {
      // Redirect to success page
      window.location.href = "/order/confirmed"
    }
  }

  if (!paystackSession) {
    return <div>Paystack payment not available</div>
  }

  return (
    <PaystackPayment
      session={paystackSession}
      cart={cart}
      onPaymentCompleted={handlePaymentCompleted}
      onPaymentFailed={(error) => console.error("Payment failed:", error)}
    />
  )
}
```

## 🔧 Backend Features

### Payment Session Lifecycle

The plugin correctly implements Medusa v2's payment session states:

- **`pending`** - Session created but awaiting customer email
- **`requires_more`** - Ready for payment (has authorization URL)
- **`authorized`** - Payment completed successfully
- **`error`** - Payment failed or session error

### Session Refresh & Expiry Handling

The plugin automatically handles:

- Expired access codes
- Completed payment sessions
- Session recreation for retry scenarios
- Customer email validation

### Webhook Support

Set up webhooks in your Paystack dashboard:

```txt
Webhook URL: https://yourdomain.com/store/paystack/webhook/route
Events: charge.success, charge.failed
```

### API Endpoints

The plugin provides these endpoints:

- `POST /store/paystack/webhook/route` - Webhook handler
- `GET /admin/paystack/route` - Admin verification
- `GET /store/plugin/route` - Plugin status

## 💰 Supported Currencies

| Currency | Code | Subunit | Example |
|----------|------|---------|---------|
| Nigerian Naira | NGN | kobo | ₦100.00 |
| US Dollar | USD | cents | $1.00 |
| Ghanaian Cedi | GHS | pesewas | GH₵1.00 |
| South African Rand | ZAR | cents | R1.00 |

## 🔍 Testing

### Test Cards

Use these test cards in development:

```txt
# Successful Payment
Card: 4084 0840 8408 4081
CVV: 408
Expiry: 12/25

# Declined Payment  
Card: 4084 0840 8408 4096
CVV: 408
Expiry: 12/25
```

### Development Workflow

1. Use test API keys from Paystack dashboard
2. Test with different scenarios (success, failure, expired sessions)
3. Verify webhook delivery in Paystack dashboard
4. Test session refresh and retry mechanisms

## 🛠️ Troubleshooting

### Common Issues

#### "Not found" Error in Payment Popup

- This occurs when trying to reuse an expired/completed access code
- The plugin automatically handles this with session refresh
- Ensure your frontend implements the session refresh logic

#### Session Status Undefined Error

- Fixed in v1.3.3+ - plugin now always returns valid status
- Update to latest version if experiencing this

#### Customer Email Missing

- Ensure customer email is provided during session creation
- Plugin returns `pending` status until email is available

#### Webhook Not Triggering

- Verify webhook URL is publicly accessible
- Check webhook secret configuration
- Review Paystack dashboard for delivery logs

### Debugging

Enable detailed logging:

```env
LOG_LEVEL=debug
NODE_ENV=development
```

This will show detailed logs for:

- Payment session creation
- Paystack API responses  
- Session status changes
- Error details

## 📊 Migration from v1

If upgrading from v1, note these breaking changes:

1. **Provider ID**: Now uses `pp_paystack_paystack` format
2. **Session Management**: New lifecycle handling
3. **Configuration**: Updated to Medusa v2 format
4. **Dependencies**: Uses official Paystack SDK

### Migration Steps

1. Update configuration to new format
2. Install new version: `npm install @alexasomba/medusa-paystack-plugin-v2`
3. Update frontend integration to use new session states
4. Test thoroughly with new session refresh logic

## 🚀 Version History

- **v1.3.3** - Fixed session status handling and expiry management
- **v1.3.0** - Added session refresh and error handling improvements  
- **v1.2.0** - Multi-currency support and official Paystack SDK
- **v1.1.0** - Webhook support and admin integration
- **v1.0.0** - Initial release for Medusa v2

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

- 📧 **Email**: <alex@asomba.com>
- 💬 **GitHub Issues**: [Report Issues](https://github.com/alexasomba/medusa-paystack-plugin-v2/issues)
- 📖 **Documentation**: [Medusa Docs](https://docs.medusajs.com)
- 🌍 **Community**: [Medusa Discord](https://discord.gg/medusajs)

## ⭐ Show Your Support

If this plugin helps your project, please give it a star on GitHub! ⭐

---

Built with ❤️ for the Medusa community
