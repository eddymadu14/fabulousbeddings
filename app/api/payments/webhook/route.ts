
import crypto from 'crypto'

import {
  NextResponse,
} from 'next/server'

import {
  processSuccessfulPayment,
} from '@/lib/payments/process-successful-payment'

function isValidPaystackSignature(
  payload: string,
  signature: string,
) {
  const secret =
    process.env.PAYSTACK_SECRET_KEY

  if (!secret) {
    throw new Error(
      'PAYSTACK_SECRET_KEY is not configured.',
    )
  }

  const hash =
    crypto
      .createHmac(
        'sha512',
        secret,
      )
      .update(payload)
      .digest('hex')

  /*
   * Avoid timing attacks.
   */

  const expected =
    Buffer.from(hash)

  const received =
    Buffer.from(signature)

  if (
    expected.length !==
    received.length
  ) {
    return false
  }

  return crypto.timingSafeEqual(
    expected,
    received,
  )
}

export async function POST(
  request: Request,
) {
  try {
    /*
     * ----------------------------------------------------------
     * Read raw body
     * ----------------------------------------------------------
     *
     * IMPORTANT:
     * We verify the exact raw payload.
     */

    const payload =
      await request.text()

    const signature =
      request.headers.get(
        'x-paystack-signature',
      )

    if (!signature) {
      return new NextResponse(
        'Unauthorized',
        {
          status: 401,
        },
      )
    }

    /*
     * ----------------------------------------------------------
     * Verify Paystack signature
     * ----------------------------------------------------------
     */

    const valid =
      isValidPaystackSignature(
        payload,
        signature,
      )

    if (!valid) {
      return new NextResponse(
        'Unauthorized',
        {
          status: 401,
        },
      )
    }

    /*
     * ----------------------------------------------------------
     * Parse event
     * ----------------------------------------------------------
     */

    const event =
      JSON.parse(payload) as {
        event?: string

        data?: {
          reference?: string
        }
      }

    /*
     * ----------------------------------------------------------
     * We only process successful charges
     * ----------------------------------------------------------
     */

    if (
      event.event !==
      'charge.success'
    ) {
      return NextResponse.json({
        received: true,
        processed: false,
      })
    }

    const reference =
      event.data?.reference

    if (!reference) {
      return NextResponse.json(
        {
          error:
            'Payment reference missing.',
        },
        {
          status: 400,
        },
      )
    }

    /*
     * ----------------------------------------------------------
     * Process
     * ----------------------------------------------------------
     *
     * processSuccessfulPayment() independently
     * verifies the transaction against Paystack.
     */

    const result =
      await processSuccessfulPayment(
        reference,
      )

    return NextResponse.json({
      received: true,

      processed: true,

      alreadyProcessed:
        result.alreadyProcessed,

      orderId:
        result.order.id,
    })
  } catch (error) {
    console.error(
      'Paystack webhook failed:',
      error,
    )

    return NextResponse.json(
      {
        error:
          'Webhook processing failed.',
      },
      {
        status: 500,
      },
    )
  }
}