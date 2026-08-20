
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
) {
  const token =
    process.env
      .TELEGRAM_BOT_TOKEN

  const chatId =
    process.env
      .TELEGRAM_CHAT_ID

  if (!token || !chatId) {
    throw new Error(
      'Telegram environment variables are not configured.',
    )
  }


  const message = `
🛍️ *NEW ORDER*

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

*Payment:* Pending

*Subtotal:* ${money(order.subtotal)}

*Delivery:* ${money(order.deliveryFee)}

*TOTAL:* ${money(order.total)}

⚠️ Pay on Delivery
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