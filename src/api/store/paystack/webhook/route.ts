import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import crypto from "crypto"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  res.json({
    message: "Paystack plugin is running",
    timestamp: new Date().toISOString(),
  })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  
  try {
    // Verify Paystack webhook signature
    const secret = process.env.PAYSTACK_WEBHOOK_SECRET
    if (secret) {
      const hash = crypto
        .createHmac("sha512", secret)
        .update(JSON.stringify(req.body))
        .digest("hex")
      
      const signature = req.headers["x-paystack-signature"] as string
      
      if (hash !== signature) {
        logger.error("Invalid Paystack webhook signature")
        return res.status(400).json({ error: "Invalid signature" })
      }
    }

    const webhookBody = req.body as { event: string; data: any }
    const { event, data } = webhookBody

    logger.info(`Received Paystack webhook: ${event} - Reference: ${data?.reference}`)

    // Process the webhook based on event type
    switch (event) {
      case "charge.success":
        logger.info(`Payment successful - Reference: ${data.reference}, Amount: ${data.amount}, Email: ${data.customer.email}`)
        break
        
      case "charge.failed":
        logger.info(`Payment failed - Reference: ${data.reference}, Amount: ${data.amount}, Email: ${data.customer.email}`)
        break
        
      case "transfer.success":
        logger.info(`Transfer successful - Reference: ${data.reference}, Amount: ${data.amount}`)
        break
        
      case "transfer.failed":
        logger.info(`Transfer failed - Reference: ${data.reference}, Amount: ${data.amount}`)
        break
        
      default:
        logger.info(`Unhandled Paystack webhook event: ${event}`)
    }

    res.status(200).json({ message: "Webhook processed successfully" })
  } catch (error) {
    logger.error(`Error processing Paystack webhook: ${error}`)
    res.status(500).json({ error: "Internal server error" })
  }
}
