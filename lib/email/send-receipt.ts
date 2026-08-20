
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