
import 'server-only'

import {
  and,
  eq,
} from 'drizzle-orm'

import { db } from '@/lib/db'

import {
  carts,
  cartItems,
} from '@/lib/db/schema'

export type CartOwner = {
  userId?: string
  visitorId?: string
}

export async function getOrCreateCart(
  owner: CartOwner,
) {
  if (
    !owner.userId &&
    !owner.visitorId
  ) {
    throw new Error(
      'Cart owner is required',
    )
  }

  const existing =
    await db
      .select()
      .from(carts)
      .where(
        owner.userId
          ? eq(
              carts.userId,
              owner.userId,
            )
          : eq(
              carts.visitorId,
              owner.visitorId!,
            ),
      )
      .limit(1)

  if (existing.length > 0) {
    return existing[0]
  }

  const [cart] =
    await db
      .insert(carts)
      .values({
        userId:
          owner.userId ?? null,

        visitorId:
          owner.userId
            ? null
            : owner.visitorId ?? null,
      })
      .returning()

  return cart
}

export async function getCartItems(
  cartId: number,
) {
  return db
    .select()
    .from(cartItems)
    .where(
      eq(
        cartItems.cartId,
        cartId,
      ),
    )
}

export async function findCartItem(
  cartId: number,
  productId: number,
  variantId: number | null,
) {
  const conditions = [
    eq(
      cartItems.cartId,
      cartId,
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

  const result =
    await db
      .select()
      .from(cartItems)
      .where(
        and(...conditions),
      )
      .limit(1)

  return result[0] ?? null
}