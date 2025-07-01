import paystackProviderModule from "./providers/paystack/module"

export default paystackProviderModule

export { default as PaystackProvider } from "./providers/paystack"

// Re-export types for convenience
export type {
  PaystackConfig,
  PaystackPaymentData,
  PaystackTransactionResponse,
  PaystackVerificationResponse,
} from "./providers/paystack"
