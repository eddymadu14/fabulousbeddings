Yes. I inspected the current main repo, and the implementation needs to be slightly different from what I previously suggested.
Your current code already has the correct foundation:
CheckoutPage owns the thank-you UI through placed. �
GitHub
Pay-on-Delivery sets placedOrder, receiptSent, then placed(true). �
GitHub
Card/bank initializes Paystack and deliberately does not set placed before payment succeeds. �
GitHub
Your callback currently redirects to /thank-you, which is the wrong route. �
GitHub
Your verify endpoint already calls processSuccessfulPayment(reference), so do not duplicate the order/email/Telegram processing in the callback. �
GitHub
So let's fix exactly that.
1. Replace the callback redirect
File
app/payment/callback/page.tsx
Find this current section:
window.setTimeout(() => {
  if (data.orderId) {
    router.replace(
      `/thank-you?order=${encodeURIComponent(
        String(data.orderId),
      )}`,
    )
  } else {
    router.replace('/thank-you')
  }
}, 800)
Replace it with:
window.setTimeout(() => {
  if (!data.orderId) {
    setStatus('failed')
    setMessage(
      'Payment was successful, but we could not identify your order.',
    )
    return
  }

  const params = new URLSearchParams()

  params.set(
    'payment',
    'success',
  )

  params.set(
    'order',
    String(data.orderId),
  )

  router.replace(
    `/checkout?${params.toString()}`,
  )
}, 800)
That is the first critical fix.
2. Make the verify API return orderId
There is another problem in your current repo.
Your callback expects:
data.orderId
but your current verify route returns:
order: {
  id: result.order.id,
  paymentStatus: ...,
  orderStatus: ...,
}
It doesn't return orderId at the top level. �
GitHub
Therefore, the clean fix is to make the callback consume the response you actually have.
In:
app/payment/callback/page.tsx
change:
if (!data.orderId) {
to:
if (!data.order?.id) {
and:
String(data.orderId)
to:
String(data.order.id)
So the complete success redirect becomes:
window.setTimeout(() => {
  if (!data.order?.id) {
    setStatus('failed')
    setMessage(
      'Payment was successful, but we could not identify your order.',
    )
    return
  }

  const params = new URLSearchParams()

  params.set(
    'payment',
    'success',
  )

  params.set(
    'order',
    String(data.order.id),
  )

  router.replace(
    `/checkout?${params.toString()}`,
  )
}, 800)
This is the version I recommend.
3. Add Paystack-success detection to CheckoutPage
Now we need to make /checkout?payment=success&order=123 restore the same state that Pay-on-Delivery normally creates.
Your CheckoutPage already has:
const [placed, setPlaced] =
  useState(false)

const [
  placedOrder,
  setPlacedOrder,
] = useState<{
  id: number
  total: number
} | null>(null)

const [
  receiptSent,
  setReceiptSent,
] = useState(false)
Those are exactly the states we need. �
GitHub
Add this inside CheckoutPage
Immediately after:
export function CheckoutPage() {
and the existing state declarations, add:
const searchParams =
  useSearchParams()
You already import useSearchParams at the top of storefront.tsx, so you don't need another import. �
GitHub
Then add this useEffect after your state declarations:
useEffect(() => {
  const payment =
    searchParams.get(
      'payment',
    )

  const orderId =
    searchParams.get(
      'order',
    )

  if (
    payment !== 'success' ||
    !orderId
  ) {
    return
  }

  const parsedOrderId =
    Number(orderId)

  if (
    !Number.isFinite(
      parsedOrderId,
    )
  ) {
    return
  }

  /*
   * Paystack has already been verified
   * and the server-side payment pipeline
   * has already processed the order.
   *
   * Restore the same UI state used by
   * Pay on Delivery.
   */

  setPlacedOrder({
    id: parsedOrderId,
    total: 0,
  })

  setPaymentMethod(
    'card_bank',
  )

  setReceiptSent(true)

  setPlaced(true)

  /*
   * Remove the query string so refreshing
   * /checkout doesn't repeatedly trigger
   * the success state.
   */
  window.history.replaceState(
    {},
    '',
    '/checkout',
  )
}, [searchParams])
4. Fix the thank-you wording
Your existing thank-you component currently says:
Your Pay on Delivery order has been received...
regardless of payment method. �
GitHub
That's obviously wrong for Paystack.
Replace:
<p className="mx-auto mt-6 max-w-md text-sm leading-7 text-muted-foreground">
  Your Pay on Delivery order has
  been received successfully and on its way to becoming part of your home.
</p>
with:
<p className="mx-auto mt-6 max-w-md text-sm leading-7 text-muted-foreground">
  {paymentMethod ===
  'card_bank'
    ? 'Your payment has been received successfully and your order is now being processed.'
    : 'Your Pay on Delivery order has been received successfully and is on its way to becoming part of your home.'}
</p>
Then because our Paystack restoration effect does:
setPaymentMethod('card_bank')
the correct message appears.
5. Your receipt message will now be correct
You already have:
{receiptSent ? (
  <p>
    Your receipt has been sent to{' '}
    <strong>
      {checkout.email}
    </strong>.
  </p>
) : (
  <p>
    Your order is confirmed.
    We will contact you with
    delivery details.
  </p>
)}
Your existing checkout has this logic already. �
GitHub
For Paystack, however, there's one subtle problem:
The callback page is a fresh browser page.
Therefore the original:
checkout.email
will be empty when CheckoutPage remounts.
So if you want the thank-you screen to say:
Your receipt has been sent to customer@email.com.
we should return the customer email from the verified order rather than relying on the old React state.
That's the better implementation.
6. Return customer email from /api/payments/verify
In:
app/api/payments/verify/route.ts
change the response from:
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
to:
return NextResponse.json({
  success: true,

  order: {
    id:
      result.order.id,

    total:
      result.order.total,

    email:
      result.order.email,

    paymentStatus:
      result.order.paymentStatus,

    orderStatus:
      result.order.orderStatus,

    paymentMethod:
      result.order.paymentMethod,
  },

  alreadyProcessed:
    result.alreadyProcessed,
})
But only use result.order.email if that property exists on the order object returned by your current processSuccessfulPayment().
If your current order object calls it something else, use that existing property.
7. Pass the email back to Checkout
Change your callback redirect:
const params = new URLSearchParams()

params.set(
  'payment',
  'success',
)

params.set(
  'order',
  String(data.order.id),
)

if (data.order.email) {
  params.set(
    'email',
    data.order.email,
  )
}

router.replace(
  `/checkout?${params.toString()}`,
)
Now Checkout receives:
/checkout?payment=success&order=123&email=customer@example.com
8. Restore the email in Checkout
Change the useEffect to:
useEffect(() => {
  const payment =
    searchParams.get(
      'payment',
    )

  const orderId =
    searchParams.get(
      'order',
    )

  const email =
    searchParams.get(
      'email',
    )

  if (
    payment !== 'success' ||
    !orderId
  ) {
    return
  }

  const parsedOrderId =
    Number(orderId)

  if (
    !Number.isFinite(
      parsedOrderId,
    )
  ) {
    return
  }

  if (email) {
    setCheckout(
      (current) => ({
        ...current,
        email,
      }),
    )
  }

  setPlacedOrder({
    id: parsedOrderId,
    total: 0,
  })

  setPaymentMethod(
    'card_bank',
  )

  setReceiptSent(true)

  setPlaced(true)

  window.history.replaceState(
    {},
    '',
    '/checkout',
  )
}, [searchParams])
The resulting pipeline
Now your application actually behaves the way you've been describing:
CHECKOUT
   │
   ├── Pay on Delivery
   │       │
   │       ▼
   │   POST /api/orders
   │       │
   │       ├── create order
   │       ├── send customer email
   │       ├── send owner email
   │       ├── Telegram
   │       └── clear cart
   │
   │
   └── Card / Bank
           │
           ▼
   POST /api/payments/initialize
           │
           ├── create pending order
           └── Paystack
                 │
                 ▼
              SUCCESS
                 │
                 ▼
        /payment/callback
                 │
                 ▼
       POST /api/payments/verify
                 │
                 ▼
    processSuccessfulPayment()
                 │
                 ├── mark paid
                 ├── customer email
                 ├── owner email
                 ├── Telegram
                 └── clear cart
                 │
                 ▼
 /checkout?payment=success&order=123
                 │
                 ▼
          CheckoutPage
                 │
                 ▼
          setPlaced(true)
                 │
                 ▼
        EXISTING THANK YOU
This is the key distinction:
The callback does not "call the CheckoutPage pipeline."
The server payment processor handles fulfillment/alerts, then the callback sends the browser back to CheckoutPage, and CheckoutPage restores its existing placed state.
That's the clean separation you want. It also follows the standard payment pattern: verify the transaction server-side before fulfillment rather than trusting the browser redirect. �
GitHub +1
One thing I would NOT change
Do not add another /payment/success or /thank-you page.
Your current CheckoutPage already has the exact thank-you UI. �
GitHub
The only route that needs changing is:
/payment/callback
        ↓
/checkout?payment=success&order=...
and the only CheckoutPage addition is the state-restoration useEffect.