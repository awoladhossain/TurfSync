export interface StripeWebhookPayload {
  signature: string;
  rawBody: Buffer;
}
