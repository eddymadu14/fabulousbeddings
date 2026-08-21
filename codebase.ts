Yes. I inspected the current main repo, and there are two separate bugs here.
1. Card receipt email address is definitely broken
Your processSuccessfulPayment() correctly builds:
customerEmail: updatedOrder.customerEmail
and passes that to the Brevo customer mailer. �
GitHub
But your /api/payments/verify currently throws that information away.
It only returns:
order: {
  id: result.order.id,
  paymentStatus: result.order.paymentStatus,
  orderStatus: result.order.orderStatus,
}
So your callback has no customer email to pass back to CheckoutPage. �
GitHub
And your CheckoutPage is already looking for:
searchParams.get('email')
so the frontend side is ready; the server response is the missing link. �
GitHub
Fix
app/api/payments/verify/route.ts
Replace the response at the bottom with:
return NextResponse.json({
  success: true,

  order: {
    id:
      result.order.id,

    total:
      result.order.total,

    customerEmail:
      result.order.customerEmail,

    paymentStatus:
      result.order.paymentStatus,

    orderStatus:
      result.order.orderStatus,

    paymentMethod:
      result.order.paymentMethod,
  },

  alreadyProcessed:
    result.alreadyProcessed,

  notifications:
    result.notifications ?? null,
})
Now the response contains:
{
  "order": {
    "id": 123,
    "customerEmail": "customer@example.com",
    "paymentStatus": "paid"
  }
}
2. Your callback is still wrong
I inspected the current callback and it is still redirecting to /thank-you:
router.replace(
  `/thank-you?order=${...}`
)
Your callback's VerificationResult also doesn't even define customerEmail. �
GitHub
Replace the type at the top with:
type VerificationResult = {
  success?: boolean
  paid?: boolean

  order?: {
    id: number
    total: number
    customerEmail: string
    paymentStatus: string
    orderStatus: string
    paymentMethod: string
  }

  alreadyProcessed?: boolean

  notifications?: {
    customerEmailSent?: boolean
    ownerEmailSent?: boolean
    telegramSent?: boolean
  }

  reference?: string
  message?: string
  error?: string
}
Then replace the current redirect block:
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
with:
window.setTimeout(() => {
  if (!data.order?.id) {
    setStatus('failed')
    setMessage(
      'Payment was successful, but we could not identify your order.',
    )
    return
  }

  const params =
    new URLSearchParams()

  params.set(
    'payment',
    'success',
  )

  params.set(
    'order',
    String(data.order.id),
  )

  if (
    data.order.customerEmail
  ) {
    params.set(
      'email',
      data.order.customerEmail,
    )
  }

  router.replace(
    `/checkout?${params.toString()}`,
  )
}, 800)
Now the browser goes:
/payment/callback
        ↓
/checkout?payment=success&order=123&email=customer@email.com
instead of the nonexistent /thank-you.
Your CheckoutPage already has the effect that reads payment, order, and email, then sets receiptSent(true) and placed(true). �
GitHub
So that part is already wired correctly.
3. Why Telegram works for POD but not Card/Bank
This one is more interesting.
Your processSuccessfulPayment() does call Telegram:
await sendTelegramOrderAlert(
  emailData,
  {
    paymentStatus: 'paid',
  },
)
and emailData contains the correct:
customerEmail
paymentMethod
total
...
�
GitHub
So you do not need to add another Telegram call to the callback.
The problem is the interaction between your idempotency check and notification failure.
Your processor starts with:
if (
  order.paymentStatus ===
  'paid'
) {
  return {
    order,
    alreadyProcessed: true,
  }
}
�
GitHub
That means:
Paystack
   ↓
Webhook/callback
   ↓
processSuccessfulPayment()
   ↓
mark paid
   ↓
emails
   ↓
Telegram fails
   ↓
order is STILL paid
Then the other Paystack delivery comes in:
Webhook/callback
   ↓
processSuccessfulPayment()
   ↓
paymentStatus === paid
   ↓
RETURN IMMEDIATELY
So Telegram gets no second chance.
And your Telegram error is swallowed here:
try {
  await sendTelegramOrderAlert(...)
} catch (error) {
  console.error(
    'Telegram payment alert failed:',
    error,
  )
}
�
GitHub
That's why the payment can be completely successful while Telegram doesn't arrive.
4. The Telegram implementation itself is okay
Your Telegram helper:
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
is correct, and it checks Telegram's actual API response. �
GitHub
So don't modify your Telegram environment variables just because Card/Bank isn't alerting.
Since POD already sends Telegram successfully, the credentials and bot configuration are almost certainly fine.
The key thing we need to find is the actual Telegram API error for the card order.
Your existing code already logs it:
Telegram payment alert failed:
<actual Telegram error>
Check the Vercel function logs for the failed card transaction.
5. I would make one more important change
Right now your notification system isn't robust enough.
You have:
payment succeeds
      ↓
order paid
      ↓
notification failure
      ↓
order remains paid
      ↓
future webhook ignored
That's bad production architecture.
We should change it to:
payment succeeds
      ↓
order paid
      ↓
notifications attempted
      ↓
Telegram failure recorded
      ↓
future webhook can retry failed notification
But don't simply remove the paymentStatus === 'paid' idempotency check.
That could send:
duplicate customer emails
duplicate owner emails
duplicate Telegram alerts
when Paystack sends both callback and webhook.
The proper production solution is to make order fulfillment idempotent separately from notification delivery.
What I recommend we fix right now
Patch 1
app/api/payments/verify/route.ts
Return:
customerEmail
total
paymentMethod
notifications
Patch 2
app/payment/callback/page.tsx
Redirect:
/checkout?payment=success&order=...&email=...
instead of:
/thank-you
Patch 3
Keep the existing CheckoutPage effect because it is already correctly designed to restore:
setCheckout(...email)
setPlacedOrder(...)
setPaymentMethod('card_bank')
setReceiptSent(true)
setPlaced(true)
�
GitHub
Patch 4
Fix Telegram notification reliability separately.
Do not put Telegram into the callback.
The callback should never be responsible for order fulfillment.
One thing I need you to check before we touch Telegram
Run one successful Card/Bank test and look at the Vercel function log for:
Telegram payment alert failed:
The exact error after that line will tell us whether we're dealing with:
Telegram Markdown parsing
chat ID
bot permissions
API rejection
webhook/callback race
or something specific to the card order data.
The code proves that Telegram is being called in the successful-payment processor; the missing alert is therefore not because Paystack bypasses Telegram. �
GitHub
And the email issue is unambiguous: verify/route.ts is currently not returning customerEmail, which is why CheckoutPage can't display it after the Paystack redirect. �
GitHub +1