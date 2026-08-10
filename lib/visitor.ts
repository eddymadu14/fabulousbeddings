import 'server-only'

import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { visitorSessions } from '@/lib/db/schema'

export const VISITOR_COOKIE = 'fabulous_visitor_id'

export async function getOrCreateVisitor(visitorId?: string) {
  if (visitorId) {
    const visitor = await db
      .select()
      .from(visitorSessions)
      .where(eq(visitorSessions.id, visitorId))
      .limit(1)

    if (visitor.length > 0) {
      await db
        .update(visitorSessions)
        .set({
          lastSeenAt: new Date(),
        })
        .where(eq(visitorSessions.id, visitorId))

      return {
        id: visitor[0].id,
        isNew: false,
      }
    }
  }

  const id = randomUUID()

  await db.insert(visitorSessions).values({
    id,
  })

  return {
    id,
    isNew: true,
  }
}