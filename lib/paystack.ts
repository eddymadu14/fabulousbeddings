
import 'server-only'

const PAYSTACK_API_URL =
  'https://api.paystack.co'

type InitializePaystackParams = {
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

type PaystackVerifyResponse = {
  status: boolean
  message: string
  data?: {
    id: number
    status: string
    reference: string
    amount: number
    currency: string
    paid_at: string | null
    channel: string | null
    customer?: {
      email: string
    }
  }
}

/* ============================================================
   INITIALIZE TRANSACTION
============================================================ */

export async function initializePaystackTransaction({
  email,
  amount,
  reference,
  callbackUrl,
  metadata,
}: InitializePaystackParams) {
  const secretKey =
    process.env.PAYSTACK_SECRET_KEY

  if (!secretKey) {
    throw new Error(
      'PAYSTACK_SECRET_KEY is not configured.',
    )
  }

  /*
   * Database amounts are stored in Naira.
   * Paystack expects kobo.
   */
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

          amount:
            amountInKobo,

          currency:
            'NGN',

          reference,

          callback_url:
            callbackUrl,

          channels: [
            'card',
            'bank',
            'bank_transfer',
          ],

          metadata:
            JSON.stringify(
              metadata ?? {},
            ),
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
    console.error(
      'Paystack initialization failed:',
      data,
    )

    throw new Error(
      data.message ||
        'Unable to initialize payment.',
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

/* ============================================================
   VERIFY TRANSACTION
============================================================ */

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
        },

        cache: 'no-store',
      },
    )

  const data =
    (await response.json()) as PaystackVerifyResponse

  if (
    !response.ok ||
    !data.status ||
    !data.data
  ) {
    console.error(
      'Paystack verification failed:',
      data,
    )

    throw new Error(
      data.message ||
        'Unable to verify payment.',
    )
  }

  return data.data
}