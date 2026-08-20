
import 'server-only'

import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'

import {
  cartItems,
  carts,
  orderItems,
  orders,
} from '@/lib/db/schema'

import {
  sendCustomerOrderEmail,
  sendOwnerOrderEmail,
} from '@/lib/email/send-order-email'

import {
  sendTelegramOrderAlert,
} from '@/lib/notifications/telegram'

import {
  verifyPaystackTransaction,
} from '@/lib/paystack'

export async function processSuccessfulPayment(
  reference: string,
) {
  /*
   * ----------------------------------------------------------
   * Find order
   * ----------------------------------------------------------
   */

  const orderRows =
    await db
      .select()
      .from(orders)
      .where(
        eq(
          orders.paymentReference,
          reference,
        ),
      )
      .limit(1)

  const order =
    orderRows[0]

  if (!order) {
    throw new Error(
      'Order associated with this payment was not found.',
    )
  }

  /*
   * ----------------------------------------------------------
   * Idempotency
   * ----------------------------------------------------------
   *
   * If Paystack callback and webhook both arrive,
   * don't process the same order twice.
   */

  if (
    order.paymentStatus ===
    'paid'
  ) {
    return {
      order,
      alreadyProcessed:
        true,
    }
  }

  /*
   * ----------------------------------------------------------
   * Verify directly with Paystack
   * ----------------------------------------------------------
   *
   * Never trust the browser or webhook payload alone.
   */

  const transaction =
    await verifyPaystackTransaction(
      reference,
    )

  /*
   * ----------------------------------------------------------
   * Verify transaction status
   * ----------------------------------------------------------
   */

  if (
    transaction.status !==
    'success'
  ) {
    throw new Error(
      `Payment is not successful. Paystack status: ${transaction.status}`,
    )
  }

  /*
   * ----------------------------------------------------------
   * Verify reference
   * ----------------------------------------------------------
   */

  if (
    transaction.reference !==
    order.paymentReference
  ) {
    throw new Error(
      'Payment reference does not match the order.',
    )
  }

  /*
   * ----------------------------------------------------------
   * Verify currency
   * ----------------------------------------------------------
   */

  if (
    transaction.currency !==
    'NGN'
  ) {
    throw new Error(
      'Payment currency does not match the order currency.',
    )
  }

  /*
   * ----------------------------------------------------------
   * Verify amount
   * ----------------------------------------------------------
   *
   * Order total is Naira.
   * Paystack amount is kobo.
   */

  const expectedAmount =
    Math.round(
      order.total * 100,
    )

  if (
    transaction.amount !==
    expectedAmount
  ) {
    throw new Error(
      'Payment amount does not match the order total.',
    )
  }

  /*
   * ----------------------------------------------------------
   * Load order items
   * ----------------------------------------------------------
   */

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

  /*
   * ----------------------------------------------------------
   * Mark order paid + clear cart
   * ----------------------------------------------------------
   */

  const updatedOrder =
    await db.transaction(
      async (tx) => {
        /*
         * Re-check payment status inside
         * the transaction.
         *
         * This protects against callback +
         * webhook arriving nearly together.
         */

        const currentRows =
          await tx
            .select()
            .from(orders)
            .where(
              eq(
                orders.id,
                order.id,
              ),
            )
            .limit(1)

        const currentOrder =
          currentRows[0]

        if (!currentOrder) {
          throw new Error(
            'Order no longer exists.',
          )
        }

        if (
          currentOrder.paymentStatus ===
          'paid'
        ) {
          return currentOrder
        }

        /*
         * Mark payment successful.
         *
         * Keep orderStatus pending because
         * payment success does not mean the
         * order has been delivered/fulfilled.
         */

        const [
          paidOrder,
        ] = await tx
          .update(orders)
          .set({
            paymentStatus:
              'paid',

            orderStatus:
              'pending',

            updatedAt:
              new Date(),
          })
          .where(
            eq(
              orders.id,
              order.id,
            ),
          )
          .returning()

        /*
         * ------------------------------------------------------
         * Clear only this order owner's cart
         * ------------------------------------------------------
         */

        if (
          paidOrder.userId
        ) {
          const userCarts =
            await tx
              .select({
                id: carts.id,
              })
              .from(carts)
              .where(
                eq(
                  carts.userId,
                  paidOrder.userId,
                ),
              )

          for (
            const cart of userCarts
          ) {
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
          }
        } else if (
          paidOrder.visitorId
        ) {
          const visitorCarts =
            await tx
              .select({
                id: carts.id,
              })
              .from(carts)
              .where(
                eq(
                  carts.visitorId,
                  paidOrder.visitorId,
                ),
              )

          for (
            const cart of visitorCarts
          ) {
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
          }
        }

        return paidOrder
      },
    )

  /*
   * ----------------------------------------------------------
   * Email / notification payload
   * ----------------------------------------------------------
   */

  const emailData = {
    id:
      updatedOrder.id,

    customerName:
      updatedOrder.customerName,

    customerEmail:
      updatedOrder.customerEmail,

    customerPhone:
      updatedOrder.customerPhone,

    shippingAddress:
      updatedOrder.shippingAddress,

    shippingCity:
      updatedOrder.shippingCity,

    shippingState:
      updatedOrder.shippingState,

    subtotal:
      updatedOrder.subtotal,

    deliveryFee:
      updatedOrder.deliveryFee,

    total:
      updatedOrder.total,

    deliveryMethod:
      updatedOrder.deliveryMethod,

    paymentMethod:
      updatedOrder.paymentMethod,

    items:
      createdItems.map(
        (item) => ({
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
  }

  /*
   * ----------------------------------------------------------
   * Customer receipt / confirmation
   * ----------------------------------------------------------
   */

  let customerEmailSent =
    false

  try {
    await sendCustomerOrderEmail(
      emailData,
    )

    customerEmailSent =
      true
  } catch (error) {
    console.error(
      'Customer payment email failed:',
      error,
    )
  }

  /*
   * ----------------------------------------------------------
   * Owner notification
   * ----------------------------------------------------------
   */

  let ownerEmailSent =
    false

  try {
    await sendOwnerOrderEmail(
      emailData,
    )

    ownerEmailSent =
      true
  } catch (error) {
    console.error(
      'Owner payment email failed:',
      error,
    )
  }

  /*
   * ----------------------------------------------------------
   * Telegram
   * ----------------------------------------------------------
   */

  let telegramSent =
    false

  try {
    await sendTelegramOrderAlert(
      emailData,
      {
        paymentStatus:
          'paid',
      },
    )

    telegramSent =
      true
  } catch (error) {
    console.error(
      'Telegram payment alert failed:',
      error,
    )
  }

  return {
    order:
      updatedOrder,

    alreadyProcessed:
      false,

    notifications: {
      customerEmailSent,
      ownerEmailSent,
      telegramSent,
    },
  }
}