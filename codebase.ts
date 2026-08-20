Yes. I inspected the latest main commit, and the frontend problem is very clear: your Card / Bank UI already exists, and your backend initialize endpoint is already ready, but CheckoutPage.handleSubmit() explicitly blocks online payment. �
GitHub +1
This is the offending code at components/storefront.tsx around lines 2673–2682:
if (
  paymentMethod !==
  'pay_on_delivery'
) {
  setFormError(
    'Online payment is not available yet.',
  )

  return
}
So when the user selects Card / Bank, the frontend simply stops.
Your backend already expects exactly the customer + delivery payload we're collecting and returns:
payment.authorizationUrl
payment.accessCode
payment.reference
from /api/payments/initialize. �
GitHub +1
The fix
We only need to change the checkout submission pipeline.
File
components/storefront.tsx
Location
Inside:
export function CheckoutPage()
Replace the entire current handleSubmit function, from approximately:
const handleSubmit = async (
through its closing } immediately before:
if (placed) {
with this:
const handleSubmit = async (
  event: React.FormEvent<HTMLFormElement>,
) => {
  event.preventDefault()

  setFormError('')

  /*
   * ----------------------------------------------------------
   * CLIENT-SIDE VALIDATION
   * ----------------------------------------------------------
   */

  if (
    !checkout.firstName.trim() ||
    !checkout.lastName.trim() ||
    !checkout.email.trim() ||
    !checkout.phone.trim() ||
    !checkout.address.trim() ||
    !checkout.city.trim() ||
    !checkout.state.trim()
  ) {
    setFormError(
      'Please complete all required fields.',
    )

    return
  }

  if (items.length === 0) {
    setFormError(
      'Your bag is empty.',
    )

    return
  }

  setIsSubmitting(true)

  try {
    /*
     * ========================================================
     * PAY ON DELIVERY
     * ========================================================
     *
     * This continues using your existing
     * /api/orders pipeline.
     */

    if (
      paymentMethod ===
      'pay_on_delivery'
    ) {
      const response =
        await fetch(
          '/api/orders',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            credentials:
              'include',

            body:
              JSON.stringify({
                customer: {
                  firstName:
                    checkout.firstName.trim(),

                  lastName:
                    checkout.lastName.trim(),

                  email:
                    checkout.email.trim(),

                  phone:
                    checkout.phone.trim(),

                  address:
                    checkout.address.trim(),

                  city:
                    checkout.city.trim(),

                  state:
                    checkout.state.trim(),
                },

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
            'Unable to place order.',
        )
      }

      setPlacedOrder({
        id:
          data.order.id,

        total:
          data.order.total,
      })

      setReceiptSent(
        Boolean(
          data.notifications
            ?.customerEmailSent,
        ),
      )

      setPlaced(true)

      return
    }

    /*
     * ========================================================
     * CARD / BANK
     * ========================================================
     *
     * IMPORTANT:
     *
     * We DO NOT create the order from the browser.
     *
     * /api/payments/initialize:
     *
     *   validates cart
     *   calculates total
     *   creates pending order
     *   creates order items
     *   initializes Paystack
     *   returns authorization URL
     *
     * The cart is intentionally NOT cleared here.
     */

    if (
      paymentMethod ===
      'card_bank'
    ) {
      const response =
        await fetch(
          '/api/payments/initialize',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            credentials:
              'include',

            body:
              JSON.stringify({
                customer: {
                  firstName:
                    checkout.firstName.trim(),

                  lastName:
                    checkout.lastName.trim(),

                  email:
                    checkout.email.trim(),

                  phone:
                    checkout.phone.trim(),

                  address:
                    checkout.address.trim(),

                  city:
                    checkout.city.trim(),

                  state:
                    checkout.state.trim(),
                },

                delivery: {
                  method:
                    deliveryMethod,

                  fee:
                    delivery,
                },
              }),
          },
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Unable to initialize payment.',
        )
      }

      const authorizationUrl =
        data.payment
          ?.authorizationUrl

      if (
        !authorizationUrl
      ) {
        throw new Error(
          'Paystack did not return a payment URL.',
        )
      }

      /*
       * ------------------------------------------------------
       * Redirect customer to Paystack
       * ------------------------------------------------------
       *
       * DO NOT:
       *
       * setPlaced(true)
       * clearCart()
       * send receipt
       *
       * yet.
       *
       * Payment has only been initialized.
       *
       * Those happen after successful verification.
       */

      window.location.assign(
        authorizationUrl,
      )

      return
    }

    throw new Error(
      'Invalid payment method.',
    )
  } catch (error) {
    console.error(
      'Checkout failed:',
      error,
    )

    setFormError(
      error instanceof Error
        ? error.message
        : 'Unable to process your order.',
    )

    setIsSubmitting(false)
  }
}
What this changes
Your checkout now behaves correctly:
Pay on Delivery
Submit
 ↓
POST /api/orders
 ↓
create order
 ↓
create order_items
 ↓
paymentStatus = pending
 ↓
clear cart
 ↓
Brevo
 ↓
owner email
 ↓
Telegram
 ↓
thank-you UI
Your existing /api/orders pipeline already handles that flow. �
GitHub
Card / Bank
Submit
 ↓
POST /api/payments/initialize
 ↓
server loads REAL cart
 ↓
server calculates REAL prices
 ↓
server calculates delivery
 ↓
creates order
 ↓
paymentStatus = pending
 ↓
creates order_items
 ↓
Paystack initialize
 ↓
returns authorizationUrl
 ↓
window.location.assign()
 ↓
PAYSTACK
Your backend is already doing the server-side cart calculation and pending-order creation. �
GitHub +1
Then:
PAYSTACK
   ↓
payment succeeds
   ↓
/payment/callback?reference=FB-...
   ↓
POST /api/payments/verify
   ↓
verify with Paystack
   ↓
validate reference
validate amount
validate currency
   ↓
paymentStatus = paid
   ↓
clear cart
   ↓
customer receipt
   ↓
owner email
   ↓
Telegram
   ↓
/thank-you
One thing I would NOT change
Do not clear the cart in CheckoutPage after this:
window.location.assign(
  authorizationUrl,
)
That's a critical mistake.
At that moment the customer has not paid yet.
Your backend's initialize route correctly leaves the cart untouched. �
GitHub
The cart should only disappear after:
Paystack → successful payment → server verification
Your existing Card / Bank UI is already correct
You don't need to redesign this section:
Payment

○ Pay on delivery
  Pay when your order is delivered.

○ Card / Bank
  Pay securely online.
Your current code already switches:
setPaymentMethod(
  'card_bank',
)
and your submit button already changes to:
Continue to payment
when paymentMethod === 'card_bank'. �
GitHub
So don't touch that part.
Then test
After replacing handleSubmit:
pnpm tsc --noEmit
Then:
pnpm run build
Then test the actual flow:
Add product.
Go checkout.
Fill customer details.
Select Card / Bank.
Click Continue to payment.
Confirm you get redirected to Paystack.
Complete a Paystack test transaction.
Paystack redirects to:
/payment/callback?reference=...
Verification should happen.
Only then should the cart be cleared and the thank-you page appear.
The frontend was not missing a Paystack SDK. Your backend is redirect-based, so the correct integration is simply: POST your checkout data → receive authorizationUrl → redirect the browser to Paystack. Your current backend already exposes that URL. �
GitHub





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