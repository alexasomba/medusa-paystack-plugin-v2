import {
  AbstractPaymentProvider,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import { Logger } from "@medusajs/framework/types"
import axios from "axios"

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

export class PaystackProvider extends AbstractPaymentProvider<PaystackConfig> {
  static identifier = "paystack"
  protected readonly logger_: Logger
  protected readonly config_: PaystackConfig
  protected readonly client_: any

  constructor(
    container: any,
    config: PaystackConfig
  ) {
    super(container, config)
    this.config_ = config
    this.logger_ = container.logger

    if (!config.secret_key || !config.public_key) {
      throw new Error("Paystack secret_key and public_key are required")
    }

    this.client_ = axios.create({
      baseURL: "https://api.paystack.co",
      headers: {
        Authorization: `Bearer ${config.secret_key}`,
        "Content-Type": "application/json",
      },
    })
  }

  async initiatePayment(
    input: any
  ): Promise<any> {
    try {
      const { amount, currency_code, email, context } = input
      
      // Convert amount from minor unit (cents) to major unit (naira/dollars)
      const amountInMajorUnit = Number(amount) / 100

      const paymentData: PaystackPaymentData = {
        email: email || context.billing_address?.email || context.customer?.email,
        amount: amountInMajorUnit,
        currency: currency_code?.toUpperCase() || "NGN",
        reference: `medusa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        callback_url: context.callback_url,
        metadata: {
          customer_id: context.customer?.id,
          cart_id: context.cart_id,
          order_id: context.order_id,
          ...context.metadata,
        },
      }

      this.logger_.info(`Initiating Paystack payment for ${paymentData.email}`)

      const response = await this.client_.post(
        "/transaction/initialize",
        paymentData
      )

      if (!response.data.status) {
        return this.buildError("Payment initiation failed", response.data)
      }

      return {
        data: {
          authorization_url: response.data.data.authorization_url,
          access_code: response.data.data.access_code,
          reference: response.data.data.reference,
          public_key: this.config_.public_key,
        },
      }
    } catch (error) {
      this.logger_.error(`Failed to initiate Paystack payment: ${error}`)
      return this.buildError("Failed to initiate payment", error)
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
    paymentSessionData: Record<string, unknown>,
    refundAmount: number
  ): Promise<any> {
    try {
      const transactionId = paymentSessionData.transaction_id as string
      
      if (!transactionId) {
        return this.buildError("Transaction ID is required for refund")
      }

      const refundData = {
        transaction: transactionId,
        amount: Number(refundAmount) / 100, // Convert from minor unit
      }

      const response = await this.client_.post("/refund", refundData)

      if (!response.data.status) {
        return this.buildError("Refund failed", response.data)
      }

      return {
        ...paymentSessionData,
        refund_id: response.data.data.id,
        refunded_amount: refundAmount,
        refunded_at: new Date().toISOString(),
      }
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

  async updatePayment(
    input: any
  ): Promise<any> {
    // For Paystack, we typically don't update existing transactions
    // Instead, we might need to create a new transaction
    return this.initiatePayment(input)
  }

  async deletePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<any> {
    // Paystack doesn't support deleting transactions
    // We just return the session data as is
    return paymentSessionData
  }

  async getPaymentStatus(
    paymentSessionData: Record<string, unknown>
  ): Promise<PaymentSessionStatus> {
    try {
      const reference = paymentSessionData.reference as string
      
      if (!reference) {
        return PaymentSessionStatus.ERROR
      }

      const verification = await this.verifyTransaction(reference)
      
      if (!verification.status) {
        return PaymentSessionStatus.ERROR
      }

      const transaction = verification.data

      switch (transaction.status) {
        case "success":
          return PaymentSessionStatus.AUTHORIZED
        case "failed":
          return PaymentSessionStatus.ERROR
        case "abandoned":
          return PaymentSessionStatus.CANCELED
        default:
          return PaymentSessionStatus.PENDING
      }
    } catch (error) {
      this.logger_.error(`Failed to get Paystack payment status: ${error}`)
      return PaymentSessionStatus.ERROR
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
    const response = await this.client_.get(
      `/transaction/verify/${reference}`
    )
    return response.data
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
