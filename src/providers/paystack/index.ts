import {
  AbstractPaymentProvider,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import { 
  Logger,
  RefundPaymentInput,
  RefundPaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  PaymentProviderOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
} from "@medusajs/framework/types"
import { Paystack } from "@paystack/paystack-sdk"

export interface PaystackConfig {
  secret_key: string
  public_key: string
  webhook_secret?: string
}

export interface PaystackPaymentData {
  email: string
  amount: number
  currency?: string
  reference?: string
  callback_url?: string
  metadata?: Record<string, any>
}

export interface PaystackTransactionResponse {
  status: boolean
  message: string
  data: {
    authorization_url: string
    access_code: string
    reference: string
  }
}

export interface PaystackVerificationResponse {
  status: boolean
  message: string
  data: {
    id: number
    domain: string
    status: string
    reference: string
    amount: number
    message: string | null
    gateway_response: string
    paid_at: string | null
    created_at: string
    channel: string
    currency: string
    ip_address: string
    metadata: Record<string, any>
    fees: number
    customer: {
      id: number
      first_name: string | null
      last_name: string | null
      email: string
      customer_code: string
      phone: string | null
    }
    authorization: {
      authorization_code: string
      bin: string
      last4: string
      exp_month: string
      exp_year: string
      channel: string
      card_type: string
      bank: string
      country_code: string
      brand: string
      reusable: boolean
    }
  }
}

// Supported currencies by Paystack with their subunit conversion
const PAYSTACK_CURRENCIES = {
  NGN: { subunit: 100, name: 'Naira', subunit_name: 'kobo' },
  GHS: { subunit: 100, name: 'Cedi', subunit_name: 'pesewas' },
  USD: { subunit: 100, name: 'Dollar', subunit_name: 'cents' },
  ZAR: { subunit: 100, name: 'Rand', subunit_name: 'cents' },
} as const

type PaystackCurrency = keyof typeof PAYSTACK_CURRENCIES

export class PaystackProvider extends AbstractPaymentProvider<PaystackConfig> {
  static identifier = "paystack"
  protected readonly logger_: Logger
  protected readonly config_: PaystackConfig
  protected readonly client_: Paystack
  protected readonly container_: any

  constructor(
    container: any,
    config: PaystackConfig
  ) {
    super(container, config)
    this.config_ = config
    this.logger_ = container.logger
    this.container_ = container

    if (!config.secret_key || !config.public_key) {
      throw new Error("Paystack secret_key and public_key are required")
    }

    // Initialize the official Paystack SDK
    this.client_ = new Paystack(config.secret_key)
  }

  /**
   * Convert amount to Paystack's expected subunit based on currency
   * NGN: kobo (1 Naira = 100 kobo)
   * GHS: pesewas (1 Cedi = 100 pesewas)
   * USD/ZAR: cents (1 Dollar/Rand = 100 cents)
   */
  private convertToSubunit(amount: number, currency: string): number {
    const upperCurrency = currency?.toUpperCase() as PaystackCurrency
    const currencyInfo = PAYSTACK_CURRENCIES[upperCurrency]
    
    if (!currencyInfo) {
      this.logger_.warn(`Unsupported currency: ${currency}. Defaulting to NGN conversion.`)
      return Math.round(amount * 100)
    }
    
    return Math.round(amount * currencyInfo.subunit)
  }

  /**
   * Validate if currency is supported by Paystack
   */
  private isSupportedCurrency(currency: string): boolean {
    return Object.keys(PAYSTACK_CURRENCIES).includes(currency?.toUpperCase())
  }

  private async getCartContext(cartId?: string): Promise<any> {
    try {
      if (!cartId || !this.container_.cartService) {
        return null
      }
      
      const cart = await this.container_.cartService.retrieve(cartId, {
        relations: ["customer", "billing_address", "shipping_address"]
      })
      
      return cart
    } catch (error) {
      this.logger_.info(`Could not fetch cart context: ${error}`)
      return null
    }
  }

  async initiatePayment({
    currency_code,
    amount,
    data,
    context,
  }: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    console.log('[PaystackProvider.initiatePayment] Called with:', {
      amount: amount?.toString(),
      currency_code,
      contextKeys: Object.keys(context || {}),
      dataKeys: Object.keys(data || {}),
      sessionId: data?.session_id,
    });

    // Log customer context if available
    if (context?.customer) {
      console.log('[PaystackProvider.initiatePayment] Customer context:', {
        id: context.customer.id,
        email: context.customer.email,
        first_name: context.customer.first_name,
        has_billing_address: !!context.customer.billing_address,
      });
    }

    try {
      const sessionId = data?.session_id as string;
      
      // Get customer email from multiple sources
      let customerEmail = context?.customer?.email || data?.email as string;
      console.log('[PaystackProvider.initiatePayment] Customer email from context:', customerEmail);
      console.log('[PaystackProvider.initiatePayment] Data keys available:', Object.keys(data || {}));
      console.log('[PaystackProvider.initiatePayment] Data contents:', data);

      if (!customerEmail) {
        console.log('[PaystackProvider.initiatePayment] No customer email, returning pending session');
        return {
          id: sessionId || `pending_${Date.now()}`,
          data: {
            session_id: sessionId,
            status: "pending",
            amount: amount?.toString(),
            currency: currency_code,
            public_key: this.config_.public_key,
          },
          status: PaymentSessionStatus.PENDING,
        };
      }

      // Validate currency support
      const normalizedCurrency = currency_code?.toUpperCase() || 'NGN'
      if (!this.isSupportedCurrency(normalizedCurrency)) {
        throw new Error(`Unsupported currency: ${currency_code}. Supported currencies: ${Object.keys(PAYSTACK_CURRENCIES).join(', ')}`)
      }

      // Convert amount to appropriate subunit (kobo, pesewas, cents)
      const amountInSubunit = this.convertToSubunit(amount as number, normalizedCurrency);
      
      console.log('[PaystackProvider.initiatePayment] Initializing Paystack transaction:', {
        email: customerEmail,
        amount: amountInSubunit,
        currency: normalizedCurrency,
        reference: sessionId,
      });

      // Use the official Paystack SDK to initialize transaction
      const response = await this.client_.transaction.initialize({
        email: customerEmail,
        amount: amountInSubunit,
        currency: normalizedCurrency,
        reference: sessionId || `medusa_${Date.now()}`,
        metadata: JSON.stringify({
          session_id: sessionId,
          medusa_payment: true,
        }),
      });

      console.log('[PaystackProvider.initiatePayment] Paystack API response:', {
        status: response.status,
        message: response.message,
        hasData: !!response.data,
      });

      if (!response.status) {
        console.error('[PaystackProvider.initiatePayment] Paystack initialization failed:', response);
        throw new Error(`Paystack initialization failed: ${response.message}`);
      }

      const authorizationUrl = (response.data as any)?.authorization_url;
      
      console.log('[PaystackProvider.initiatePayment] Paystack transaction initialized:', {
        reference: (response.data as any)?.reference,
        access_code: (response.data as any)?.access_code,
        authorization_url: authorizationUrl,
      });

      // If we have an authorization URL, the session requires more (user action)
      const sessionStatus = authorizationUrl 
        ? PaymentSessionStatus.REQUIRES_MORE
        : PaymentSessionStatus.PENDING;

      return {
        id: (response.data as any)?.reference || sessionId || `medusa_${Date.now()}`,
        data: {
          session_id: sessionId,
          paystack_reference: (response.data as any)?.reference,
          access_code: (response.data as any)?.access_code,
          authorization_url: authorizationUrl,
          amount: amountInSubunit,
          currency: normalizedCurrency,
          email: customerEmail,
          public_key: this.config_.public_key,
          // Add timestamp for debugging
          created_at: new Date().toISOString(),
        },
        status: sessionStatus,
      };
    } catch (error) {
      console.error('[PaystackProvider.initiatePayment] Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        response: error.response?.data,
      });
      
      return {
        id: data?.session_id as string || `error_${Date.now()}`,
        data: {
          session_id: data?.session_id,
          error: error.message,
          status: "error",
        },
        status: PaymentSessionStatus.ERROR,
      };
    }
  }

  async authorizePayment(
    paymentSessionData: Record<string, unknown>,
    context: Record<string, unknown> = {}
  ): Promise<any> {
    try {
      const reference = paymentSessionData.reference as string
      
      if (!reference) {
        return this.buildError("Payment reference is required for authorization")
      }

      const verification = await this.verifyTransaction(reference)
      
      if (!verification.status) {
        return this.buildError("Payment verification failed", verification)
      }

      const transaction = verification.data
      
      if (transaction.status !== "success") {
        return this.buildError(`Payment not successful. Status: ${transaction.status}`)
      }

      return {
        status: PaymentSessionStatus.AUTHORIZED,
        data: {
          ...paymentSessionData,
          amount: transaction.amount,
          authorized_amount: transaction.amount,
          transaction_id: transaction.id,
          gateway_response: transaction.gateway_response,
          paid_at: transaction.paid_at,
          authorization: transaction.authorization,
        },
      }
    } catch (error) {
      this.logger_.error(`Failed to authorize Paystack payment: ${error}`)
      return this.buildError("Failed to authorize payment", error)
    }
  }

  async capturePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<any> {
    // Paystack doesn't have separate capture - payment is captured on authorization
    try {
      const reference = paymentSessionData.reference as string
      
      if (!reference) {
        return this.buildError("Payment reference is required for capture")
      }

      const verification = await this.verifyTransaction(reference)
      
      if (!verification.status || verification.data.status !== "success") {
        return this.buildError("Payment capture failed - transaction not successful")
      }

      return {
        ...paymentSessionData,
        captured_amount: verification.data.amount,
        captured_at: verification.data.paid_at || new Date().toISOString(),
      }
    } catch (error) {
      this.logger_.error(`Failed to capture Paystack payment: ${error}`)
      return this.buildError("Failed to capture payment", error)
    }
  }

  async refundPayment(
    input: RefundPaymentInput
  ): Promise<RefundPaymentOutput> {
    try {
      // Cast input to access the properties we expect
      const refundInput = input as any
      const transactionId = refundInput.transaction_id || refundInput.payment_session_data?.transaction_id
      const amount = refundInput.amount
      
      if (!transactionId) {
        return this.buildError("Transaction ID is required for refund")
      }

      // Use the official Paystack SDK to create refund
      const refundCurrency = refundInput.currency || 'NGN'
      const refundAmountSubunit = this.convertToSubunit(Number(amount), refundCurrency)
      
      const response = await this.client_.refund.create({
        transaction: transactionId,
        amount: refundAmountSubunit,
        currency: refundCurrency.toUpperCase(),
        customer_note: 'Refund processed via Medusa',
        merchant_note: 'Medusa payment refund',
      })

      if (!response.status) {
        return this.buildError("Refund failed", response.message)
      }

      return {
        data: {
          refund_id: (response.data as any)?.id,
          refunded_amount: amount,
          refunded_at: new Date().toISOString(),
        }
      } as RefundPaymentOutput
    } catch (error) {
      this.logger_.error(`Failed to refund Paystack payment: ${error}`)
      return this.buildError("Failed to refund payment", error)
    }
  }

  async cancelPayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<any> {
    // Paystack doesn't have explicit cancel - we just mark as cancelled
    return {
      ...paymentSessionData,
      cancelled_at: new Date().toISOString(),
    }
  }

  async retrievePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<any> {
    try {
      const reference = paymentSessionData.reference as string
      
      if (!reference) {
        return this.buildError("Payment reference is required")
      }

      const verification = await this.verifyTransaction(reference)
      
      if (!verification.status) {
        return this.buildError("Failed to retrieve payment", verification)
      }

      const transaction = verification.data

      return {
        ...paymentSessionData,
        amount: transaction.amount,
        transaction_id: transaction.id,
        gateway_response: transaction.gateway_response,
        paid_at: transaction.paid_at,
      }
    } catch (error) {
      this.logger_.error(`Failed to retrieve Paystack payment: ${error}`)
      return this.buildError("Failed to retrieve payment", error)
    }
  }

  async updatePayment({
    data,
    currency_code,
    amount,
    context,
  }: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    console.log('[PaystackProvider.updatePayment] Called with:', {
      amount: amount?.toString(),
      currency_code,
      contextKeys: Object.keys(context || {}),
      dataKeys: Object.keys(data || {}),
    });

    // Log customer context if available
    if (context?.customer) {
      console.log('[PaystackProvider.updatePayment] Customer context:', {
        id: context.customer.id,
        email: context.customer.email,
        first_name: context.customer.first_name,
      });
    }

    try {
      // Get customer email from context (same as initiatePayment)
      const customerEmail = context?.customer?.email;
      console.log('[PaystackProvider.updatePayment] Customer email from context:', customerEmail);

      if (!customerEmail) {
        console.log('[PaystackProvider.updatePayment] No customer email, keeping pending session');
        return {
          data: {
            ...data,
            status: "pending",
            amount: amount?.toString(),
            currency: currency_code,
          },
          status: PaymentSessionStatus.PENDING,
        };
      }

      // Check if we need to re-initialize the session
      const shouldReinitialize = 
        data?.status === "pending" || 
        !data?.authorization_url || 
        data?.payment_completed === true ||
        data?.session_expired === true;

      if (shouldReinitialize) {
        console.log('[PaystackProvider.updatePayment] Re-initializing with Paystack due to:', {
          isPending: data?.status === "pending",
          noAuthUrl: !data?.authorization_url,
          paymentCompleted: data?.payment_completed,
          sessionExpired: data?.session_expired,
        });
        
        // Create a fresh session by removing old session data
        const freshData = {
          session_id: data?.session_id,
          email: customerEmail,
        };
        
        return this.initiatePayment({
          currency_code,
          amount,
          data: freshData,
          context,
        });
      }

      // Otherwise, just return the existing data (no update needed for Paystack)
      console.log('[PaystackProvider.updatePayment] Returning existing session data');
      console.log('[PaystackProvider.updatePayment] Current data status:', data?.status);
      console.log('[PaystackProvider.updatePayment] Current data keys:', Object.keys(data || {}));
      
      // Ensure we always have a valid status
      const currentStatus = data?.status as PaymentSessionStatus;
      const validStatus = currentStatus && Object.values(PaymentSessionStatus).includes(currentStatus) 
        ? currentStatus 
        : PaymentSessionStatus.PENDING;
      
      console.log('[PaystackProvider.updatePayment] Using status:', validStatus);
      
      return {
        data: {
          ...data,
          updated_at: new Date().toISOString(),
        },
        status: validStatus,
      };
    } catch (error) {
      console.error('[PaystackProvider.updatePayment] Error:', error);
      
      return {
        data: {
          ...data,
          error: error.message,
          status: "error",
        },
        status: PaymentSessionStatus.ERROR,
      };
    }
  }

  async deletePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<any> {
    // Paystack doesn't support deleting transactions
    // We just return the session data as is
    return paymentSessionData
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    try {
      const paymentSessionData = input as any
      const reference = paymentSessionData.data?.reference || paymentSessionData.reference
      
      if (!reference) {
        return { status: PaymentSessionStatus.ERROR }
      }

      const verification = await this.verifyTransaction(reference)
      
      if (!verification.status) {
        return { status: PaymentSessionStatus.ERROR }
      }

      const transaction = verification.data

      let status: PaymentSessionStatus
      switch (transaction.status) {
        case "success":
          status = PaymentSessionStatus.AUTHORIZED
          break
        case "failed":
          status = PaymentSessionStatus.ERROR
          break
        case "abandoned":
          status = PaymentSessionStatus.CANCELED
          break
        default:
          status = PaymentSessionStatus.PENDING
      }

      return { status }
    } catch (error) {
      this.logger_.error(`Failed to get Paystack payment status: ${error}`)
      return { status: PaymentSessionStatus.ERROR }
    }
  }

  async getWebhookActionAndData(
    data: {
      data: Record<string, unknown>
      rawData: string | Buffer
      headers: Record<string, unknown>
    }
  ): Promise<any> {
    try {
      // Parse the webhook data
      const webhookData = typeof data.rawData === 'string' 
        ? JSON.parse(data.rawData) 
        : JSON.parse(data.rawData.toString())
      
      const { event, data: eventData } = webhookData

      switch (event) {
        case "charge.success":
          return {
            action: "authorized",
            data: {
              session_id: eventData.reference,
              amount: eventData.amount,
            },
          }
        case "charge.failed":
          return {
            action: "failed",
            data: {
              session_id: eventData.reference,
              amount: eventData.amount,
            },
          }
        default:
          return {
            action: "not_supported",
          }
      }
    } catch (error) {
      this.logger_.error(`Failed to process Paystack webhook: ${error}`)
      return {
        action: "failed",
      }
    }
  }

  private async verifyTransaction(reference: string): Promise<PaystackVerificationResponse> {
    // Use the official Paystack SDK to verify transaction
    const response = await this.client_.transaction.verify({ reference })
    return response as PaystackVerificationResponse
  }

  private buildError(
    message: string,
    error?: any
  ): any {
    return {
      error: message,
      code: "PAYSTACK_ERROR",
      detail: error,
    }
  }
}

export default PaystackProvider
