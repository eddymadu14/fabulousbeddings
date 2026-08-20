

import 'server-only'

const PAYSTACK_API_URL =
  'https://api.paystack.co'

type InitializePaystackTransactionParams = {
  email: string
  amount: number
  reference: string
  callbackUrl: string
  metadata?: Record<string, unknown>
}

type PaystackInitializeResponse = {
  status: boolean
  message: string
  data?: {
    authorization_url: string
    access_code: string
    reference: string
  }
}

export async function initializePaystackTransaction({
  email,
  amount,
  reference,
  callbackUrl,
  metadata,
}: InitializePaystackTransactionParams) {
  const secretKey =
    process.env.PAYSTACK_SECRET_KEY

  if (!secretKey) {
    throw new Error(
      'PAYSTACK_SECRET_KEY is not configured.',
    )
  }

  const amountInKobo =
    Math.round(amount * 100)

  if (
    !Number.isInteger(amountInKobo) ||
    amountInKobo <= 0
  ) {
    throw new Error(
      'Invalid payment amount.',
    )
  }

  const response =
    await fetch(
      `${PAYSTACK_API_URL}/transaction/initialize`,
      {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${secretKey}`,

          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          email,
          amount: amountInKobo,
          currency: 'NGN',
          reference,
          callback_url: callbackUrl,

          channels: [
            'card',
            'bank',
            'bank_transfer',
          ],

          metadata,
        }),
      },
    )

  const data =
    (await response.json()) as PaystackInitializeResponse

  if (
    !response.ok ||
    !data.status ||
    !data.data
  ) {
    throw new Error(
      data.message ||
        'Unable to initialize Paystack transaction.',
    )
  }

  return {
    authorization_url:
      data.data.authorization_url,

    access_code:
      data.data.access_code,

    reference:
      data.data.reference,
  }
}


type  PaystackVerifyTransactionResponse= {
  status: boolean
  message: string
  data?: {
    id: number
    domain: string
    status: string
    reference: string
    amount: number
    currency: string

    customer: {
      email: string
    }

    paid_at: string | null
    channel: string | null
  }
}

export async function verifyPaystackTransaction(
  reference: string,
) {
  const secretKey =
    process.env.PAYSTACK_SECRET_KEY

  if (!secretKey) {
    throw new Error(
      'PAYSTACK_SECRET_KEY is not configured.',
    )
  }

  const response =
    await fetch(
      `${PAYSTACK_API_URL}/transaction/verify/${encodeURIComponent(
        reference,
      )}`,
      {
        method: 'GET',

        headers: {
          Authorization:
            `Bearer ${secretKey}`,

          'Content-Type':
            'application/json',
        },

        cache: 'no-store',
      },
    )

  const data =
    (await response.json()) as PaystackVerifyTransactionResponse

  if (
    !response.ok ||
    !data.status ||
    !data.data
  ) {
    throw new Error(
      data.message ||
        'Unable to verify Paystack transaction.',
    )
  }

  return data.data
}

