
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