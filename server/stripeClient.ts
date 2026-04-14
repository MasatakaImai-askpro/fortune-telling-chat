import Stripe from 'stripe';

function getSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY が設定されていません。環境変数に設定してください。');
  }
  return key;
}

function getPublishableKey(): string {
  return process.env.STRIPE_PUBLISHABLE_KEY ?? '';
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const secretKey = getSecretKey();
  return new Stripe(secretKey, { apiVersion: '2025-08-27.basil' as any });
}

export async function getStripePublishableKey(): Promise<string> {
  return getPublishableKey();
}

export async function getStripeSecretKey(): Promise<string> {
  return getSecretKey();
}
