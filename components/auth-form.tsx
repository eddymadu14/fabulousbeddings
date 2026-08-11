'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { signIn, signUp } from '@/lib/auth-client'

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
const router = useRouter()
const [error, setError] = useState('')
const [loading, setLoading] = useState(false)

async function submit(event: React.FormEvent<HTMLFormElement>) {
event.preventDefault()

setLoading(true)
setError('')

const data = Object.fromEntries(new FormData(event.currentTarget))

const result =
  mode === 'sign-in'
    ? await signIn.email({
        email: String(data.email),
        password: String(data.password),
      })
    : await signUp.email({
        email: String(data.email),
        password: String(data.password),
        name: String(data.name),
      })

setLoading(false)

if (result.error) {
  setError(result.error.message || 'Unable to continue')
  return
}

router.push('/')
router.refresh()

}

return (
<form onSubmit={submit} className="flex flex-col gap-5">
{mode === 'sign-up' && (
<label className="flex flex-col gap-2 text-sm">
Name
<input
name="name"
required
className="border border-border bg-background px-4 py-3 outline-none focus:border-primary"
/>
</label>
)}

  <label className="flex flex-col gap-2 text-sm">
    Email
    <input
      name="email"
      type="email"
      required
      className="border border-border bg-background px-4 py-3 outline-none focus:border-primary"
    />
  </label>

  <label className="flex flex-col gap-2 text-sm">
    Password
    <input
      name="password"
      type="password"
      minLength={8}
      required
      className="border border-border bg-background px-4 py-3 outline-none focus:border-primary"
    />
  </label>

  {error && (
    <p role="alert" className="text-sm text-destructive">
      {error}
    </p>
  )}

  <button
    disabled={loading}
    className="bg-primary px-5 py-3 text-xs font-medium uppercase tracking-[0.16em] text-primary-foreground disabled:opacity-60"
  >
    {loading
      ? 'Please wait…'
      : mode === 'sign-in'
        ? 'Sign in'
        : 'Create account'}
  </button>
</form>

)
}