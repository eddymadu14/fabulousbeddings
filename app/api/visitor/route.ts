import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { getOrCreateVisitor, VISITOR_COOKIE } from '@/lib/visitor'

export async function GET() {
  const cookieStore = await cookies()

  const existingVisitorId = cookieStore.get(VISITOR_COOKIE)?.value

  const visitor = await getOrCreateVisitor(existingVisitorId)

  const response = NextResponse.json({
    visitorId: visitor.id,
  })

  if (visitor.isNew) {
    response.cookies.set(VISITOR_COOKIE, visitor.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    })
  }

  return response
}