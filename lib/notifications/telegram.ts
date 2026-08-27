
import 'server-only'

function escapeMarkdown(value: unknown): string {
  return String(value ?? '')
    .replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1')
}

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
${escapeMarkdown(order.customerName)}

📧 ${order.customerEmail}

📞 ${order.customerPhone}


*Delivery*
${escapeMarkdown(order.shippingAddress)}
${escapeMarkdown(order.shippingCity)}, ${escapeMarkdown(order.shippingState)}

🚚 ${escapeMarkdown(order.deliveryMethod)}

💳 ${escapeMarkdown(order.paymentMethod)}

*Payment:* ${paymentLabel}

${paymentWarning}

*Subtotal:* ₦${escapeMarkdown(
  order.subtotal.toLocaleString(),
)}

*Delivery:* ₦${escapeMarkdown(
  order.deliveryFee.toLocaleString(),
)}

*TOTAL:* ₦${escapeMarkdown(
  order.total.toLocaleString(),
)}

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