
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