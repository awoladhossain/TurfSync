// webhook raw body need to verify not the dto
//  stripe signature verify need raw bytes

export interface StripeWebhookPayload {
  signature: string;
  rawBody: Buffer;
}
