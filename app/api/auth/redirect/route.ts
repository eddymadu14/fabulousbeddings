import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  })

  if (!session?.user) {
    return NextResponse.json(
      { destination: '/sign-in' },
      { status: 401 },
    )
  }

  return NextResponse.json({
    destination:
      session.user.role === 'owner'
        ? '/owner/analytics'
        : '/',
  })
}