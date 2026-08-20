Yes. You only need to replace the Resend-specific layer; the order pipeline, checkout, Telegram, and database logic stay intact.
Brevo's current transactional API is POST /v3/smtp/email and accepts sender, to, subject, and htmlContent, so our existing generated HTML can be reused almost unchanged. �
Brevo API Documentation +1
Patch 1 — remove Resend
File
package.json
Remove:
"resend": "..."
Then run:
pnpm remove resend
Don't install anything yet. We can use Brevo's HTTP API directly, so no Brevo package is necessary.
Patch 2 — environment variables
File
.env.local
Remove:
RESEND_API_KEY=...
RESEND_FROM_EMAIL=...
Replace with:
BREVO_API_KEY=xkeysib-xxxxxxxxxxxxxxxx

BREVO_FROM_EMAIL=orders@yourdomain.com
BREVO_FROM_NAME=Fabulous Beddings

OWNER_EMAIL=your-email@example.com

TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
Brevo requires an API key and a registered/verified sender before transactional sending. �
Brevo API Documentation
Do not use NEXT_PUBLIC_ for any of these.
Patch 3 — replace the mailer
File
lib/email/send-order-email.ts
You keep the file because app/api/orders/route.ts already imports the functions from this location.
Delete the existing Resend implementation and replace the entire file with:
import 'server-only'


type OrderEmailItem = {
  productName: string
  variantName: string | null
  unitPrice: number
  quantity: number
}


export type OrderEmailData = {
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

  items: OrderEmailItem[]
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


function itemsHtml(
  items: OrderEmailItem[],
) {
  return items
    .map(
      (item) => `
        <tr>
          <td
            style="
              padding:10px 0;
              border-bottom:1px solid #eee;
            "
          >
            <strong>
              ${escapeHtml(
                item.productName,
              )}
            </strong>

            ${
              item.variantName
                ? `
                  <br>
                  <small style="color:#777;">
                    ${escapeHtml(
                      item.variantName,
                    )}
                  </small>
                `
                : ''
            }
          </td>

          <td
            style="
              padding:10px;
              text-align:center;
              border-bottom:1px solid #eee;
            "
          >
            ${item.quantity}
          </td>

          <td
            style="
              padding:10px 0;
              text-align:right;
              border-bottom:1px solid #eee;
            "
          >
            ${money(
              item.unitPrice *
                item.quantity,
            )}
          </td>
        </tr>
      `,
    )
    .join('')
}


function buildOrderEmailHtml(
  data: OrderEmailData,
  heading: string,
  message: string,
) {
  return `
<!DOCTYPE html>

<html>

<body
  style="
    margin:0;
    padding:30px;
    background:#f6f3ee;
    font-family:Arial,sans-serif;
    color:#222;
  "
>

<div
  style="
    max-width:650px;
    margin:auto;
    background:#fff;
    padding:40px;
  "
>

<h1
  style="
    margin:0;
    font-family:Georgia,serif;
    font-weight:400;
  "
>
  fabulous
  <span
    style="
      font-family:Arial,sans-serif;
      font-size:12px;
      letter-spacing:4px;
    "
  >
    BEDDINGS
  </span>
</h1>


<p
  style="
    color:#999;
    font-size:11px;
    letter-spacing:2px;
  "
>
  ORDER #${data.id}
</p>


<h2
  style="
    margin-top:35px;
    font-family:Georgia,serif;
    font-weight:400;
  "
>
  ${heading}
</h2>


<p
  style="
    color:#666;
    line-height:1.7;
  "
>
  ${message}
</p>


<table
  width="100%"
  cellpadding="0"
  cellspacing="0"
  style="
    margin-top:30px;
    border-collapse:collapse;
  "
>

<thead>

<tr>

<th style="text-align:left;">
Product
</th>

<th>
Qty
</th>

<th style="text-align:right;">
Amount
</th>

</tr>

</thead>


<tbody>

${itemsHtml(data.items)}

</tbody>

</table>


<div
  style="
    margin-top:25px;
    border-top:1px solid #ddd;
    padding-top:20px;
  "
>

<p>
Subtotal:
<strong>
${money(data.subtotal)}
</strong>
</p>


<p>
Delivery:
<strong>
${
  data.deliveryFee === 0
    ? 'Free'
    : money(
        data.deliveryFee,
      )
}
</strong>
</p>


<h2
  style="
    font-family:Georgia,serif;
    font-weight:400;
  "
>
Total:
${money(data.total)}
</h2>

</div>


<div
  style="
    margin-top:30px;
    padding-top:20px;
    border-top:1px solid #eee;
    color:#666;
    line-height:1.7;
  "
>

<strong>
Delivery information
</strong>

<br>

${escapeHtml(
  data.customerName,
)}

<br>

${escapeHtml(
  data.customerPhone ?? '',
)}

<br>

${escapeHtml(
  data.shippingAddress,
)}

<br>

${escapeHtml(
  data.shippingCity,
)}

,
${escapeHtml(
  data.shippingState,
)}

<br><br>

Payment:
${escapeHtml(
  data.paymentMethod,
)}

<br>

Delivery:
${escapeHtml(
  data.deliveryMethod,
)}

</div>

</div>

</body>

</html>
`
}


async function sendBrevoEmail(
  options: {
    to: string
    toName?: string
    subject: string
    html: string
  },
) {

  const apiKey =
    process.env.BREVO_API_KEY

  const fromEmail =
    process.env.BREVO_FROM_EMAIL

  const fromName =
    process.env.BREVO_FROM_NAME ??
    'Fabulous Beddings'


  if (!apiKey) {
    throw new Error(
      'BREVO_API_KEY is not configured.',
    )
  }


  if (!fromEmail) {
    throw new Error(
      'BREVO_FROM_EMAIL is not configured.',
    )
  }


  const response =
    await fetch(
      'https://api.brevo.com/v3/smtp/email',
      {
        method: 'POST',

        headers: {
          accept:
            'application/json',

          'api-key':
            apiKey,

          'content-type':
            'application/json',
        },

        body:
          JSON.stringify({
            sender: {
              name:
                fromName,

              email:
                fromEmail,
            },

            to: [
              {
                email:
                  options.to,

                ...(options.toName
                  ? {
                      name:
                        options.toName,
                    }
                  : {}),
              },
            ],

            subject:
              options.subject,

            htmlContent:
              options.html,

            tags: [
              'order',
              'fabulous-beddings',
            ],
          }),
      },
    )


  const data =
    await response.json()


  if (!response.ok) {
    throw new Error(
      data?.message ||
        'Brevo email failed.',
    )
  }


  return data
}


export async function sendCustomerOrderEmail(
  data: OrderEmailData,
) {
  return sendBrevoEmail({
    to:
      data.customerEmail,

    toName:
      data.customerName,

    subject:
      `Fabulous Beddings — Order #${data.id}`,

    html:
      buildOrderEmailHtml(
        data,

        `Thank you, ${escapeHtml(
          data.customerName,
        )}.`,

        'Your order has been received successfully. We will contact you with delivery details.',
      ),
  })
}


export async function sendOwnerOrderEmail(
  data: OrderEmailData,
) {

  const ownerEmail =
    process.env.OWNER_EMAIL


  if (!ownerEmail) {
    throw new Error(
      'OWNER_EMAIL is not configured.',
    )
  }


  return sendBrevoEmail({
    to:
      ownerEmail,

    subject:
      `NEW ORDER #${data.id} — ${money(
        data.total,
      )}`,

    html:
      buildOrderEmailHtml(
        data,

        'New order received',

        `
          A new order has been placed by
          <strong>
            ${escapeHtml(
              data.customerName,
            )}
          </strong>.
        `,
      ),
  })
}
This uses Brevo's documented POST /v3/smtp/email endpoint and sends the HTML directly, so you don't have to create Brevo templates yet. �
Brevo API Documentation +1
Patch 4 — app/api/orders/route.ts
Almost nothing changes here.
This is why I structured the mailer as a replacement layer.
Keep:
import {
  sendCustomerOrderEmail,
  sendOwnerOrderEmail,
} from '@/lib/email/send-order-email'
And keep your existing:
await sendCustomerOrderEmail(
  emailData,
)
and:
await sendOwnerOrderEmail(
  emailData,
)
So your order route doesn't care whether the provider is:
Resend
   ↓
Brevo
   ↓
Amazon SES
   ↓
something else
That's the correct architecture.
Patch 5 — Telegram stays untouched
Keep:
lib/notifications/telegram.ts
and:
await sendTelegramOrderAlert(
  emailData,
)
There is zero reason to modify Telegram just because we're changing email providers.
Your final notification layer is:
                /→ Customer email → Brevo
Order created ──┼→ Owner email    → Brevo
                └→ Owner alert    → Telegram
Patch 6 — Don't create a Brevo SDK dependency
You might see Brevo's documentation showing:
import {
  BrevoClient,
} from '@getbrevo/brevo'
That's valid, but I don't recommend adding it to this project right now.
Brevo's API is a straightforward HTTP endpoint, and using fetch() keeps this dependency-free. Their documentation explicitly exposes the endpoint and API-key authentication. �
Brevo API Documentation
Your stack therefore remains:
Next.js
Drizzle
Postgres
Brevo REST API
Telegram Bot API
Clean.
Patch 7 — What changes in .env.local
Your old:
RESEND_API_KEY=
RESEND_FROM_EMAIL=
OWNER_EMAIL=
becomes:
BREVO_API_KEY=
BREVO_FROM_EMAIL=
BREVO_FROM_NAME=Fabulous Beddings
OWNER_EMAIL=
Keep:
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
One thing I would change from our previous Phase 6 design
Don't generate a PDF receipt yet.
For now:
Order
 ↓
HTML receipt email
is enough.
Brevo supports attachments, including base64 content, so we can later generate:
receipt.pdf
and attach it to the customer email if you actually want a downloadable invoice/receipt. �
Brevo API Documentation
But that's a separate feature. Don't complicate the order pipeline now.
Your Phase 6 implementation after this patch
POST /api/orders
       ↓
Validate cart
       ↓
Calculate totals SERVER-SIDE
       ↓
Create order
       ↓
Create order_items
       ↓
paymentStatus = pending
orderStatus = pending
       ↓
Clear cart
       ↓
Transaction commits
       ↓
Brevo → Customer receipt
       ↓
Brevo → Owner notification
       ↓
Telegram → Owner alert
       ↓
Return order
       ↓
Thank-you page
That's the patch I'd make now. It leaves the door open for Brevo templates, delivery emails, abandoned-cart emails, SMS, and eventually payment notifications without rewriting your order system. Brevo also supports transactional webhooks, so later we can track delivered/bounced/opened messages if you want operational visibility. �
Brevo API Documentation +1