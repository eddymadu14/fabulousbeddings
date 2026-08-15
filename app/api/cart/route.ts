
import { cookies } from 'next/headers'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import {
  and,
  eq,
} from 'drizzle-orm'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

import {
  carts,
  cartItems,
} from '@/lib/db/schema'

import {
  getOrCreateVisitor,
  VISITOR_COOKIE,
} from '@/lib/visitor'

import {
  getOrCreateCart,
} from '@/lib/cart'


function serializeCartItems(
  items: typeof cartItems.$inferSelect[],
) {
  return items.map((item) => ({
    ...item,
    productId: String(item.productId),
  }))
}

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

export async function GET() {
  const owner =
    await getCartOwner()

  const cart =
    await getOrCreateCart(
      owner,
    )

  const items =
    await db
      .select()
      .from(cartItems)
      .where(
        eq(
          cartItems.cartId,
          cart.id,
        ),
      )

  return NextResponse.json({
    cartId: cart.id,
items: serializeCartItems(items),
  })
}

export async function POST(
  request: Request,
) {
  try {
    const body =
      await request.json()

    const productId =
      Number(body.productId)

    const variantId =
      body.variantId == null
        ? null
        : Number(body.variantId)

    const quantity =
      Math.max(
        1,
        Number(body.quantity ?? 1),
      )

    if (
      !Number.isInteger(
        productId,
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid product',
        },
        {
          status: 400,
        },
      )
    }

    if (
      variantId !== null &&
      !Number.isInteger(
        variantId,
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid variant',
        },
        {
          status: 400,
        },
      )
    }

    const owner =
      await getCartOwner()

    const cart =
      await getOrCreateCart(
        owner,
      )

    const conditions = [
      eq(
        cartItems.cartId,
        cart.id,
      ),
      eq(
        cartItems.productId,
        productId,
      ),
    ]

    if (variantId === null) {
      conditions.push(
        eq(
          cartItems.variantId,
          null as never,
        ),
      )
    } else {
      conditions.push(
        eq(
          cartItems.variantId,
          variantId,
        ),
      )
    }

    const existing =
      await db
        .select()
        .from(cartItems)
        .where(
          and(...conditions),
        )
        .limit(1)

    if (existing.length > 0) {
      await db
        .update(cartItems)
        .set({
          quantity:
            existing[0]
              .quantity +
            quantity,

          updatedAt:
            new Date(),
        })
        .where(
          eq(
            cartItems.id,
            existing[0].id,
          ),
        )
    } else {
      await db
        .insert(cartItems)
        .values({
          cartId: cart.id,
          productId,
          variantId,
          quantity,
        })
    }

    await db
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

    const items =
      await db
        .select()
        .from(cartItems)
        .where(
          eq(
            cartItems.cartId,
            cart.id,
          ),
        )

    return NextResponse.json({
      cartId: cart.id,
items: serializeCartItems(items),
    })
  } catch {
    return NextResponse.json(
      {
        error:
          'Unable to add item to cart',
      },
      {
        status: 500,
      },
    )
  }
}


export async function PATCH(
  request: Request,
) {
  try {
    const body = await request.json()

    const itemId = Number(body.itemId)
    const quantity = Number(body.quantity)

    if (
      !Number.isInteger(itemId) ||
      !Number.isInteger(quantity)
    ) {
      return NextResponse.json(
        {
          error: 'Invalid cart update',
        },
        {
          status: 400,
        },
      )
    }

    const owner = await getCartOwner()

    const cart = await getOrCreateCart(
      owner,
    )

    const existing = await db
      .select()
      .from(cartItems)
      .where(
        and(
          eq(cartItems.id, itemId),
          eq(
            cartItems.cartId,
            cart.id,
          ),
        ),
      )
      .limit(1)

    if (!existing.length) {
      return NextResponse.json(
        {
          error:
            'Cart item not found',
        },
        {
          status: 404,
        },
      )
    }

    if (quantity <= 0) {
      await db
        .delete(cartItems)
        .where(
          and(
            eq(
              cartItems.id,
              itemId,
            ),
            eq(
              cartItems.cartId,
              cart.id,
            ),
          ),
        )
    } else {
      await db
        .update(cartItems)
        .set({
          quantity,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(
              cartItems.id,
              itemId,
            ),
            eq(
              cartItems.cartId,
              cart.id,
            ),
          ),
        )
    }

    const items = await db
      .select()
      .from(cartItems)
      .where(
        eq(
          cartItems.cartId,
          cart.id,
        ),
      )

    return NextResponse.json({
      cartId: cart.id,
      items:
        serializeCartItems(items),
    })
  } catch (error) {
    console.error(
      'Cart PATCH failed:',
      error,
    )

    return NextResponse.json(
      {
        error:
          'Unable to update cart',
      },
      {
        status: 500,
      },
    )
  }
}


export async function DELETE(
  request: Request,
) {
  try {
    const body = await request.json()

    const itemId = Number(body.itemId)

    if (!Number.isInteger(itemId)) {
      return NextResponse.json(
        {
          error:
            'Invalid cart item',
        },
        {
          status: 400,
        },
      )
    }

    const owner = await getCartOwner()

    const cart = await getOrCreateCart(
      owner,
    )

    const existing = await db
      .select()
      .from(cartItems)
      .where(
        and(
          eq(cartItems.id, itemId),
          eq(
            cartItems.cartId,
            cart.id,
          ),
        ),
      )
      .limit(1)

    if (!existing.length) {
      return NextResponse.json(
        {
          error:
            'Cart item not found',
        },
        {
          status: 404,
        },
      )
    }

    await db
      .delete(cartItems)
      .where(
        and(
          eq(
            cartItems.id,
            itemId,
          ),
          eq(
            cartItems.cartId,
            cart.id,
          ),
        ),
      )

    const items = await db
      .select()
      .from(cartItems)
      .where(
        eq(
          cartItems.cartId,
          cart.id,
        ),
      )

    return NextResponse.json({
      cartId: cart.id,
      items:
        serializeCartItems(items),
    })
  } catch (error) {
    console.error(
      'Cart DELETE failed:',
      error,
    )

    return NextResponse.json(
      {
        error:
          'Unable to remove cart item',
      },
      {
        status: 500,
      },
    )
  }
}