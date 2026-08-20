
lib/payments/process-successful-payment.ts
Whole file:
import 'server-only'

import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'

import {
  cartItems,
  carts,
  orderItems,
  orders,
} from '@/lib/db/schema'

import {
  sendCustomerOrderEmail,
  sendOwnerOrderEmail,
} from '@/lib/email/send-order-email'

import {
  sendTelegramOrderAlert,
} from '@/lib/notifications/telegram'

import {
  verifyPaystackTransaction,
} from '@/lib/paystack'

export async function processSuccessfulPayment(
  reference: string,
) {
  /*
   * ----------------------------------------------------------
   * Find order
   * ----------------------------------------------------------
   */

  const orderRows =
    await db
      .select()
      .from(orders)
      .where(
        eq(
          orders.paymentReference,
          reference,
        ),
      )
      .limit(1)

  const order =
    orderRows[0]

  if (!order) {
    throw new Error(
      'Order associated with this payment was not found.',
    )
  }

  /*
   * ----------------------------------------------------------
   * Idempotency
   * ----------------------------------------------------------
   *
   * If Paystack callback and webhook both arrive,
   * don't process the same order twice.
   */

  if (
    order.paymentStatus ===
    'paid'
  ) {
    return {
      order,
      alreadyProcessed:
        true,
    }
  }

  /*
   * ----------------------------------------------------------
   * Verify directly with Paystack
   * ----------------------------------------------------------
   *
   * Never trust the browser or webhook payload alone.
   */

  const transaction =
    await verifyPaystackTransaction(
      reference,
    )

  /*
   * ----------------------------------------------------------
   * Verify transaction status
   * ----------------------------------------------------------
   */

  if (
    transaction.status !==
    'success'
  ) {
    throw new Error(
      `Payment is not successful. Paystack status: ${transaction.status}`,
    )
  }

  /*
   * ----------------------------------------------------------
   * Verify reference
   * ----------------------------------------------------------
   */

  if (
    transaction.reference !==
    order.paymentReference
  ) {
    throw new Error(
      'Payment reference does not match the order.',
    )
  }

  /*
   * ----------------------------------------------------------
   * Verify currency
   * ----------------------------------------------------------
   */

  if (
    transaction.currency !==
    'NGN'
  ) {
    throw new Error(
      'Payment currency does not match the order currency.',
    )
  }

  /*
   * ----------------------------------------------------------
   * Verify amount
   * ----------------------------------------------------------
   *
   * Order total is Naira.
   * Paystack amount is kobo.
   */

  const expectedAmount =
    Math.round(
      order.total * 100,
    )

  if (
    transaction.amount !==
    expectedAmount
  ) {
    throw new Error(
      'Payment amount does not match the order total.',
    )
  }

  /*
   * ----------------------------------------------------------
   * Load order items
   * ----------------------------------------------------------
   */

  const createdItems =
    await db
      .select()
      .from(orderItems)
      .where(
        eq(
          orderItems.orderId,
          order.id,
        ),
      )

  /*
   * ----------------------------------------------------------
   * Mark order paid + clear cart
   * ----------------------------------------------------------
   */

  const updatedOrder =
    await db.transaction(
      async (tx) => {
        /*
         * Re-check payment status inside
         * the transaction.
         *
         * This protects against callback +
         * webhook arriving nearly together.
         */

        const currentRows =
          await tx
            .select()
            .from(orders)
            .where(
              eq(
                orders.id,
                order.id,
              ),
            )
            .limit(1)

        const currentOrder =
          currentRows[0]

        if (!currentOrder) {
          throw new Error(
            'Order no longer exists.',
          )
        }

        if (
          currentOrder.paymentStatus ===
          'paid'
        ) {
          return currentOrder
        }

        /*
         * Mark payment successful.
         *
         * Keep orderStatus pending because
         * payment success does not mean the
         * order has been delivered/fulfilled.
         */

        const [
          paidOrder,
        ] = await tx
          .update(orders)
          .set({
            paymentStatus:
              'paid',

            orderStatus:
              'pending',

            updatedAt:
              new Date(),
          })
          .where(
            eq(
              orders.id,
              order.id,
            ),
          )
          .returning()

        /*
         * ------------------------------------------------------
         * Clear only this order owner's cart
         * ------------------------------------------------------
         */

        if (
          paidOrder.userId
        ) {
          const userCarts =
            await tx
              .select({
                id: carts.id,
              })
              .from(carts)
              .where(
                eq(
                  carts.userId,
                  paidOrder.userId,
                ),
              )

          for (
            const cart of userCarts
          ) {
            await tx
              .delete(cartItems)
              .where(
                eq(
                  cartItems.cartId,
                  cart.id,
                ),
              )

            await tx
              .update(carts)
              .set({
                updatedAt:
                  new Date(),
              })
              .where(
                eq(
                  carts.id,
                  cart.id,
                ),
              )
          }
        } else if (
          paidOrder.visitorId
        ) {
          const visitorCarts =
            await tx
              .select({
                id: carts.id,
              })
              .from(carts)
              .where(
                eq(
                  carts.visitorId,
                  paidOrder.visitorId,
                ),
              )

          for (
            const cart of visitorCarts
          ) {
            await tx
              .delete(cartItems)
              .where(
                eq(
                  cartItems.cartId,
                  cart.id,
                ),
              )

            await tx
              .update(carts)
              .set({
                updatedAt:
                  new Date(),
              })
              .where(
                eq(
                  carts.id,
                  cart.id,
                ),
              )
          }
        }

        return paidOrder
      },
    )

  /*
   * ----------------------------------------------------------
   * Email / notification payload
   * ----------------------------------------------------------
   */

  const emailData = {
    id:
      updatedOrder.id,

    customerName:
      updatedOrder.customerName,

    customerEmail:
      updatedOrder.customerEmail,

    customerPhone:
      updatedOrder.customerPhone,

    shippingAddress:
      updatedOrder.shippingAddress,

    shippingCity:
      updatedOrder.shippingCity,

    shippingState:
      updatedOrder.shippingState,

    subtotal:
      updatedOrder.subtotal,

    deliveryFee:
      updatedOrder.deliveryFee,

    total:
      updatedOrder.total,

    deliveryMethod:
      updatedOrder.deliveryMethod,

    paymentMethod:
      updatedOrder.paymentMethod,

    items:
      createdItems.map(
        (item) => ({
          productName:
            item.productName,

          variantName:
            item.variantName,

          unitPrice:
            item.unitPrice,

          quantity:
            item.quantity,
        }),
      ),
  }

  /*
   * ----------------------------------------------------------
   * Customer receipt / confirmation
   * ----------------------------------------------------------
   */

  let customerEmailSent =
    false

  try {
    await sendCustomerOrderEmail(
      emailData,
    )

    customerEmailSent =
      true
  } catch (error) {
    console.error(
      'Customer payment email failed:',
      error,
    )
  }

  /*
   * ----------------------------------------------------------
   * Owner notification
   * ----------------------------------------------------------
   */

  let ownerEmailSent =
    false

  try {
    await sendOwnerOrderEmail(
      emailData,
    )

    ownerEmailSent =
      true
  } catch (error) {
    console.error(
      'Owner payment email failed:',
      error,
    )
  }

  /*
   * ----------------------------------------------------------
   * Telegram
   * ----------------------------------------------------------
   */

  let telegramSent =
    false

  try {
    await sendTelegramOrderAlert(
      emailData,
      {
        paymentStatus:
          'paid',
      },
    )

    telegramSent =
      true
  } catch (error) {
    console.error(
      'Telegram payment alert failed:',
      error,
    )
  }

  return {
    order:
      updatedOrder,

    alreadyProcessed:
      false,

    notifications: {
      customerEmailSent,
      ownerEmailSent,
      telegramSent,
    },
  }
}
This reuses your existing Brevo customer/owner email functions and Telegram notification system instead of creating a second notification pipeline. �
GitHub +1
3. app/api/payments/verify/route.ts
Create:
app/api/payments/verify/route.ts
Whole file:
import {
  cookies,
} from 'next/headers'

import {
  headers,
} from 'next/headers'

import {
  NextResponse,
} from 'next/server'

import {
  and,
  eq,
} from 'drizzle-orm'

import {
  auth,
} from '@/lib/auth'

import {
  db,
} from '@/lib/db'

import {
  orders,
} from '@/lib/db/schema'

import {
  getOrCreateVisitor,
  VISITOR_COOKIE,
} from '@/lib/visitor'

import {
  processSuccessfulPayment,
} from '@/lib/payments/process-successful-payment'

export async function POST(
  request: Request,
) {
  try {
    /*
     * ----------------------------------------------------------
     * Get reference
     * ----------------------------------------------------------
     */

    const url =
      new URL(
        request.url,
      )

    const reference =
      url.searchParams.get(
        'reference',
      )

    if (!reference) {
      return NextResponse.json(
        {
          error:
            'Payment reference is required.',
        },
        {
          status: 400,
        },
      )
    }

    /*
     * ----------------------------------------------------------
     * Identify current shopper
     * ----------------------------------------------------------
     */

    const session =
      await auth.api.getSession({
        headers:
          await headers(),
      })

    let userId:
      | string
      | null = null

    let visitorId:
      | string
      | null = null

    if (
      session?.user
    ) {
      userId =
        session.user.id
    } else {
      const cookieStore =
        await cookies()

      const existingVisitorId =
        cookieStore.get(
          VISITOR_COOKIE,
        )?.value

      const visitor =
        await getOrCreateVisitor(
          existingVisitorId,
        )

      visitorId =
        visitor.id
    }

    /*
     * ----------------------------------------------------------
     * Confirm this order belongs to this shopper
     * ----------------------------------------------------------
     */

    const conditions = [
      eq(
        orders.paymentReference,
        reference,
      ),
    ]

    if (userId) {
      conditions.push(
        eq(
          orders.userId,
          userId,
        ),
      )
    } else if (
      visitorId
    ) {
      conditions.push(
        eq(
          orders.visitorId,
          visitorId,
        ),
      )
    }

    const rows =
      await db
        .select({
          id: orders.id,
          paymentStatus:
            orders.paymentStatus,
        })
        .from(orders)
        .where(
          and(
            ...conditions,
          ),
        )
        .limit(1)

    if (
      !rows[0]
    ) {
      return NextResponse.json(
        {
          error:
            'Payment order could not be found.',
        },
        {
          status: 404,
        },
      )
    }

    /*
     * ----------------------------------------------------------
     * Process payment
     * ----------------------------------------------------------
     */

    const result =
      await processSuccessfulPayment(
        reference,
      )

    return NextResponse.json({
      success: true,

      order: {
        id:
          result.order.id,

        paymentStatus:
          result.order.paymentStatus,

        orderStatus:
          result.order.orderStatus,
      },

      alreadyProcessed:
        result.alreadyProcessed,
    })
  } catch (error) {
    console.error(
      'Payment verification failed:',
      error,
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to verify payment.',
      },
      {
        status: 500,
      },
    )
  }
}
'use client'

import {
  Suspense,
  useEffect,
  useState,
} from 'react'

import {
  useSearchParams,
} from 'next/navigation'

function PaymentCallbackContent() {
  const searchParams =
    useSearchParams()

  const reference =
    searchParams.get(
      'reference',
    )

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null)

  useEffect(() => {
    if (!reference) {
      setError(
        'Payment reference is missing.',
      )

      return
    }

    let cancelled =
      false

    async function verifyPayment() {
      try {
        const response =
          await fetch(
            `/api/payments/verify?reference=${encodeURIComponent(
              reference,
            )}`,
            {
              method:
                'POST',

              credentials:
                'include',
            },
          )

        const data =
          await response.json()

        if (
          !response.ok
        ) {
          throw new Error(
            data.error ||
              'Payment verification failed.',
          )
        }

        if (
          cancelled
        ) {
          return
        }

        window.location.href =
          `/thank-you?order=${encodeURIComponent(
            data.order.id,
          )}`
      } catch (error) {
        if (
          cancelled
        ) {
          return
        }

        setError(
          error instanceof Error
            ? error.message
            : 'Payment verification failed.',
        )
      }
    }

    verifyPayment()

    return () => {
      cancelled = true
    }
  }, [reference])

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="font-serif text-4xl">
            Payment could not be confirmed
          </h1>

          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            {error}
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="text-center">
        <div className="mx-auto mb-6 size-10 animate-spin rounded-full border-2 border-muted border-t-primary" />

        <h1 className="font-serif text-3xl">
          Confirming your payment...
        </h1>

        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          Please wait while we confirm your transaction.
        </p>
      </div>
    </main>
  )
}

export default function PaymentCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-6">
          <div className="text-center">
            <div className="mx-auto mb-6 size-10 animate-spin rounded-full border-2 border-muted border-t-primary" />

            <h1 className="font-serif text-3xl">
              Confirming your payment...
            </h1>
          </div>
        </main>
      }
    >
      <PaymentCallbackContent />
    </Suspense>
  )
}
4. app/payment/callback/page.tsx
Because this uses useSearchParams(), we're wrapping it in Suspense. That avoids the exact prerender error you encountered earlier.
Create:
app/payment/callback/page.tsx
Whole file:
TypeScript
5. app/api/payments/webhook/route.ts
This is Phase 9.
Create:
app/api/payments/webhook/route.ts
Whole file:
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
Paystack sends the x-paystack-signature HMAC-SHA512 signature and recommends verifying it before processing the event. charge.success is the event we care about here. �
Paystack
6. Modify lib/notifications/telegram.ts
Your existing Telegram function currently hard-codes:
⚠️ Pay on Delivery
so card/bank orders would produce a misleading alert. �
GitHub
Replace the whole file with:
import 'server-only'

type TelegramOrder = {
  id: number

  customerName: string
  customerEmail: string

  customerPhone:
    | string
    | null

  shippingAddress: string
  shippingCity: string
  shippingState: string

  subtotal: number
  deliveryFee: number
  total: number

  deliveryMethod: string
  paymentMethod: string
}

type TelegramPaymentOptions = {
  paymentStatus?:
    | 'pending'
    | 'paid'
    | 'failed'
}

function money(
  value: number,
) {
  return new Intl.NumberFormat(
    'en-NG',
    {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    },
  ).format(value)
}

export async function sendTelegramOrderAlert(
  order: TelegramOrder,
  options: TelegramPaymentOptions = {},
) {
  const token =
    process.env
      .TELEGRAM_BOT_TOKEN

  const chatId =
    process.env
      .TELEGRAM_CHAT_ID

  if (
    !token ||
    !chatId
  ) {
    throw new Error(
      'Telegram environment variables are not configured.',
    )
  }

  const paymentStatus =
    options.paymentStatus ??
    'pending'

  const paymentLabel =
    paymentStatus === 'paid'
      ? 'PAID'
      : paymentStatus ===
          'failed'
        ? 'FAILED'
        : 'PENDING'

  const paymentWarning =
    paymentStatus === 'paid'
      ? '✅ Payment confirmed'
      : order.paymentMethod ===
          'pay_on_delivery'
        ? '⚠️ Pay on Delivery'
        : '⏳ Payment pending'

  const message = `
🛍️ *ORDER*

*Order:* #${order.id}

*Customer*
${order.customerName}

📧 ${order.customerEmail}

📞 ${order.customerPhone ?? 'Not provided'}

*Delivery*
${order.shippingAddress}
${order.shippingCity}, ${order.shippingState}

🚚 ${order.deliveryMethod}

💳 ${order.paymentMethod}

*Payment:* ${paymentLabel}

${paymentWarning}

*Subtotal:* ${money(order.subtotal)}

*Delivery:* ${money(order.deliveryFee)}

*TOTAL:* ${money(order.total)}
`.trim()

  const response =
    await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          chat_id:
            chatId,

          text:
            message,

          parse_mode:
            'Markdown',
        }),
      },
    )

  const data =
    await response.json()

  if (
    !response.ok ||
    !data.ok
  ) {
    throw new Error(
      data.description ||
        'Telegram notification failed.',
    )
  }

  return data
}
Your existing POD route will continue to work because the second argument is optional. So this:
sendTelegramOrderAlert(
  emailData,
)
still works.
For successful Paystack payment we're explicitly using:
sendTelegramOrderAlert(
  emailData,
  {
    paymentStatus: 'paid',
  },
)
7. Your existing initialize/route.ts
Do not replace the whole 746-line file.
Your latest implementation is already doing the correct Phase 7 flow:
load cart
↓
validate products
↓
validate variants
↓
calculate subtotal
↓
calculate delivery
↓
create pending order
↓
create order_items
↓
DO NOT clear cart
↓
initialize Paystack
↓
return authorization URL
That's exactly what we want. �
GitHub
One cleanup only:
At the top you currently import:
cartItems
but that route doesn't actually need it.
Change:
import {
  cartItems,
  carts,
  orderItems,
  orders,
  productVariants,
  products,
} from '@/lib/db/schema'
to:
import {
  carts,
  orderItems,
  orders,
  productVariants,
  products,
} from '@/lib/db/schema'
8. One important issue with your current schema
Your current orders.paymentReference is nullable and not unique. �
GitHub
I recommend changing:
paymentReference: text(
  'paymentReference',
),
to:
paymentReference: text(
  'paymentReference',
).unique(),
Then generate your Drizzle migration.
Your generated reference is already sufficiently unique:
const paymentReference =
  `FB-${Date.now()}-${crypto.randomUUID()}`
from your current initialize route. �
GitHub
The database uniqueness constraint simply adds another layer of protection.
9. Environment variables
You need:
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxx

PAYSTACK_CALLBACK_URL=http://localhost:3000/payment/callback
Production:
PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxx

PAYSTACK_CALLBACK_URL=https://yourdomain.com/payment/callback
Never expose the secret key as NEXT_PUBLIC_*. Paystack specifically requires secret keys to remain server-side. �
Paystack
10. Paystack dashboard webhook
Once deployed, configure:
https://yourdomain.com/api/payments/webhook
in Paystack's webhook settings.
localhost cannot receive Paystack webhooks directly, so test callbacks locally first; test the actual webhook on your deployed URL or through a tunnel. Paystack explicitly notes that webhook URLs must be publicly accessible. �
Paystack
What happens now
Card/bank checkout
Checkout
   ↓
POST /api/payments/initialize
   ↓
Order created:
paymentStatus = pending
orderStatus = pending
   ↓
Paystack authorization
   ↓
Customer pays
   ↓
Paystack callback
   ↓
/payment/callback
   ↓
POST /api/payments/verify
   ↓
Paystack verification
   ↓
amount/reference/currency checked
   ↓
paymentStatus = paid
   ↓
cart cleared
   ↓
customer email
owner email
Telegram
   ↓
/thank-you
Webhook
Independently:
Paystack
   ↓
POST /api/payments/webhook
   ↓
verify HMAC signature
   ↓
charge.success
   ↓
verify transaction with Paystack
   ↓
same processSuccessfulPayment()
   ↓
paymentStatus = paid
The callback and webhook therefore converge on one payment processor, rather than maintaining two separate implementations.
And your POD flow remains separate
Your existing /api/orders already creates the order, order items, clears the cart, then sends the customer email, owner email, and Telegram alert. �
GitHub
So we're now cleanly at:
Phase 7: initialize → pending order
Phase 8: verify → paid order
Phase 9: webhook → independently confirms payment
Run this immediately after adding the files:
pnpm tsc --noEmit
Then:
pnpm run build
**Do not test a real Paystack payment until both pass.**


















This matches Paystack's actual initialize and verify APIs. Paystack expects the amount in the currency subunit and returns the authorization URL/reference from initialization. �
Paystack
Phase 7 — your existing initialize route
Do not create another initialize route.
You already have:
app/api/payments/initialize/route.ts
and I confirmed it exists in the current commit. �
GitHub
However, there is one thing I want you to change.
At the top you currently import:
import {
  cartItems,
  carts,
  orderItems,
  orders,
  productVariants,
  products,
} from '@/lib/db/schema'
You aren't using cartItems.
Remove it:
import {
  carts,
  orderItems,
  orders,
  productVariants,
  products,
} from '@/lib/db/schema'
Everything else can remain for now.
Your existing route correctly creates:
paymentStatus = pending
orderStatus = pending
paymentMethod = card_bank
paymentReference = generated reference
and intentionally does not clear the cart. That's correct. �
GitHub
Phase 8 — verification processor
Now we're going to create the most important file.
Create the directory:
lib/payments
Then:
lib/payments/process-successful-payment.ts
But here's where I want to be precise.
Your current /api/orders already contains your working Brevo + owner email + Telegram + receipt pipeline after order creation. �
GitHub
Therefore we should not invent another mailer API.
Instead, before I generate this file, we need to reuse the exact functions from the bottom half of your current app/api/orders/route.ts.
That's the one piece I don't want to guess, because your repository doesn't have a standalone lib/email.ts or lib/mailer.ts; the lib directory currently contains auth, cart, db, visitor, etc., but no mailer module. �
GitHub
So the correct next step is:
Extract the existing successful-order notification code from:
app/api/orders/route.ts
into:
lib/payments/process-successful-payment.ts
That gives both POD and Paystack a common notification pipeline.
Phase 8 verification route
After that extraction, create:
app/api/payments/verify/route.ts
Its responsibility will be ONLY:
reference
 ↓
find order
 ↓
Paystack verify
 ↓
validate:
   reference
   amount
   currency
   status
 ↓
processSuccessfulPayment()
 ↓
return order
Not emails.
Not Telegram.
Not receipt generation.
Not cart logic.
That belongs in the shared processor.
Phase 8 callback
Create:
app/payment/callback/page.tsx
The customer gets:
Paystack
   ↓
/payment/callback?reference=FB-...
The page calls:
POST /api/payments/verify
Then:
success
 ↓
/thank-you?order=123
If verification fails:
payment failed
Phase 9 — webhook
Create:
app/api/payments/webhook/route.ts
This does:
receive raw body
       ↓
read x-paystack-signature
       ↓
HMAC SHA512 verification
       ↓
JSON.parse
       ↓
event === charge.success
       ↓
processSuccessfulPayment()
       ↓
200
Paystack explicitly requires the x-paystack-signature HMAC-SHA512 signature to be checked before processing webhook events. �
Paystack
And importantly, the webhook should not blindly mark an order paid just because it received a reference. The shared processor will verify the transaction/order and make completion idempotent.
One database improvement
Your current schema has:
paymentReference: text('paymentReference')
but it isn't unique. �
GitHub
For payments, I'd add:
paymentReference: text(
  'paymentReference',
).unique(),
or a unique index.
Then run your normal Drizzle migration.
This protects against accidentally creating two orders with the same Paystack reference.
Environment
You need:
PAYSTACK_SECRET_KEY=sk_test_...

PAYSTACK_CALLBACK_URL=http://localhost:3000/payment/callback
Production:
PAYSTACK_SECRET_KEY=sk_live_...

PAYSTACK_CALLBACK_URL=https://your-real-domain.com/payment/callback
The secret stays server-side; Paystack explicitly warns not to expose it in frontend code. �
Paystack
So we're resetting to this exact sequence
Don't paste more random files yet.
Step 1 — DONE
app/api/payments/initialize/route.ts
Already exists in your latest commit. �
GitHub
Step 2 — DO NOW
lib/paystack.ts
Use the single complete version above.
Step 3
Extract your existing Brevo/receipt/owner-email/Telegram code from:
app/api/orders/route.ts
into:
lib/payments/process-successful-payment.ts
Step 4
Create:
app/api/payments/verify/route.ts
Step 5
Create:
app/payment/callback/page.tsx
Step 6
Create:
app/api/payments/webhook/route.ts
Step 7
Update the CheckoutPage's card_bank branch to call:
/api/payments/initialize
The key change from our previous discussion: we're not going to keep generating files based on guessed mailer/helper names. Your latest repo has the actual notification implementation embedded in app/api/orders/route.ts, so that code should become the shared payment-success processor. Your schema and current payment route are now confirmed. �
GitHub +1
If you want to continue immediately, the next file to generate is lib/payments/process-successful-payment.ts, but I need to base it on the exact notification section of your current orders/route.ts, not invent its interfaces.