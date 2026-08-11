import { headers } from 'next/headers'

import { auth } from '@/lib/auth'

export async function requireOwner() {
const session = await auth.api.getSession({
headers: await headers(),
})

if (!session?.user) {
return null
}

if (session.user.role !== 'owner') {
return null
}

return session.user
}