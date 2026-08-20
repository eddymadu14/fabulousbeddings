
import {
  cookies,
} from 'next/headers'

import {
  headers,
} from 'next/headers'

import {
  NextResponse,
} from 'next/server'

import {
  and,
  eq,
} from 'drizzle-orm'

import {
  auth,
} from '@/lib/auth'

import {
  db,
} from '@/lib/db'

import {
  orders,
} from '@/lib/db/schema'

import {
  getOrCreateVisitor,
  VISITOR_COOKIE,
} from '@/lib/visitor'

import {
  processSuccessfulPayment,
} from '@/lib/payments/process-successful-payment'

export async function POST(
  request: Request,
) {
  try {
    /*
     * ----------------------------------------------------------
     * Get reference
     * ----------------------------------------------------------
     */

    const url =
      new URL(
        request.url,
      )

    const reference =
      url.searchParams.get(
        'reference',
      )

    if (!reference) {
      return NextResponse.json(
        {
          error:
            'Payment reference is required.',
        },
        {
          status: 400,
        },
      )
    }

    /*
     * ----------------------------------------------------------
     * Identify current shopper
     * ----------------------------------------------------------
     */

    const session =
      await auth.api.getSession({
        headers:
          await headers(),
      })

    let userId:
      | string
      | null = null

    let visitorId:
      | string
      | null = null

    if (
      session?.user
    ) {
      userId =
        session.user.id
    } else {
      const cookieStore =
        await cookies()

      const existingVisitorId =
        cookieStore.get(
          VISITOR_COOKIE,
        )?.value

      const visitor =
        await getOrCreateVisitor(
          existingVisitorId,
        )

      visitorId =
        visitor.id
    }

    /*
     * ----------------------------------------------------------
     * Confirm this order belongs to this shopper
     * ----------------------------------------------------------
     */

    const conditions = [
      eq(
        orders.paymentReference,
        reference,
      ),
    ]

    if (userId) {
      conditions.push(
        eq(
          orders.userId,
          userId,
        ),
      )
    } else if (
      visitorId
    ) {
      conditions.push(
        eq(
          orders.visitorId,
          visitorId,
        ),
      )
    }

    const rows =
      await db
        .select({
          id: orders.id,
          paymentStatus:
            orders.paymentStatus,
        })
        .from(orders)
        .where(
          and(
            ...conditions,
          ),
        )
        .limit(1)

    if (
      !rows[0]
    ) {
      return NextResponse.json(
        {
          error:
            'Payment order could not be found.',
        },
        {
          status: 404,
        },
      )
    }

    /*
     * ----------------------------------------------------------
     * Process payment
     * ----------------------------------------------------------
     */

    const result =
      await processSuccessfulPayment(
        reference,
      )

    return NextResponse.json({
      success: true,

      order: {
        id:
          result.order.id,

        paymentStatus:
          result.order.paymentStatus,

        orderStatus:
          result.order.orderStatus,
      },

      alreadyProcessed:
        result.alreadyProcessed,
    })
  } catch (error) {
    console.error(
      'Payment verification failed:',
      error,
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to verify payment.',
      },
      {
        status: 500,
      },
    )
  }
}