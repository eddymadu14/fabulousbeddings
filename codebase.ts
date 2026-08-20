Yes. I checked the latest main commit again, and this time I'm basing Phase 6 on what is actually in the repo now.
There are two important corrections from the previous phase:
Your current orders schema already has all the fields we need. �
GitHub
Your current /api/orders is still the old implementation: it imports a nonexistent getCart(), doesn't attach userId/visitorId, doesn't clear the cart, and currently marks Pay on Delivery as confirmed instead of the Phase 6 requirement of pending. �
GitHub
Also, your project currently has no email library installed—the package contains neither Resend nor Nodemailer. �
GitHub
So we're going to implement Phase 6 cleanly without pretending email works until the provider is installed.
Phase 6 — Pay on Delivery
The final flow will be:
Checkout
   ↓
POST /api/orders
   ↓
identify user / visitor
   ↓
load server cart
   ↓
validate products + variants
   ↓
calculate subtotal
   ↓
calculate delivery
   ↓
calculate total
   ↓
create order
   ↓
create order_items
   ↓
paymentStatus = pending
   ↓
orderStatus = pending
   ↓
clear cart
   ↓
generate receipt
   ↓
send receipt email
   ↓
return order
   ↓
Thank-you page
The crucial point: the browser does not decide the price.
STEP 1 — Install email provider
Because you're deploying to Vercel, I'd use Resend rather than Nodemailer.
Run:
pnpm add resend
Then add these to .env.local:
RESEND_API_KEY=re_your_api_key
RESEND_FROM_EMAIL=orders@fabulousbeddings.com
For production, add the same variables to Vercel.
Do not put the API key anywhere inside components/storefront.tsx.
STEP 2 — Create the receipt generator
Create:
lib/email/receipt.ts
Entire file:
import type {
  Order,
  OrderItem,
} from '@/lib/db/types'


type ReceiptData = {
  order: Order
  items: OrderItem[]
}


function formatNaira(
  amount: number,
) {
  return new Intl.NumberFormat(
    'en-NG',
    {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    },
  ).format(amount)
}


export function generateReceiptEmail(
  data: ReceiptData,
) {
  const {
    order,
    items,
  } = data

  const itemRows =
    items
      .map(
        (item) => `
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid #eee;">
              <strong>${escapeHtml(item.productName)}</strong>
              ${
                item.variantName
                  ? `<br /><span style="color:#777;font-size:13px;">${escapeHtml(item.variantName)}</span>`
                  : ''
              }
            </td>

            <td style="padding:12px 0;border-bottom:1px solid #eee;text-align:center;">
              ${item.quantity}
            </td>

            <td style="padding:12px 0;border-bottom:1px solid #eee;text-align:right;">
              ${formatNaira(
                item.unitPrice *
                  item.quantity,
              )}
            </td>
          </tr>
        `,
      )
      .join('')


  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Fabulous Beddings Order Confirmation</title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#f7f5f1;
    font-family:Arial,sans-serif;
    color:#222;
  "
>

  <div
    style="
      max-width:640px;
      margin:40px auto;
      background:#fff;
      padding:40px;
    "
  >

    <h1
      style="
        margin:0 0 8px;
        font-family:Georgia,serif;
        font-weight:400;
      "
    >
      Fabulous Beddings
    </h1>

    <p
      style="
        margin:0 0 32px;
        color:#777;
        font-size:13px;
      "
    >
      ORDER RECEIPT
    </p>


    <h2
      style="
        font-family:Georgia,serif;
        font-weight:400;
      "
    >
      Thank you, ${escapeHtml(order.customerName)}.
    </h2>

    <p
      style="
        color:#666;
        line-height:1.7;
      "
    >
      We've received your order and will
      contact you with delivery details.
    </p>


    <div
      style="
        margin:28px 0;
        padding:18px;
        background:#f7f5f1;
      "
    >
      <strong>
        Order #${order.id}
      </strong>

      <br />

      <span
        style="
          color:#777;
          font-size:13px;
        "
      >
        Pay on delivery
      </span>
    </div>


    <table
      width="100%"
      cellpadding="0"
      cellspacing="0"
      style="
        border-collapse:collapse;
        font-size:14px;
      "
    >

      <thead>
        <tr>
          <th
            style="
              text-align:left;
              padding-bottom:12px;
            "
          >
            Product
          </th>

          <th
            style="
              text-align:center;
              padding-bottom:12px;
            "
          >
            Qty
          </th>

          <th
            style="
              text-align:right;
              padding-bottom:12px;
            "
          >
            Amount
          </th>
        </tr>
      </thead>

      <tbody>
        ${itemRows}
      </tbody>

    </table>


    <div
      style="
        margin-top:24px;
        border-top:1px solid #ddd;
        padding-top:18px;
      "
    >

      <div
        style="
          display:flex;
          justify-content:space-between;
          margin-bottom:10px;
        "
      >
        <span>Subtotal</span>
        <strong>
          ${formatNaira(order.subtotal)}
        </strong>
      </div>

      <div
        style="
          display:flex;
          justify-content:space-between;
          margin-bottom:10px;
        "
      >
        <span>Delivery</span>
        <strong>
          ${
            order.deliveryFee === 0
              ? 'Complimentary'
              : formatNaira(
                  order.deliveryFee,
                )
          }
        </strong>
      </div>

      <div
        style="
          display:flex;
          justify-content:space-between;
          margin-top:18px;
          padding-top:18px;
          border-top:1px solid #ddd;
          font-size:18px;
        "
      >
        <strong>Total</strong>

        <strong>
          ${formatNaira(order.total)}
        </strong>
      </div>

    </div>


    <div
      style="
        margin-top:32px;
        padding-top:24px;
        border-top:1px solid #eee;
        color:#777;
        font-size:13px;
        line-height:1.7;
      "
    >

      <strong style="color:#222;">
        Delivery address
      </strong>

      <br />

      ${escapeHtml(order.shippingAddress)}
      <br />
      ${escapeHtml(order.shippingCity)},
      ${escapeHtml(order.shippingState)}

      <br /><br />

      ${escapeHtml(order.customerPhone)}

    </div>


    <p
      style="
        margin-top:40px;
        color:#999;
        font-size:12px;
        line-height:1.6;
      "
    >
      This email is your official Fabulous
      Beddings order receipt.
    </p>

  </div>

</body>
</html>
`
}


function escapeHtml(
  value: string,
) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
One correction
Your repo does not currently expose:
lib/db/types.ts
So don't create an artificial dependency just for this.
Instead, change the top of that file to use local types:
type ReceiptOrder = {
  id: number
  customerName: string
  customerEmail: string
  customerPhone: string | null
  shippingAddress: string
  shippingCity: string
  shippingState: string
  subtotal: number
  deliveryFee: number
  total: number
}

type ReceiptItem = {
  productName: string
  variantName: string | null
  unitPrice: number
  quantity: number
}

type ReceiptData = {
  order: ReceiptOrder
  items: ReceiptItem[]
}
Use that instead of the Order/OrderItem import.
STEP 3 — Create email sender
Create:
lib/email/send-receipt.ts
import 'server-only'

import { Resend } from 'resend'

import {
  generateReceiptEmail,
} from './receipt'


const resend = new Resend(
  process.env.RESEND_API_KEY,
)


type ReceiptOrder = {
  id: number
  customerName: string
  customerEmail: string
  customerPhone: string | null
  shippingAddress: string
  shippingCity: string
  shippingState: string
  subtotal: number
  deliveryFee: number
  total: number
}

type ReceiptItem = {
  productName: string
  variantName: string | null
  unitPrice: number
  quantity: number
}


export async function sendOrderReceipt(
  order: ReceiptOrder,
  items: ReceiptItem[],
) {
  const html =
    generateReceiptEmail({
      order,
      items,
    })

  const from =
    process.env.RESEND_FROM_EMAIL

  if (!from) {
    throw new Error(
      'RESEND_FROM_EMAIL is not configured.',
    )
  }

  const result =
    await resend.emails.send({
      from,
      to: order.customerEmail,
      subject:
        `Fabulous Beddings — Order #${order.id}`,
      html,
    })

  if (result.error) {
    throw new Error(
      result.error.message,
    )
  }

  return result.data
}
STEP 4 — Replace app/api/orders/route.ts
Your current route is wrong for Phase 6. It currently:
imports nonexistent getCart()
doesn't identify the authenticated user
doesn't identify the visitor
doesn't clear cart_items
sets Pay on Delivery to confirmed
doesn't send a receipt
doesn't return the receipt/order pipeline we want. �
GitHub
Replace the entire file with:
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
  inArray,
} from 'drizzle-orm'

import {
  auth,
} from '@/lib/auth'

import {
  db,
} from '@/lib/db'

import {
  carts,
  cartItems,
  orderItems,
  orders,
  productVariants,
  products,
} from '@/lib/db/schema'

import {
  getCartItems,
  getOrCreateCart,
} from '@/lib/cart'

import {
  getOrCreateVisitor,
  VISITOR_COOKIE,
} from '@/lib/visitor'

import {
  sendOrderReceipt,
} from '@/lib/email/send-receipt'


/* ============================================================
   TYPES
============================================================ */

type CheckoutCustomer = {
  email: string
  firstName: string
  lastName: string
  phone: string
  address: string
  city: string
  state: string
}

type CreateOrderBody = {
  customer: CheckoutCustomer

  delivery: {
    method: string
    fee: number
  }

  payment: {
    method:
      | 'pay_on_delivery'
      | 'card_bank'
  }
}


/* ============================================================
   GET CART OWNER
============================================================ */

async function getCartOwner() {
  const session =
    await auth.api.getSession({
      headers: await headers(),
    })

  if (session?.user) {
    return {
      userId:
        session.user.id,
    }
  }

  const cookieStore =
    await cookies()

  const visitorCookie =
    cookieStore.get(
      VISITOR_COOKIE,
    )?.value

  const visitor =
    await getOrCreateVisitor(
      visitorCookie,
    )

  return {
    visitorId:
      visitor.id,
  }
}


/* ============================================================
   VALIDATE CUSTOMER
============================================================ */

function isValidCustomer(
  customer: unknown,
): customer is CheckoutCustomer {
  if (
    !customer ||
    typeof customer !==
      'object'
  ) {
    return false
  }

  const value =
    customer as Record<
      string,
      unknown
    >

  return (
    typeof value.email ===
      'string' &&
    value.email.trim()
      .length > 0 &&

    typeof value.firstName ===
      'string' &&
    value.firstName.trim()
      .length > 0 &&

    typeof value.lastName ===
      'string' &&
    value.lastName.trim()
      .length > 0 &&

    typeof value.phone ===
      'string' &&
    value.phone.trim()
      .length > 0 &&

    typeof value.address ===
      'string' &&
    value.address.trim()
      .length > 0 &&

    typeof value.city ===
      'string' &&
    value.city.trim()
      .length > 0 &&

    typeof value.state ===
      'string' &&
    value.state.trim()
      .length > 0
  )
}


/* ============================================================
   POST /api/orders
============================================================ */

export async function POST(
  request: Request,
) {
  try {

    /* --------------------------------------------------------
       Read request
    -------------------------------------------------------- */

    const body =
      (await request.json()) as
        CreateOrderBody

    const {
      customer,
      delivery,
      payment,
    } = body


    /* --------------------------------------------------------
       Validate customer
    -------------------------------------------------------- */

    if (
      !isValidCustomer(
        customer,
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Please complete all customer information.',
        },
        {
          status: 400,
        },
      )
    }


    /* --------------------------------------------------------
       Phase 6 is ONLY Pay on Delivery
    -------------------------------------------------------- */

    if (
      payment?.method !==
      'pay_on_delivery'
    ) {
      return NextResponse.json(
        {
          error:
            'This endpoint currently handles Pay on Delivery only.',
        },
        {
          status: 400,
        },
      )
    }


    /* --------------------------------------------------------
       Validate delivery
    -------------------------------------------------------- */

    if (
      !delivery ||
      typeof delivery.method !==
        'string'
    ) {
      return NextResponse.json(
        {
          error:
            'Delivery method is required.',
        },
        {
          status: 400,
        },
      )
    }


    /* --------------------------------------------------------
       Identify owner
    -------------------------------------------------------- */

    const owner =
      await getCartOwner()


    /* --------------------------------------------------------
       Load actual server cart
    -------------------------------------------------------- */

    const cart =
      await getOrCreateCart(
        owner,
      )

    const items =
      await getCartItems(
        cart.id,
      )


    if (
      items.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            'Your cart is empty.',
        },
        {
          status: 400,
        },
      )
    }


    /* --------------------------------------------------------
       Load products
    -------------------------------------------------------- */

    const productIds =
      Array.from(
        new Set(
          items.map(
            (item) =>
              item.productId,
          ),
        ),
      )

    const dbProducts =
      await db
        .select()
        .from(products)
        .where(
          inArray(
            products.id,
            productIds,
          ),
        )


    /* --------------------------------------------------------
       Calculate subtotal
    -------------------------------------------------------- */

    let subtotal = 0

    const orderItemRows: {
      productId: number
      variantId:
        | number
        | null
      productName: string
      variantName:
        | string
        | null
      unitPrice: number
      quantity: number
    }[] = []


    for (
      const item of items
    ) {

      const product =
        dbProducts.find(
          (candidate) =>
            candidate.id ===
            item.productId,
        )


      if (!product) {
        return NextResponse.json(
          {
            error:
              `Product ${item.productId} no longer exists.`,
          },
          {
            status: 400,
          },
        )
      }


      let unitPrice =
        product.price

      let variantName:
        | string
        | null = null


      /* ------------------------------------------------------
         Variant validation
      ------------------------------------------------------ */

      if (
        item.variantId !==
        null
      ) {

        const variantRows =
          await db
            .select()
            .from(
              productVariants,
            )
            .where(
              and(
                eq(
                  productVariants.id,
                  item.variantId,
                ),

                eq(
                  productVariants.productId,
                  product.id,
                ),
              ),
            )
            .limit(1)


        const variant =
          variantRows[0]


        if (!variant) {
          return NextResponse.json(
            {
              error:
                `Selected variant for ${product.name} no longer exists.`,
            },
            {
              status: 400,
            },
          )
        }


        if (
          !variant.active
        ) {
          return NextResponse.json(
            {
              error:
                `Selected variant for ${product.name} is unavailable.`,
            },
            {
              status: 400,
            },
          )
        }


        if (
          variant.stock <
          item.quantity
        ) {
          return NextResponse.json(
            {
              error:
                `${product.name} does not have enough stock.`,
            },
            {
              status: 400,
            },
          )
        }


        unitPrice =
          variant.price

        variantName =
          variant.name

      } else {

        if (
          product.stock <
          item.quantity
        ) {
          return NextResponse.json(
            {
              error:
                `${product.name} does not have enough stock.`,
            },
            {
              status: 400,
            },
          )
        }
      }


      /* ------------------------------------------------------
         Quantity
      ------------------------------------------------------ */

      if (
        !Number.isInteger(
          item.quantity,
        ) ||
        item.quantity <= 0
      ) {
        return NextResponse.json(
          {
            error:
              `Invalid quantity for ${product.name}.`,
          },
          {
            status: 400,
          },
        )
      }


      subtotal +=
        unitPrice *
        item.quantity


      orderItemRows.push({
        productId:
          product.id,

        variantId:
          item.variantId,

        productName:
          product.name,

        variantName,

        unitPrice,

        quantity:
          item.quantity,
      })
    }


    /* --------------------------------------------------------
       Delivery
    -------------------------------------------------------- */

    const FREE_DELIVERY_THRESHOLD =
      150000

    const STANDARD_DELIVERY_FEE =
      5000


    const calculatedDeliveryFee =
      subtotal >=
      FREE_DELIVERY_THRESHOLD
        ? 0
        : STANDARD_DELIVERY_FEE


    if (
      Number(delivery.fee) !==
      calculatedDeliveryFee
    ) {
      return NextResponse.json(
        {
          error:
            'Delivery fee changed. Please refresh checkout.',
        },
        {
          status: 409,
        },
      )
    }


    const total =
      subtotal +
      calculatedDeliveryFee


    /* ========================================================
       DATABASE TRANSACTION
    ======================================================== */

    const order =
      await db.transaction(
        async (tx) => {

          /* --------------------------------------------------
             CREATE ORDER
          -------------------------------------------------- */

          const [
            createdOrder,
          ] = await tx
            .insert(orders)
            .values({

              userId:
                owner.userId ??
                null,

              visitorId:
                owner.visitorId ??
                null,

              customerName:
                `${customer.firstName.trim()} ${customer.lastName.trim()}`,

              customerEmail:
                customer.email.trim(),

              customerPhone:
                customer.phone.trim(),

              shippingAddress:
                customer.address.trim(),

              shippingCity:
                customer.city.trim(),

              shippingState:
                customer.state.trim(),

              subtotal,

              deliveryFee:
                calculatedDeliveryFee,

              total,

              deliveryMethod:
                delivery.method,

              paymentMethod:
                'pay_on_delivery',

              /*
               * Payment has NOT happened.
               */
              paymentStatus:
                'pending',

              /*
               * Order is waiting for
               * fulfilment/delivery.
               */
              orderStatus:
                'pending',

              paymentReference:
                null,
            })
            .returning()


          /* --------------------------------------------------
             CREATE ORDER ITEMS
          -------------------------------------------------- */

          await tx
            .insert(orderItems)
            .values(
              orderItemRows.map(
                (item) => ({
                  orderId:
                    createdOrder.id,

                  productId:
                    item.productId,

                  variantId:
                    item.variantId,

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
            )


          /* --------------------------------------------------
             CLEAR CART
          -------------------------------------------------- */

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


          return createdOrder
        },
      )


    /* ========================================================
       GET ORDER ITEMS FOR RECEIPT
    ======================================================== */

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


    /* ========================================================
       SEND RECEIPT
    ======================================================== */

    let receiptSent =
      false

    try {

      await sendOrderReceipt(
        order,
        createdItems,
      )

      receiptSent = true

    } catch (emailError) {

      /*
       * IMPORTANT:
       *
       * The order has already been
       * successfully created.
       *
       * Email failure must NOT turn
       * a successful order into a
       * failed checkout.
       */
      console.error(
        'Receipt email failed:',
        emailError,
      )
    }


    /* ========================================================
       RETURN ORDER
    ======================================================== */

    return NextResponse.json(
      {
        success: true,

        receiptSent,

        order: {
          id:
            order.id,

          customerName:
            order.customerName,

          customerEmail:
            order.customerEmail,

          subtotal:
            order.subtotal,

          deliveryFee:
            order.deliveryFee,

          total:
            order.total,

          deliveryMethod:
            order.deliveryMethod,

          paymentMethod:
            order.paymentMethod,

          paymentStatus:
            order.paymentStatus,

          orderStatus:
            order.orderStatus,
        },
      },
      {
        status: 201,
      },
    )

  } catch (error) {

    console.error(
      'Pay on delivery order failed:',
      error,
    )

    return NextResponse.json(
      {
        error:
          'Unable to place your order. Please try again.',
      },
      {
        status: 500,
      },
    )
  }
}
STEP 5 — Fix CheckoutPage
Your current checkout doesn't actually call /api/orders. It builds checkoutPayload and then immediately does:
setPlaced(true)
So right now it can show "Thank you" without an order existing. That's exactly what we're removing. �
GitHub
In:
components/storefront.tsx
inside:
export function CheckoutPage()
replace the current handleSubmit with:
const handleSubmit = async (
  event: React.FormEvent<HTMLFormElement>,
) => {
  event.preventDefault()

  setFormError('')

  if (
    !checkout.email ||
    !checkout.firstName ||
    !checkout.lastName ||
    !checkout.address ||
    !checkout.city ||
    !checkout.state ||
    !checkout.phone
  ) {
    setFormError(
      'Please complete all required fields.',
    )

    return
  }

  if (
    paymentMethod !==
    'pay_on_delivery'
  ) {
    setFormError(
      'Online payment is not available yet.',
    )

    return
  }

  setIsSubmitting(true)

  try {

    const response =
      await fetch(
        '/api/orders',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            customer:
              checkout,

            delivery: {
              method:
                deliveryMethod,

              fee:
                delivery,
            },

            payment: {
              method:
                'pay_on_delivery',
            },
          }),
        },
      )


    const data =
      await response.json()


    if (!response.ok) {
      throw new Error(
        data.error ||
          'Unable to place your order.',
      )
    }


    console.log(
      'Order created:',
      data.order,
    )


    /*
     * Only now show success.
     */
    setPlaced(true)

  } catch (error) {

    console.error(
      'Checkout submission failed:',
      error,
    )

    setFormError(
      error instanceof Error
        ? error.message
        : 'Something went wrong. Please try again.',
    )

  } finally {

    setIsSubmitting(false)
  }
}
STEP 6 — Fix the success page to acknowledge the order
Your existing success state only says:
Thank you.
We should now show the actual order number.
Add:
const [
  placedOrder,
  setPlacedOrder,
] = useState<{
  id: number
  total: number
} | null>(null)
Then when the API succeeds:
setPlacedOrder({
  id: data.order.id,
  total: data.order.total,
})

setPlaced(true)
Then change the success UI:
{placedOrder && (
  <p className="mt-3 text-sm text-muted-foreground">
    Order #{placedOrder.id}
  </p>
)}
And change the message to:
<p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
  Your Pay on Delivery order has been
  received. A receipt has been sent to
  {checkout.email}.
</p>
But make that last sentence conditional on receiptSent.
Better:
const [
  receiptSent,
  setReceiptSent,
] = useState(false)
On success:
setReceiptSent(
  Boolean(data.receiptSent),
)

setPlacedOrder({
  id: data.order.id,
  total: data.order.total,
})

setPlaced(true)
Then:
<p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
  Your Pay on Delivery order has been
  received.

  {receiptSent
    ? ` Your receipt has been sent to ${checkout.email}.`
    : ' Your order is confirmed and we will contact you with delivery details.'}
</p>
Very important: order status
You specifically requested:
paymentStatus = pending
orderStatus = pending
So that is exactly what the API now writes.
Not:
orderStatus = confirmed
Pay on Delivery means the order exists, but the money hasn't been collected.
So:
paymentStatus: pending
orderStatus: pending
is the correct state.
Later, when the delivery person collects payment:
paymentStatus → paid
orderStatus → fulfilled
That will be part of the order-management pipeline.
One thing I deliberately did NOT do
I did not reduce product stock yet.
That's intentional.
Your current schema has stock on both products and variants. �
GitHub
We need to decide whether stock is:
reserved at order creation
or:
deducted when order is fulfilled
For Pay on Delivery, I recommend reserve/deduct at order creation, otherwise two customers can successfully order the last bedsheet before either order is fulfilled.
But that deserves its own transaction logic rather than sneaking it into this phase.
Run these now
First:
pnpm add resend
Then:
pnpm tsc --noEmit
Then:
pnpm run build
Then test exactly:
Add product
      ↓
Cart
      ↓
Checkout
      ↓
Fill details
      ↓
Pay on Delivery
      ↓
Place order
      ↓
POST /api/orders
      ↓
201
      ↓
orders row created
      ↓
order_items created
      ↓
cart_items deleted
      ↓
receipt generated
      ↓
email sent
      ↓
Thank You
Your current checkout UI already has Pay on Delivery / Card-Bank selection, but we're intentionally making Phase 6 accept only Pay on Delivery. �
GitHub
Next phase should be stock reservation + order confirmation/fulfilment, then we build the Card/Bank payment facilitator on top of this order pipeline.