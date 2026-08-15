
import { cookies } from 'next/headers'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import {
  eq,
  and,
} from 'drizzle-orm'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

import {
  carts,
  cartItems,
} from '@/lib/db/schema'

import {
  VISITOR_COOKIE,
} from '@/lib/visitor'

export async function POST() {
  const session =
    await auth.api.getSession({
      headers: await headers(),
    })

  if (!session?.user) {
    return NextResponse.json(
      {
        error:
          'Authentication required',
      },
      {
        status: 401,
      },
    )
  }

  const cookieStore =
    await cookies()

  const visitorId =
    cookieStore.get(
      VISITOR_COOKIE,
    )?.value

  if (!visitorId) {
    return NextResponse.json({
      merged: false,
    })
  }

  const visitorCart =
    await db
      .select()
      .from(carts)
      .where(
        eq(
          carts.visitorId,
          visitorId,
        ),
      )
      .limit(1)

  if (!visitorCart.length) {
    return NextResponse.json({
      merged: false,
    })
  }

  const [userCart] =
    await db
      .select()
      .from(carts)
      .where(
        eq(
          carts.userId,
          session.user.id,
        ),
      )
      .limit(1)

  let targetCart =
    userCart

  if (!targetCart) {
    const [created] =
      await db
        .insert(carts)
        .values({
          userId:
            session.user.id,
          visitorId: null,
        })
        .returning()

    targetCart = created
  }

  const visitorItems =
    await db
      .select()
      .from(cartItems)
      .where(
        eq(
          cartItems.cartId,
          visitorCart[0].id,
        ),
      )

  for (const item of visitorItems) {
    const existing =
      item.variantId === null
        ? await db
            .select()
            .from(cartItems)
            .where(
              and(
                eq(
                  cartItems.cartId,
                  targetCart.id,
                ),
                eq(
                  cartItems.productId,
                  item.productId,
                ),
                eq(
                  cartItems.variantId,
                  null as never,
                ),
              ),
            )
            .limit(1)
        : await db
            .select()
            .from(cartItems)
            .where(
              and(
                eq(
                  cartItems.cartId,
                  targetCart.id,
                ),
                eq(
                  cartItems.productId,
                  item.productId,
                ),
                eq(
                  cartItems.variantId,
                  item.variantId,
                ),
              ),
            )
            .limit(1)

    if (existing.length) {
      await db
        .update(cartItems)
        .set({
          quantity:
            existing[0]
              .quantity +
            item.quantity,

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
          cartId:
            targetCart.id,

          productId:
            item.productId,

          variantId:
            item.variantId,

          quantity:
            item.quantity,
        })
    }
  }

  await db
    .delete(carts)
    .where(
      eq(
        carts.id,
        visitorCart[0].id,
      ),
    )

  return NextResponse.json({
    merged: true,
  })
}