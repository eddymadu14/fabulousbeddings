
import { cookies } from 'next/headers'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import {
  and,
  eq,
  inArray,
} from 'drizzle-orm'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

import {
  cartItems,
  carts,
  orderItems,
  orders,
  productVariants,
  products,
} from '@/lib/db/schema'

import {
  getOrCreateVisitor,
  VISITOR_COOKIE,
} from '@/lib/visitor'

import {
  getCartItems,
  getOrCreateCart,
} from '@/lib/cart'


/* ============================================================
   TYPES
============================================================ */

type CheckoutCustomer = {
  email: string
  firstName: string
  lastName: string
  phone: string
  address: string
  city: string
  state: string
}

type CreateOrderBody = {
  customer: CheckoutCustomer

  delivery: {
    method: string
    fee: number
  }

  payment: {
    method:
      | 'pay_on_delivery'
      | 'card_bank'
  }
}


/* ============================================================
   CART OWNER
============================================================ */

async function getCartOwner() {
  const session =
    await auth.api.getSession({
      headers: await headers(),
    })

  if (session?.user) {
    return {
      userId: session.user.id,
    }
  }

  const cookieStore =
    await cookies()

  const visitorId =
    cookieStore.get(
      VISITOR_COOKIE,
    )?.value

  const visitor =
    await getOrCreateVisitor(
      visitorId,
    )

  return {
    visitorId: visitor.id,
  }
}


/* ============================================================
   CUSTOMER VALIDATION
============================================================ */

function isValidCustomer(
  customer: unknown,
): customer is CheckoutCustomer {
  if (
    !customer ||
    typeof customer !== 'object'
  ) {
    return false
  }

  const value =
    customer as Record<
      string,
      unknown
    >

  return (
    typeof value.email === 'string' &&
    value.email.trim().length > 0 &&

    typeof value.firstName === 'string' &&
    value.firstName.trim().length > 0 &&

    typeof value.lastName === 'string' &&
    value.lastName.trim().length > 0 &&

    typeof value.phone === 'string' &&
    value.phone.trim().length > 0 &&

    typeof value.address === 'string' &&
    value.address.trim().length > 0 &&

    typeof value.city === 'string' &&
    value.city.trim().length > 0 &&

    typeof value.state === 'string' &&
    value.state.trim().length > 0
  )
}


/* ============================================================
   POST /api/orders
============================================================ */

export async function POST(
  request: Request,
) {
  try {
    const body =
      (await request.json()) as CreateOrderBody

    const {
      customer,
      delivery,
      payment,
    } = body


    /* --------------------------------------------------------
       Validate customer
    -------------------------------------------------------- */

    if (
      !isValidCustomer(
        customer,
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Please complete all customer information.',
        },
        {
          status: 400,
        },
      )
    }


    /* --------------------------------------------------------
       Validate delivery
    -------------------------------------------------------- */

    if (
      !delivery ||
      typeof delivery.method !==
        'string'
    ) {
      return NextResponse.json(
        {
          error:
            'A delivery method is required.',
        },
        {
          status: 400,
        },
      )
    }


    /* --------------------------------------------------------
       Validate payment
    -------------------------------------------------------- */

    if (
      payment?.method !==
        'pay_on_delivery' &&
      payment?.method !==
        'card_bank'
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid payment method.',
        },
        {
          status: 400,
        },
      )
    }


    /* --------------------------------------------------------
       Identify shopper
    -------------------------------------------------------- */

    const owner =
      await getCartOwner()


    /* --------------------------------------------------------
       Get server-side cart
    -------------------------------------------------------- */

    const cart =
      await getOrCreateCart(
        owner,
      )

    const items =
      await getCartItems(
        cart.id,
      )

    if (items.length === 0) {
      return NextResponse.json(
        {
          error:
            'Your cart is empty.',
        },
        {
          status: 400,
        },
      )
    }


    /* --------------------------------------------------------
       Load products
    -------------------------------------------------------- */

    const productIds =
      Array.from(
        new Set(
          items.map(
            (item) =>
              item.productId,
          ),
        ),
      )

    const dbProducts =
      await db
        .select()
        .from(products)
        .where(
          inArray(
            products.id,
            productIds,
          ),
        )


    /* --------------------------------------------------------
       Recalculate subtotal
       SERVER SIDE
    -------------------------------------------------------- */

    let subtotal = 0

    const orderItemRows: {
      productId: number
      variantId: number | null
      productName: string
      variantName: string | null
      unitPrice: number
      quantity: number
    }[] = []


    for (const item of items) {
      const product =
        dbProducts.find(
          (candidate) =>
            candidate.id ===
            item.productId,
        )

      if (!product) {
        return NextResponse.json(
          {
            error:
              `Product ${item.productId} no longer exists.`,
          },
          {
            status: 400,
          },
        )
      }


      let unitPrice =
        product.price

      let variantName:
        | string
        | null = null


      /* ------------------------------------------------------
         Variant
      ------------------------------------------------------ */

      if (
        item.variantId !== null
      ) {
        const variantRows =
          await db
            .select()
            .from(
              productVariants,
            )
            .where(
              and(
                eq(
                  productVariants.id,
                  item.variantId,
                ),
                eq(
                  productVariants.productId,
                  product.id,
                ),
              ),
            )
            .limit(1)

        const variant =
          variantRows[0]

        if (!variant) {
          return NextResponse.json(
            {
              error:
                `Selected variant for ${product.name} no longer exists.`,
            },
            {
              status: 400,
            },
          )
        }

        if (!variant.active) {
          return NextResponse.json(
            {
              error:
                `Selected variant for ${product.name} is unavailable.`,
            },
            {
              status: 400,
            },
          )
        }

        unitPrice =
          variant.price

        variantName =
          variant.name
      }


      /* ------------------------------------------------------
         Quantity
      ------------------------------------------------------ */

      if (
        !Number.isInteger(
          item.quantity,
        ) ||
        item.quantity <= 0
      ) {
        return NextResponse.json(
          {
            error:
              `Invalid quantity for ${product.name}.`,
          },
          {
            status: 400,
          },
        )
      }


      const lineTotal =
        unitPrice *
        item.quantity

      subtotal +=
        lineTotal


      orderItemRows.push({
        productId:
          product.id,

        variantId:
          item.variantId,

        productName:
          product.name,

        variantName,

        unitPrice,

        quantity:
          item.quantity,
      })
    }


    /* --------------------------------------------------------
       Delivery
    -------------------------------------------------------- */

    const FREE_DELIVERY_THRESHOLD =
      150000

    const STANDARD_DELIVERY_FEE =
      5000

    const calculatedDeliveryFee =
      subtotal >=
      FREE_DELIVERY_THRESHOLD
        ? 0
        : STANDARD_DELIVERY_FEE


    /*
     * Browser sends delivery fee
     * for display, but server decides
     * what the real fee is.
     */
    if (
      Number(delivery.fee) !==
      calculatedDeliveryFee
    ) {
      return NextResponse.json(
        {
          error:
            'Delivery fee has changed. Please refresh checkout.',
        },
        {
          status: 409,
        },
      )
    }


    const total =
      subtotal +
      calculatedDeliveryFee


    /* --------------------------------------------------------
       Payment state
    -------------------------------------------------------- */

    const isPayOnDelivery =
      payment.method ===
      'pay_on_delivery'

    const paymentStatus =
      isPayOnDelivery
        ? 'pending'
        : 'pending'

    const orderStatus =
      isPayOnDelivery
        ? 'confirmed'
        : 'pending'


    /* --------------------------------------------------------
       Create order + items + clear cart
       AS ONE TRANSACTION
    -------------------------------------------------------- */

    const result =
      await db.transaction(
        async (tx) => {

          const [
            order,
          ] = await tx
            .insert(orders)
            .values({
              userId:
                owner.userId ??
                null,

              visitorId:
                owner.visitorId ??
                null,

              customerName:
                `${customer.firstName.trim()} ${customer.lastName.trim()}`,

              customerEmail:
                customer.email.trim(),

              customerPhone:
                customer.phone.trim(),

              shippingAddress:
                customer.address.trim(),

              shippingCity:
                customer.city.trim(),

              shippingState:
                customer.state.trim(),

              subtotal,

              deliveryFee:
                calculatedDeliveryFee,

              total,

              deliveryMethod:
                delivery.method,

              paymentMethod:
                payment.method,

              paymentStatus,

              orderStatus,

              paymentReference:
                null,
            })
            .returning()


          await tx
            .insert(orderItems)
            .values(
              orderItemRows.map(
                (item) => ({
                  orderId:
                    order.id,

                  productId:
                    item.productId,

                  variantId:
                    item.variantId,

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
            )


          /*
           * Clear ONLY this customer's cart.
           */
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


          return order
        },
      )


    return NextResponse.json(
      {
        success: true,

        order: {
          id:
            result.id,

          customerName:
            result.customerName,

          customerEmail:
            result.customerEmail,

          subtotal:
            result.subtotal,

          deliveryFee:
            result.deliveryFee,

          total:
            result.total,

          deliveryMethod:
            result.deliveryMethod,

          paymentMethod:
            result.paymentMethod,

          paymentStatus:
            result.paymentStatus,

          orderStatus:
            result.orderStatus,
        },
      },
      {
        status: 201,
      },
    )

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
      {
        status: 500,
      },
    )
  }
}