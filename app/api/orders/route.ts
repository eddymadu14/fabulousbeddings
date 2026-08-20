
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  orders,
  orderItems,
  products,
  productVariants,
} from '@/lib/db/schema'
import { getCart } from '@/lib/cart'
import { eq, inArray } from 'drizzle-orm'

export async function POST(
  request: Request,
) {
  try {
    const body = await request.json()

    const {
      customer,
      deliveryMethod,
      deliveryFee,
      paymentMethod,
    } = body

    if (
      !customer?.email ||
      !customer?.firstName ||
      !customer?.lastName ||
      !customer?.phone ||
      !customer?.address ||
      !customer?.city ||
      !customer?.state
    ) {
      return NextResponse.json(
        {
          error:
            'Complete customer information is required.',
        },
        { status: 400 },
      )
    }

    if (
      !['pay_on_delivery', 'card_bank'].includes(
        paymentMethod,
      )
    ) {
      return NextResponse.json(
        {
          error: 'Invalid payment method.',
        },
        { status: 400 },
      )
    }

    if (!deliveryMethod) {
      return NextResponse.json(
        {
          error:
            'Delivery method is required.',
        },
        { status: 400 },
      )
    }

    /*
     * IMPORTANT:
     * Read the cart from the server.
     * Never trust prices or totals
     * sent by the browser.
     */
    const cart = await getCart()

    if (!cart || cart.items.length === 0) {
      return NextResponse.json(
        {
          error: 'Your cart is empty.',
        },
        { status: 400 },
      )
    }

    const productIds = cart.items.map(
      (item) => item.productId,
    )

    const dbProducts =
      await db.query.products.findMany({
        where: inArray(
          products.id,
          productIds,
        ),
        with: {
          variants: true,
        },
      })

    let subtotal = 0

    const itemRows = []

    for (const item of cart.items) {
      const product =
        dbProducts.find(
          (product) =>
            product.id === item.productId,
        )

      if (!product) {
        return NextResponse.json(
          {
            error:
              `Product ${item.productId} no longer exists.`,
          },
          { status: 400 },
        )
      }

      let unitPrice = product.price
      let variantName: string | null =
        null

      if (item.variantId != null) {
        const variant =
          product.variants.find(
            (variant) =>
              variant.id ===
              item.variantId,
          )

        if (!variant) {
          return NextResponse.json(
            {
              error:
                `Selected variant for ${product.name} no longer exists.`,
            },
            { status: 400 },
          )
        }

        unitPrice = variant.price
        variantName =
          variant.name
      }

      const lineTotal =
        unitPrice * item.quantity

      subtotal += lineTotal

      itemRows.push({
        productId: product.id,
        variantId:
          item.variantId ?? null,
        productName: product.name,
        variantName,
        unitPrice,
        quantity: item.quantity,
      })
    }

    /*
     * Server-side delivery calculation.
     */
    const FREE_DELIVERY_THRESHOLD =
      150000

    const STANDARD_DELIVERY_FEE =
      5000

    const calculatedDelivery =
      subtotal >=
      FREE_DELIVERY_THRESHOLD
        ? 0
        : STANDARD_DELIVERY_FEE

    const total =
      subtotal + calculatedDelivery

    /*
     * Never trust deliveryFee from
     * the browser.
     */
    if (
      Number(deliveryFee) !==
      calculatedDelivery
    ) {
      return NextResponse.json(
        {
          error:
            'Delivery price changed. Please refresh checkout.',
        },
        { status: 409 },
      )
    }

    const customerName =
      `${customer.firstName} ${customer.lastName}`.trim()

    const paymentStatus =
      paymentMethod ===
      'pay_on_delivery'
        ? 'pending'
        : 'pending'

    const orderStatus =
      paymentMethod ===
      'pay_on_delivery'
        ? 'confirmed'
        : 'pending'

    const result =
      await db.transaction(
        async (tx) => {
          const [order] =
            await tx
              .insert(orders)
              .values({
                customerName,
                customerEmail:
                  customer.email,
                customerPhone:
                  customer.phone,

                shippingAddress:
                  customer.address,
                shippingCity:
                  customer.city,
                shippingState:
                  customer.state,

                subtotal,
                deliveryFee:
                  calculatedDelivery,
                total,

                deliveryMethod,
                paymentMethod,

                paymentStatus,
                orderStatus,
              })
              .returning()

          await tx
            .insert(orderItems)
            .values(
              itemRows.map(
                (item) => ({
                  ...item,
                  orderId: order.id,
                }),
              ),
            )

          return order
        },
      )

    return NextResponse.json({
      success: true,
      order: result,
    })
  } catch (error) {
    console.error(
      'Create order failed:',
      error,
    )

    return NextResponse.json(
      {
        error:
          'Unable to create your order.',
      },
      { status: 500 },
    )
  }
}